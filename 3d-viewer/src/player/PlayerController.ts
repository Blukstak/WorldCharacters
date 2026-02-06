import {
  Scene, Vector3, AnimationGroup, AbstractMesh, SceneLoader,
  MeshBuilder, StandardMaterial, Color3, Mesh,
} from '@babylonjs/core';
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

  // Debug visuals
  private debugClickMarker: Mesh | null = null;
  private debugPathLines: Mesh | null = null;
  private debugWaypointMarkers: Mesh[] = [];
  private debugDirectionArrow: Mesh | null = null;

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

      // GLB imports set rotationQuaternion which overrides .rotation - clear it
      this.mesh.rotationQuaternion = null;

      // Normalize model height so all characters are the same size
      const TARGET_HEIGHT = 1.8;
      const bounds = this.mesh.getHierarchyBoundingVectors();
      const currentHeight = bounds.max.y - bounds.min.y;
      if (currentHeight > 0) {
        const scaleFactor = TARGET_HEIGHT / currentHeight;
        this.mesh.scaling.setAll(scaleFactor);
        console.log(`[PlayerController] Scaled model: ${currentHeight.toFixed(2)} → ${TARGET_HEIGHT} (factor: ${scaleFactor.toFixed(2)})`);
      }

      // Stop all animations initially
      this.animationGroups.forEach(anim => anim.stop());

      // Find walk animation - prefer Standard_Walk
      this.walkAnimation = this.animationGroups.find(anim =>
        anim.name === 'Standard_Walk'
      ) || this.animationGroups.find(anim =>
        anim.name.toLowerCase().includes('walk')
      ) || null;

      // Start walk animation immediately so character isn't in T-pose
      if (this.walkAnimation) {
        this.walkAnimation.start(true);
        this.currentAnimation = this.walkAnimation.name;
      }

      // Create direction arrow above the character
      this.createDirectionArrow();

      // Set to origin - the server will send the correct position
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
   * Create a direction arrow above the character to show facing.
   * Not parented to mesh (avoids GLB scaling/rotation issues).
   * Updated manually in the update loop.
   */
  private createDirectionArrow(): void {
    // Cone pointing up by default; we'll rotate it each frame to match movement
    const arrow = MeshBuilder.CreateCylinder('dirArrow', {
      diameterTop: 0,
      diameterBottom: 0.3,
      height: 0.5,
      tessellation: 8,
    }, this.scene);

    const arrowMat = new StandardMaterial('dirArrowMat', this.scene);
    arrowMat.diffuseColor = new Color3(0, 1, 0.5);
    arrowMat.emissiveColor = new Color3(0, 0.4, 0.2);
    arrowMat.alpha = 0.8;
    arrow.material = arrowMat;

    // Tip cone forward along +Z by rotating around X
    arrow.rotation.x = Math.PI / 2;

    // Position above character
    arrow.position = this.position.clone();
    arrow.position.y = 2.2;

    this.debugDirectionArrow = arrow;
  }

  /**
   * Update direction arrow position and rotation to match movement
   */
  private updateDirectionArrow(direction: Vector3): void {
    if (!this.debugDirectionArrow) return;

    // Position above character head
    this.debugDirectionArrow.position.x = this.position.x;
    this.debugDirectionArrow.position.y = 2.2;
    this.debugDirectionArrow.position.z = this.position.z;

    // Point the arrow in the movement direction
    // The cone tip points along +Z (rotation.x = PI/2), so rotation.y aligns it
    this.debugDirectionArrow.rotation.y = Math.atan2(direction.x, direction.z);
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

      // Show debug visuals
      this.showDebugVisuals(destination, validDestination, smoothPath);

      // Broadcast move command to server
      if (this.colyseusManager) {
        this.colyseusManager.sendMoveCommand(validDestination);
      }
    } else {
      console.warn('[PlayerController] No path found to destination');
    }
  }

  /**
   * Show debug visuals for click point, destination, and path
   */
  private showDebugVisuals(clickPoint: Vector3, destination: Vector3, path: Vector3[]): void {
    this.clearDebugVisuals();

    // Click destination marker - yellow disc on the ground
    this.debugClickMarker = MeshBuilder.CreateDisc('debugClickMarker', { radius: 0.3 }, this.scene);
    this.debugClickMarker.rotation.x = Math.PI / 2; // Lay flat
    this.debugClickMarker.position = new Vector3(destination.x, 0.05, destination.z);
    const markerMat = new StandardMaterial('debugClickMat', this.scene);
    markerMat.diffuseColor = new Color3(1, 1, 0); // Yellow
    markerMat.emissiveColor = new Color3(0.5, 0.5, 0);
    markerMat.alpha = 0.7;
    this.debugClickMarker.material = markerMat;

    // If click was snapped to a different position, show original click as red marker
    if (Vector3.Distance(clickPoint, destination) > 0.1) {
      const origMarker = MeshBuilder.CreateDisc('debugOrigClick', { radius: 0.2 }, this.scene);
      origMarker.rotation.x = Math.PI / 2;
      origMarker.position = new Vector3(clickPoint.x, 0.05, clickPoint.z);
      const origMat = new StandardMaterial('debugOrigClickMat', this.scene);
      origMat.diffuseColor = new Color3(1, 0, 0); // Red
      origMat.emissiveColor = new Color3(0.5, 0, 0);
      origMat.alpha = 0.5;
      origMarker.material = origMat;
      this.debugWaypointMarkers.push(origMarker);
    }

    // Path line from current position through all waypoints
    const fullPath = [this.position.clone(), ...path];
    const linePoints = fullPath.map(p => new Vector3(p.x, 0.08, p.z));

    if (linePoints.length >= 2) {
      this.debugPathLines = MeshBuilder.CreateLines('debugPathLine', {
        points: linePoints,
      }, this.scene);
      this.debugPathLines.color = new Color3(0, 1, 0.5); // Cyan-green
    }

    // Waypoint markers - small cyan spheres at intermediate waypoints
    for (let i = 0; i < path.length - 1; i++) {
      const wpMarker = MeshBuilder.CreateSphere(`debugWP_${i}`, { diameter: 0.2 }, this.scene);
      wpMarker.position = new Vector3(path[i].x, 0.1, path[i].z);
      const wpMat = new StandardMaterial(`debugWPMat_${i}`, this.scene);
      wpMat.diffuseColor = new Color3(0, 0.8, 1); // Cyan
      wpMat.emissiveColor = new Color3(0, 0.3, 0.5);
      wpMarker.material = wpMat;
      this.debugWaypointMarkers.push(wpMarker);
    }
  }

  /**
   * Clear all debug visuals
   */
  private clearDebugVisuals(): void {
    if (this.debugClickMarker) {
      this.debugClickMarker.dispose();
      this.debugClickMarker = null;
    }
    if (this.debugPathLines) {
      this.debugPathLines.dispose();
      this.debugPathLines = null;
    }
    this.debugWaypointMarkers.forEach(m => m.dispose());
    this.debugWaypointMarkers = [];
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

    // Rotate to face movement direction
    const targetRotationY = Math.atan2(direction.x, direction.z);
    this.rotation.y = this.lerpAngle(this.rotation.y, targetRotationY, this.rotationSpeed);

    // Update mesh position and rotation
    if (this.mesh) {
      this.mesh.position = this.position.clone();
      this.mesh.rotation.y = this.rotation.y;
    }

    // Update direction arrow to point along actual movement
    this.updateDirectionArrow(direction);

    // Broadcast position update (throttled)
    this.broadcastPosition();
  }

  /**
   * Stop movement and idle
   */
  private stopMovement(): void {
    this.isMoving = false;
    this.path = [];

    // Clear debug visuals when destination reached
    this.clearDebugVisuals();

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
   * Angle-aware linear interpolation (handles wrapping around PI/-PI)
   */
  private lerpAngle(start: number, end: number, factor: number): number {
    let delta = end - start;

    // Normalize to [-PI, PI] so we always take the shortest rotation
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
    return this.rotation.y;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.clearDebugVisuals();

    if (this.debugDirectionArrow) {
      this.debugDirectionArrow.dispose();
      this.debugDirectionArrow = null;
    }

    if (this.mesh) {
      this.mesh.dispose();
    }

    this.animationGroups.forEach(anim => anim.dispose());

    console.log('[PlayerController] Disposed');
  }
}
