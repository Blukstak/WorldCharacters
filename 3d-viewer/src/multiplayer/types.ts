// Multiplayer message type definitions for data channel communication

/**
 * Position update message - sent frequently (10-20 Hz)
 * Used for real-time character position synchronization
 */
export interface PositionUpdate {
  type: 'position';
  identity: string;
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  animation: string;
  timestamp: number;
}

/**
 * Path update message - sent when player clicks new destination
 * Used to share pathfinding destinations
 */
export interface PathUpdate {
  type: 'path';
  identity: string;
  destination: { x: number; y: number; z: number };
  timestamp: number;
}

/**
 * Participant joined message - sent once when joining room
 * Announces new player to existing participants
 */
export interface ParticipantJoined {
  type: 'joined';
  identity: string;
  modelPath: string;
  position: { x: number; y: number; z: number };
  timestamp: number;
}

/**
 * Participant left message - sent when player disconnects
 * Cleanup signal for remote player removal
 */
export interface ParticipantLeft {
  type: 'left';
  identity: string;
  timestamp: number;
}

/**
 * Union type of all multiplayer messages
 */
export type MultiplayerMessage =
  | PositionUpdate
  | PathUpdate
  | ParticipantJoined
  | ParticipantLeft;

/**
 * Configuration options for multiplayer manager
 */
export interface MultiplayerConfig {
  positionUpdateRate: number; // Updates per second (10-20 recommended)
  interpolationSpeed: number; // Lerp factor for smooth movement (0.1-0.2 recommended)
  enablePrediction: boolean; // Dead reckoning for packet loss
}

/**
 * Remote player state
 */
export interface RemotePlayerState {
  identity: string;
  modelPath: string;
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  animation: string;
  lastUpdateTime: number;
}
