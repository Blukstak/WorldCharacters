import { Scene, Vector3, AnimationGroup, AbstractMesh, SceneLoader } from '@babylonjs/core';
import type { PositionUpdate } from '../multiplayer/types';

/**
 * RemotePlayer represents a remote player's character in the scene
 * Handles position interpolation and animation synchronization
 */
export class RemotePlayer {
  private scene: Scene;
  public identity: string;
  private modelPath: string;

  private mesh: AbstractMesh | null = null;
  private animationGroups: AnimationGroup[] = [];
  private currentAnimation: string = 'idle';
  private pendingAnimation: string | null = null;
  private modelLoaded = false;

  // Current position (actual render position)
  public position: Vector3 = Vector3.Zero();
  public rotation: number = 0;

  // Target position (received from network)
  private targetPosition: Vector3 = Vector3.Zero();
  private targetRotation: number = 0;

  // Interpolation settings
  private interpolationSpeed = 0.15; // Lerp factor
  private lastUpdateTime = 0;

  // Dead reckoning (prediction)
  private velocity: Vector3 = Vector3.Zero();
  private enablePrediction = true;

  public profileIndex: number = 0;

  constructor(scene: Scene, identity: string, modelPath: string, profileIndex: number = 0) {
    this.scene = scene;
    this.identity = identity;
    this.modelPath = modelPath;
    this.profileIndex = profileIndex;

    this.loadModel();
  }

  /**
   * Load remote player's character model
   */
  private async loadModel(): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync(
        '',
        '',
        this.modelPath,
        this.scene,
        undefined,
        '.glb'
      );

      this.mesh = result.meshes[0];
      this.animationGroups = result.animationGroups;
      this.modelLoaded = true;

      // GLB imports set rotationQuaternion which overrides .rotation - clear it
      this.mesh.rotationQuaternion = null;

      // Tag mesh for click detection (business card popup)
      this.mesh.metadata = {
        ...this.mesh.metadata,
        playerType: 'remote',
        sessionId: this.identity,
        profileIndex: this.profileIndex,
      };

      // Normalize model height so all characters are the same size
      const TARGET_HEIGHT = 1.8;
      const bounds = this.mesh.getHierarchyBoundingVectors();
      const currentHeight = bounds.max.y - bounds.min.y;
      if (currentHeight > 0) {
        const scaleFactor = TARGET_HEIGHT / currentHeight;
        this.mesh.scaling.setAll(scaleFactor);
      }

      console.log(`[RemotePlayer:${this.identity}] Model loaded with ${this.animationGroups.length} animations`);

      // Stop all animations initially
      this.animationGroups.forEach(anim => anim.stop());

      // Play pending animation if one was requested before model loaded
      if (this.pendingAnimation) {
        console.log(`[RemotePlayer:${this.identity}] Playing pending animation: ${this.pendingAnimation}`);
        this.playAnimation(this.pendingAnimation);
        this.pendingAnimation = null;
      } else {
        // Default: start walk animation
        this.playAnimation('walk');
      }

      // Set initial position
      if (this.mesh) {
        this.mesh.position = this.position.clone();
      }

