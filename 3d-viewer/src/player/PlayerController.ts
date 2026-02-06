import { Scene, Vector3, AnimationGroup, AbstractMesh, SceneLoader } from '@babylonjs/core';
import { PathfindingManager } from '../pathfinding/PathfindingManager';
import type { ColyseusManager } from '../multiplayer/ColyseusManager';

/**
 * PlayerController manages the local player character
 * Handles movement, animations, and multiplayer broadcasting
 */
export class PlayerController {
  private scene: Scene;
  private pathfinding: PathfindingManager;
  private colyseusManager: ColyseusManager | null;

  private mesh: AbstractMesh | null = null;
  private animationGroups: AnimationGroup[] = [];
  private walkAnimation: AnimationGroup | null = null;

  public position: Vector3 = Vector3.Zero();
  public rotation: Vector3 = Vector3.Zero();
  private currentAnimation: string = 'idle';

  private path: Vector3[] = [];
  private currentWaypointIndex = 0;
  private moveSpeed = 0.05;
  private rotationSpeed = 0.15;
  private isMoving = false;

  private lastPositionUpdate = 0;
  private positionUpdateInterval = 50; // 20 Hz

  constructor(
    scene: Scene,
    modelPath: string | File,
    pathfinding: PathfindingManager,
    colyseusManager: ColyseusManager | null
  ) {
    this.scene = scene;
    this.pathfinding = pathfinding;
    this.colyseusManager = colyseusManager;

    this.loadModel(modelPath);
  }

  /**
   * Load player character model
   */
  private async loadModel(modelPath: string | File): Promise<void> {
    const url = typeof modelPath === 'string' ? modelPath : URL.createObjectURL(modelPath);
    const shouldRevokeUrl = typeof modelPath !== 'string';

    try {
      const result = await SceneLoader.ImportMeshAsync('', '', url, this.scene, undefined, '.glb');

      this.mesh = result.meshes[0];
      this.animationGroups = result.animationGroups;

      // Stop all animations initially
      this.animationGroups.forEach(anim => anim.stop());

      // Find walk animation
      this.walkAnimation = this.animationGroups.find(anim =>
        anim.name.toLowerCase().includes('walk')
      ) || null;

      // Get spawn position from server (will be set via updateFromServer)
      // For now, set to origin - the server will send the correct position
      this.position = new Vector3(0, 0, 0);
      if (this.mesh) {
        this.mesh.position = this.position.clone();
      }

      // Sync with server position
      if (this.colyseusManager) {
        const room = this.colyseusManager.getRoom();
        if (room && room.state.players.has(room.sessionId)) {
          const serverPlayer = room.state.players.get(room.sessionId);
          if (serverPlayer) {
            this.position.set(serverPlayer.x, serverPlayer.y, serverPlayer.z);
            if (this.mesh) {
              this.mesh.position = this.position.clone();
            }
            console.log('[PlayerController] Synced spawn position:', this.position);
          }
        }
      }

      console.log('[PlayerController] Model loaded successfully');

      if (shouldRevokeUrl) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('[PlayerController] Failed to load model:', error);
    }
  }

  /**
   * Handle click to move - request pathfinding
   */
  handleClick(destination: Vector3): void {
    if (!this.pathfinding.isReady()) {
      console.warn('[PlayerController] Pathfinding not ready');
      return;
    }

    // Get closest walkable position
    const validDestination = this.pathfinding.getClosestWalkablePosition(destination);

    // Find path
    const path = this.pathfinding.findPath(this.position, validDestination);

    if (path) {
      // Smooth path for better movement
      const smoothPath = this.pathfinding.smoothPath(path);
      this.followPath(smoothPath);

      // Broadcast move command to server
      if (this.colyseusManager) {
        this.colyseusManager.sendMoveCommand(validDestination);
      }
    } else {
      console.warn('[PlayerController] No path found to destination');
    }
  }

  /**
   * Start following a path
   */
  followPath(path: Vector3[]): void {
    this.path = path;
    this.currentWaypointIndex = 0;
    this.isMoving = true;

    // Start walk animation
    if (this.walkAnimation && !this.walkAnimation.isPlaying) {
      this.walkAnimation.start(true);
      this.currentAnimation = this.walkAnimation.name;
    }
  }

  /**
   * Update - called every frame
   */
  update(): void {
    if (!this.isMoving || this.path.length === 0) return;

    const target = this.path[this.currentWaypointIndex];
    const direction = target.subtract(this.position);
    const distance = direction.length();

    // Reached waypoint
    if (distance < 0.5) {
      this.currentWaypointIndex++;

      if (this.currentWaypointIndex >= this.path.length) {
        // Reached destination
        this.stopMovement();
        return;
      }

      return;
    }

    // Move toward waypoint
    direction.normalize();
    this.position.addInPlace(direction.scale(this.moveSpeed));

    // Rotate to face direction
    const targetRotationY = Math.atan2(direction.x, direction.z);
    this.rotation.y = this.lerp(this.rotation.y, targetRotationY, this.rotationSpeed);

    // Update mesh position and rotation
    if (this.mesh) {
      this.mesh.position = this.position.clone();
      this.mesh.rotation.y = this.rotation.y;
    }

    // Broadcast position update (throttled)
    this.broadcastPosition();
  }

  /**
   * Stop movement and idle
   */
  private stopMovement(): void {
    this.isMoving = false;
    this.path = [];

    // Stop walk animation
    if (this.walkAnimation && this.walkAnimation.isPlaying) {
      this.walkAnimation.stop();
    }

    this.currentAnimation = 'idle';

    // Notify server of stop
    if (this.colyseusManager) {
      this.colyseusManager.sendStopCommand();
    }

    // Final position broadcast
    this.broadcastPosition(true);
  }

  /**
   * Broadcast position to other players (throttled)
   */
  private broadcastPosition(force: boolean = false): void {
    if (!this.colyseusManager) return;

    const now = Date.now();
    if (!force && (now - this.lastPositionUpdate) < this.positionUpdateInterval) {
      return;
    }

    this.colyseusManager.sendPositionUpdate(
      this.position,
      this.rotation.y
    );

    this.lastPositionUpdate = now;
  }

  /**
   * Linear interpolation helper
   */
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
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
    return this.rotation.y;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }

    this.animationGroups.forEach(anim => anim.dispose());

    console.log('[PlayerController] Disposed');
  }
}
