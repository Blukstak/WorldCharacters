import { Scene, Vector3 } from '@babylonjs/core';
import * as YUKA from 'yuka';
import { NavMeshBuilder, buildNavMeshFromScene } from './NavMeshBuilder';

/**
 * PathfindingManager provides path calculation for character navigation
 * Wraps Yuka.js pathfinding with Babylon.js integration
 */
export class PathfindingManager {
  private navMesh: YUKA.NavMesh | null = null;
  private builder: NavMeshBuilder | null = null;
  private isInitialized = false;

  /**
   * Initialize pathfinding system from scene geometry
   * Builds navmesh from floor and obstacles
   */
  initialize(scene: Scene): void {
    console.log('[PathfindingManager] Initializing pathfinding system...');

    const result = buildNavMeshFromScene(scene);
    this.navMesh = result.navMesh;
    this.builder = result.builder;

    // Use simple obstacle-aware pathfinding (NavMeshGraph doesn't exist in YUKA 0.7.8)
    if (this.navMesh && this.builder) {
      this.isInitialized = true;
      console.log('[PathfindingManager] Pathfinding initialized successfully (simple mode)');
    } else {
      console.warn('[PathfindingManager] Failed to build navmesh');
    }
  }

  /**
   * Find path from start to end position
   * Returns array of waypoints or null if no path found
   */
  findPath(start: Vector3, end: Vector3): Vector3[] | null {
    if (!this.isInitialized) {
      console.warn('[PathfindingManager] Pathfinding not initialized');
      return this.createSimplePath(start, end);
    }

    // Check if destination is blocked
    if (this.builder?.isPositionBlocked(end)) {
      console.warn('[PathfindingManager] Destination is blocked by obstacle');
      // Try to find closest walkable position
      const walkableEnd = this.getClosestWalkablePosition(end);
      if (Vector3.Distance(walkableEnd, end) > 5) {
        return null; // Too far from requested position
      }
      end = walkableEnd;
    }

    // Use simple obstacle-aware pathfinding
    return this.createSimplePath(start, end);
  }

  /**
   * Create simple direct path when pathfinding unavailable
   * Useful for fallback when navmesh isn't ready
   */
  private createSimplePath(start: Vector3, end: Vector3): Vector3[] {
    // Check if direct path is blocked
    if (this.builder) {
      const midpoint = start.add(end).scale(0.5);
      if (!this.builder.isPositionBlocked(midpoint)) {
        return [end];
      }

      // Try to find waypoint around obstacle
      const obstacles = this.builder.getObstacles();
      if (obstacles.length > 0) {
        // Simple obstacle avoidance: go around the first obstacle
        const obs = obstacles[0];
        const toObstacle = obs.center.subtract(start);
        const perpendicular = new Vector3(-toObstacle.z, 0, toObstacle.x).normalize();

        const waypoint1 = obs.center.add(perpendicular.scale(obs.radius + 2));
        const waypoint2 = obs.center.subtract(perpendicular.scale(obs.radius + 2));

        // Choose waypoint closer to destination
        const dist1 = Vector3.Distance(waypoint1, end);
        const dist2 = Vector3.Distance(waypoint2, end);

        return dist1 < dist2 ? [waypoint1, end] : [waypoint2, end];
      }
    }

    // Direct path if no obstacles detected
    return [end];
  }

  /**
   * Check if position is walkable
   * Validates if character can move to this location
   */
  isWalkable(position: Vector3): boolean {
    if (!this.builder) return true;
    return !this.builder.isPositionBlocked(position);
  }

  /**
   * Get closest walkable position to target
   * Useful for snapping clicks to valid locations
   */
  getClosestWalkablePosition(position: Vector3, searchRadius: number = 5): Vector3 {
    if (this.isWalkable(position)) {
      return position;
    }

    // Sample points around target to find walkable spot
    const samples = 8;
    for (let radius = 1; radius <= searchRadius; radius += 1) {
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const testPos = position.add(
          new Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
          )
        );

        if (this.isWalkable(testPos)) {
          return testPos;
        }
      }
    }

    // Return original if no walkable position found
    return position;
  }

  /**
   * Smooth path by removing unnecessary waypoints
   * Improves path quality and reduces turns
   */
  smoothPath(path: Vector3[]): Vector3[] {
    if (path.length <= 2) return path;

    const smoothed: Vector3[] = [path[0]];
    let currentIndex = 0;

    while (currentIndex < path.length - 1) {
      // Look ahead to find furthest visible waypoint
      let furthestIndex = currentIndex + 1;

      for (let i = path.length - 1; i > currentIndex + 1; i--) {
        if (this.hasLineOfSight(path[currentIndex], path[i])) {
          furthestIndex = i;
          break;
        }
      }

      smoothed.push(path[furthestIndex]);
      currentIndex = furthestIndex;
    }

    return smoothed;
  }

  /**
   * Check if there's direct line of sight between two points
   * Used for path smoothing
   */
  private hasLineOfSight(start: Vector3, end: Vector3): boolean {
    if (!this.builder) return true;

    const direction = end.subtract(start);
    const distance = direction.length();
    const steps = Math.ceil(distance);

    direction.normalize();

    for (let i = 0; i <= steps; i++) {
      const testPos = start.add(direction.scale((i / steps) * distance));
      if (this.builder.isPositionBlocked(testPos, 1.0)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup pathfinding resources
   */
  dispose(): void {
    this.navMesh = null;
    this.builder = null;
    this.graph = null;
    this.isInitialized = false;
    console.log('[PathfindingManager] Disposed');
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