      console.log(`[RemotePlayer:${this.identity}] Model loaded successfully`);
    } catch (error) {
      console.error(`[RemotePlayer:${this.identity}] Failed to load model:`, error);
    }
  }

  /**
   * Receive position update from network
   */
  receiveUpdate(update: PositionUpdate): void {
    const now = Date.now();

    // Calculate velocity for dead reckoning
    if (this.enablePrediction && this.lastUpdateTime > 0) {
      const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
      if (deltaTime > 0) {
        const newPos = new Vector3(update.position.x, update.position.y, update.position.z);
        const deltaPos = newPos.subtract(this.targetPosition);
        this.velocity = deltaPos.scale(1 / deltaTime);
      }
    }

    // Update target position and rotation
    this.targetPosition = new Vector3(
      update.position.x,
      update.position.y,
      update.position.z
    );
    this.targetRotation = update.rotation.y;

    // Update animation if changed
    if (update.animation !== this.currentAnimation) {
      this.playAnimation(update.animation);
    }

    this.lastUpdateTime = now;
  }

  /**
   * Update from Colyseus schema (replaces receiveUpdate for Colyseus)
   */
  updateFromSchema(schema: any): void {
    // Update target position from server
    this.targetPosition = new Vector3(schema.x, schema.y, schema.z);
    this.targetRotation = schema.rotationY;

    // Update animation if changed
    if (schema.animation && schema.animation !== this.currentAnimation) {
      if (!this.modelLoaded) {
        // Store pending animation - will be played when model loads
        this.pendingAnimation = schema.animation;
      } else {
        this.playAnimation(schema.animation);
      }
    }

    this.lastUpdateTime = Date.now();
  }

  /**
   * Update - called every frame
   * Interpolates position to target with optional dead reckoning
   */
  update(deltaTime: number): void {
    if (!this.mesh) return;

    // Apply dead reckoning if no updates received recently
    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    if (this.enablePrediction && timeSinceLastUpdate > 100 && this.velocity.length() > 0.01) {
      // Predict position based on last known velocity
      const prediction = this.velocity.scale(deltaTime);
      this.targetPosition.addInPlace(prediction);
    }

    // Interpolate position
    this.position = Vector3.Lerp(
      this.position,
      this.targetPosition,
      this.interpolationSpeed
    );

    // Interpolate rotation
    this.rotation = this.lerp(this.rotation, this.targetRotation, this.interpolationSpeed);

    // Update mesh
    this.mesh.position = this.position.clone();
    this.mesh.rotation.y = this.rotation;
  }

  /**
   * Play animation by name or pattern
   */
  private playAnimation(animationName: string): void {
    if (this.animationGroups.length === 0) {
      return;
    }

    // Stop current animations
    this.animationGroups.forEach(anim => {
      if (anim.isPlaying) {
        anim.stop();
      }
    });

    // Prefer Standard_Walk over Man_Walk for walk animations
    let animation: AnimationGroup | undefined;
    if (animationName.toLowerCase().includes('walk')) {
      animation = this.animationGroups.find(anim => anim.name === 'Standard_Walk') ||
                  this.animationGroups.find(anim => anim.name.toLowerCase().includes('walk'));
    } else {
      animation = this.animationGroups.find(anim =>
        anim.name.toLowerCase().includes(animationName.toLowerCase())
      );
    }

    if (animation) {
      animation.start(true);
      this.currentAnimation = animationName;
    } else {
      // Fallback: try idle
      if (animationName === 'idle') {
        const idleAnim = this.animationGroups.find(anim =>
          anim.name.toLowerCase().includes('idle') ||
          anim.name.toLowerCase().includes('default')
        );
        if (idleAnim) {
          idleAnim.start(true);
          this.currentAnimation = animationName;
        }
      }
    }
  }

  /**
   * Linear interpolation helper
   */
  private lerp(start: number, end: number, factor: number): number {
    // Handle angle wrapping for rotation
    let delta = end - start;

    // Normalize to [-PI, PI]
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    return start + delta * factor;
  }

  /**
   * Get current position
   */
  getPosition(): Vector3 {
    return this.position.clone();
  }

  /**
   * Get current rotation
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set interpolation speed
   */
  setInterpolationSpeed(speed: number): void {
    this.interpolationSpeed = Math.max(0.01, Math.min(1.0, speed));
  }

  /**
   * Enable/disable dead reckoning prediction
   */
  setPredictionEnabled(enabled: boolean): void {
    this.enablePrediction = enabled;
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.mesh !== null;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }

    this.animationGroups.forEach(anim => anim.dispose());

    console.log(`[RemotePlayer:${this.identity}] Disposed`);
  }
}
