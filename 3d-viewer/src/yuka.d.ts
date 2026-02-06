// Type definitions for yuka pathfinding library
declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
  }

  export class Polygon {
    fromContour(vertices: Vector3[]): Polygon;
    centroid(): Vector3;
  }

  export class NavMesh {
    regions: NavMeshRegion[];
    constructor();
  }

  export interface NavMeshRegion {
    polygon: Polygon;
    centroid: Vector3;
    neighbors: NavMeshRegion[];
  }

  export class AStar {
    constructor();
    search(graph: any, source: any, target: any): any;
  }

  export class Graph {
    constructor();
    addNode(node: any): void;
    addEdge(from: any, to: any, cost: number): void;
  }

  export class Node {
    index: number;
    position: Vector3;
    constructor(index: number, position?: Vector3);
  }

  export class NavMeshGraph {
    constructor(navMesh: NavMesh);
    findPath(start: Vector3, end: Vector3): Vector3[] | null;
  }
}
