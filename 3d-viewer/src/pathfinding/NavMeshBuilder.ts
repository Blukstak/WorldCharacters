import { Scene, AbstractMesh, Vector3 } from '@babylonjs/core';
import * as YUKA from 'yuka';

/**
 * NavMeshBuilder converts Babylon.js meshes to Yuka NavMesh format
 * Handles walkable areas (floor) and obstacles for pathfinding
 */
export class NavMeshBuilder {
  private walkablePolygons: Array<{ vertices: Vector3[]; }> = [];
  private obstacles: Array<{ center: Vector3; radius: number; }> = [];

  /**
   * Add a walkable area from a Babylon mesh
   * Extracts floor geometry for navigation
   */
  addWalkableArea(mesh: AbstractMesh): void {
    if (!mesh.getBoundingInfo()) return;

    const bounds = mesh.getHierarchyBoundingVectors();
    const min = bounds.min;
    const max = bounds.max;

    // Create a simplified rectangular walkable area from bounding box
    // In production, this could be refined to use actual mesh geometry
    const vertices = [
      new Vector3(min.x, min.y, min.z),
      new Vector3(max.x, min.y, min.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(min.x, min.y, max.z),
    ];

    this.walkablePolygons.push({ vertices });
  }

  /**
   * Add an obstacle from a Babylon mesh
   * Registers collision geometry for pathfinding avoidance
   */
  addObstacle(mesh: AbstractMesh): void {
    if (!mesh.getBoundingInfo()) return;

    const bounds = mesh.getHierarchyBoundingVectors();
    const center = bounds.max.add(bounds.min).scale(0.5);
    const size = bounds.max.subtract(bounds.min);
    const radius = Math.max(size.x, size.z) * 0.5;

    this.obstacles.push({ center, radius });
  }

  /**
   * Build Yuka NavMesh from collected geometry
   * Returns navmesh ready for pathfinding
   */
  build(): YUKA.NavMesh {
    const navMesh = new YUKA.NavMesh();

    // Create navmesh regions from walkable polygons
    // For simplicity, we use a graph-based approach with nodes
    if (this.walkablePolygons.length > 0) {
      const polygon = this.walkablePolygons[0];
      const vertices = polygon.vertices;

      // Convert Babylon Vector3 to Yuka Vector3
      const yukaVertices = vertices.map(v =>
        new YUKA.Vector3(v.x, v.y, v.z)
      );

      // Create polygon for navmesh
      const navPolygon = new YUKA.Polygon().fromContour(yukaVertices);

      // Calculate centroid manually (average of all vertices)
      const centroid = new YUKA.Vector3();
      for (const v of yukaVertices) {
        centroid.add(v);
      }
      centroid.divideScalar(yukaVertices.length);

      navMesh.regions.push({
        polygon: navPolygon,
        centroid: centroid,
        neighbors: []
      } as any); // Type assertion for Yuka internal structure
    }

    return navMesh;
  }

  /**
   * Check if a position collides with any obstacles
   * Used for validating paths and waypoints
   */
  isPositionBlocked(position: Vector3, safetyMargin: number = 1.5): boolean {
    for (const obstacle of this.obstacles) {
      const distance = Vector3.Distance(position, obstacle.center);
      if (distance < (obstacle.radius + safetyMargin)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all obstacles for external collision checks
   */
  getObstacles(): Array<{ center: Vector3; radius: number; }> {
    return this.obstacles;
  }

  /**
   * Reset builder state
   */
  clear(): void {
    this.walkablePolygons = [];
    this.obstacles = [];
  }
}

/**
 * Utility: Build navmesh from scene automatically
 * Identifies floor and obstacle meshes by naming convention
 */
export function buildNavMeshFromScene(scene: Scene): {
  navMesh: YUKA.NavMesh;
  builder: NavMeshBuilder;
} {
  const builder = new NavMeshBuilder();

  // Find floor mesh
  const floor = scene.getMeshByName('floor');
  if (floor) {
    builder.addWalkableArea(floor);
  }

  // Find obstacle meshes (walls, boxes, cylinders)
  const obstacles = scene.meshes.filter(mesh =>
    mesh.name.includes('obstacle') ||
    mesh.name.includes('wall') ||
    mesh.name.includes('box') ||
    mesh.name.includes('cylinder')
  );

  obstacles.forEach(obs => {
    if (obs.name !== 'floor') {
      builder.addObstacle(obs);
    }
  });

  const navMesh = builder.build();

  return { navMesh, builder };
}
