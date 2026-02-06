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

  constructor(scene: Scene, identity: string, modelPath: string) {
    console.log(`🎭 [RemotePlayer] Constructor called for ${identity} with model ${modelPath}`);
    this.scene = scene;
    this.identity = identity;
    this.modelPath = modelPath;

    this.loadModel();
    console.log(`🎭 [RemotePlayer] loadModel() called for ${identity}`);
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

      console.log(`[RemotePlayer:${this.identity}] Model loaded with ${this.animationGroups.length} animations:`,
        this.animationGroups.map(a => a.name).join(', '));

      // Stop all animations initially
      this.animationGroups.forEach(anim => anim.stop());

      // Start Standard_Walk animation specifically (not Man_Walk)
      const walkAnimation = this.animationGroups.find(anim =>
        anim.name === 'Standard_Walk'
      ) || this.animationGroups.find(anim =>
        anim.name.toLowerCase().includes('walk')
      );

      if (walkAnimation) {
        walkAnimation.start(true);
        console.log(`[RemotePlayer:${this.identity}] ✓ Started walk animation: ${walkAnimation.name}`);
      } else {
        console.warn(`[RemotePlayer:${this.identity}] ⚠️  No walk animation found!`);
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
      this.currentAnimation = update.animation;
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
    if (schema.animation !== this.currentAnimation) {
      console.log(`[RemotePlayer:${this.identity}] Animation change: ${this.currentAnimation} → ${schema.animation} (${this.animationGroups.length} animations available)`);
      this.playAnimation(schema.animation);
      this.currentAnimation = schema.animation;
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
    console.log(`[RemotePlayer:${this.identity}] playAnimation('${animationName}') - ${this.animationGroups.length} animations available`);

    if (this.animationGroups.length === 0) {
      console.warn(`[RemotePlayer:${this.identity}] ⚠️  Cannot play animation - model not loaded yet!`);
      return;
    }

    // Stop current animations
    this.animationGroups.forEach(anim => {
      if (anim.isPlaying) {
        anim.stop();
      }
    });

    // Prefer Standard_Walk over Man_Walk
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
      console.log(`[RemotePlayer:${this.identity}] ✓ Playing: ${animation.name}`);
    } else {
      console.warn(`[RemotePlayer:${this.identity}] ⚠️  Animation '${animationName}' not found`);
      // Try common animation patterns
      if (animationName === 'idle') {
        // Look for idle or default animation
        const idleAnim = this.animationGroups.find(anim =>
          anim.name.toLowerCase().includes('idle') ||
          anim.name.toLowerCase().includes('default')
        );
        if (idleAnim) {
          idleAnim.start(true);
          console.log(`[RemotePlayer:${this.identity}] ✓ Playing fallback: ${idleAnim.name}`);
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
