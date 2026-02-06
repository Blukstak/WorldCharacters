import { Schema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") modelPath: string = "";

  // Position
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;

  // Rotation (only Y axis for now)
  @type("number") rotationY: number = 0;

  // Animation state
  @type("string") animation: string = "idle";

  // Destination (for pathfinding sync)
  @type("number") destX: number = 0;
  @type("number") destZ: number = 0;
  @type("boolean") isMoving: boolean = false;

  @type("number") timestamp: number = 0;

  // Profile index for business card assignment
  @type("number") profileIndex: number = 0;
}
