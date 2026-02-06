import { Vector3 } from '@babylonjs/core';
import { Room, RemoteParticipant, DataPacket_Kind } from 'livekit-client';
import type {
  MultiplayerMessage,
  PositionUpdate,
  PathUpdate,
  ParticipantJoined,
  ParticipantLeft,
} from './types';
import { RemotePlayer } from '../player/RemotePlayer';

/**
 * MultiplayerManager handles all multiplayer communication via LiveKit data channels
 * Manages remote player registry and message encoding/decoding
 */
export class MultiplayerManager {
  private room: Room | null = null;
  private localIdentity: string = '';
  private remotePlayers: Map<string, RemotePlayer> = new Map();

  // Message throttling
  private lastPositionSend = 0;
  private positionSendInterval = 50; // 20 Hz

  // Event callbacks
  private onPlayerJoinedCallbacks: Array<(identity: string, data: ParticipantJoined) => void> = [];
  private onPlayerLeftCallbacks: Array<(identity: string) => void> = [];

  // Text encoder/decoder for data channel
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor() {
    console.log('[MultiplayerManager] Initialized');
  }

  /**
   * Set LiveKit room and initialize event handlers
   */
  setRoom(room: Room): void {
    this.room = room;
    this.localIdentity = room.localParticipant.identity;

    console.log(`[MultiplayerManager] Room set, local identity: ${this.localIdentity}`);
  }

  /**
   * Send position update to all participants
   */
  sendPositionUpdate(position: Vector3, rotation: number, animation: string): void {
    if (!this.room) return;

    // Throttle updates
    const now = Date.now();
    if (now - this.lastPositionSend < this.positionSendInterval) {
      return;
    }

    const message: PositionUpdate = {
      type: 'position',
      identity: this.localIdentity,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { y: rotation },
      animation,
      timestamp: now,
    };

    this.sendMessage(message, DataPacket_Kind.LOSSY);
    this.lastPositionSend = now;
  }

  /**
   * Send path update (when player clicks destination)
   */
  sendPathUpdate(destination: Vector3): void {
    if (!this.room) return;

    const message: PathUpdate = {
      type: 'path',
      identity: this.localIdentity,
      destination: { x: destination.x, y: destination.y, z: destination.z },
      timestamp: Date.now(),
    };

    this.sendMessage(message, DataPacket_Kind.RELIABLE);
  }

  /**
   * Send join message to announce presence
   */
  sendJoinMessage(modelPath: string, position: Vector3): void {
    if (!this.room) return;

    const message: ParticipantJoined = {
      type: 'joined',
      identity: this.localIdentity,
      modelPath,
      position: { x: position.x, y: position.y, z: position.z },
      timestamp: Date.now(),
    };

    this.sendMessage(message, DataPacket_Kind.RELIABLE);
  }

  /**
   * Send leave message before disconnecting
   */
  sendLeaveMessage(): void {
    if (!this.room) return;

    const message: ParticipantLeft = {
      type: 'left',
      identity: this.localIdentity,
      timestamp: Date.now(),
    };

    this.sendMessage(message, DataPacket_Kind.RELIABLE);
  }

  /**
   * Send message via LiveKit data channel
   */
  private sendMessage(message: MultiplayerMessage, kind: DataPacket_Kind): void {
    if (!this.room) return;

    try {
      const json = JSON.stringify(message);
      const data = this.encoder.encode(json);

      this.room.localParticipant.publishData(data, { reliable: kind === DataPacket_Kind.RELIABLE });
    } catch (error) {
      console.error('[MultiplayerManager] Failed to send message:', error);
    }
  }

  /**
   * Handle incoming data from remote participants
   */
  onDataReceived(data: Uint8Array, participant: RemoteParticipant): void {
    try {
      const json = this.decoder.decode(data);
      const message: MultiplayerMessage = JSON.parse(json);

      // Ignore messages from self (shouldn't happen but safeguard)
      if (message.identity === this.localIdentity) {
        return;
      }

      this.handleMessage(message, participant);
    } catch (error) {
      console.error('[MultiplayerManager] Failed to parse data:', error);
    }
  }

  /**
   * Handle parsed multiplayer message
   */
  private handleMessage(message: MultiplayerMessage, _participant: RemoteParticipant): void {
    switch (message.type) {
      case 'position':
        this.handlePositionUpdate(message);
        break;

      case 'path':
        this.handlePathUpdate(message);
        break;

      case 'joined':
        this.handlePlayerJoined(message);
        break;

      case 'left':
        this.handlePlayerLeft(message);
        break;

      default:
        console.warn('[MultiplayerManager] Unknown message type:', message);
    }
  }

  /**
   * Handle position update from remote player
   */
  private handlePositionUpdate(message: PositionUpdate): void {
    const player = this.remotePlayers.get(message.identity);
    if (player) {
      player.receiveUpdate(message);
    } else {
      console.warn(`[MultiplayerManager] Received position from unknown player: ${message.identity}`);
    }
  }

  /**
   * Handle path update from remote player
   */
  private handlePathUpdate(message: PathUpdate): void {
    // Path updates could be used for exact path replication
    // Currently we just use position updates for smooth interpolation
    console.log(`[MultiplayerManager] Player ${message.identity} moving to`, message.destination);
  }

  /**
   * Handle player joined event
   */
  private handlePlayerJoined(message: ParticipantJoined): void {
    console.log(`[MultiplayerManager] Player joined: ${message.identity}`);

    // Notify callbacks
    this.onPlayerJoinedCallbacks.forEach(callback => {
      callback(message.identity, message);
    });
  }

  /**
   * Handle player left event
   */
  private handlePlayerLeft(message: ParticipantLeft): void {
    console.log(`[MultiplayerManager] Player left: ${message.identity}`);

    // Remove remote player
    const player = this.remotePlayers.get(message.identity);
    if (player) {
      player.dispose();
      this.remotePlayers.delete(message.identity);
    }

    // Notify callbacks
    this.onPlayerLeftCallbacks.forEach(callback => {
      callback(message.identity);
    });
  }

  /**
   * Register callback for player joined events
   */
  onRemotePlayerJoined(callback: (identity: string, data: ParticipantJoined) => void): void {
    this.onPlayerJoinedCallbacks.push(callback);
  }

  /**
   * Register callback for player left events
   */
  onRemotePlayerLeft(callback: (identity: string) => void): void {
    this.onPlayerLeftCallbacks.push(callback);
  }

  /**
   * Register a remote player instance
   */
  registerRemotePlayer(identity: string, player: RemotePlayer): void {
    this.remotePlayers.set(identity, player);
    console.log(`[MultiplayerManager] Registered remote player: ${identity}`);
  }

  /**
   * Update all remote players (call each frame)
   */
  updateRemotePlayers(deltaTime: number = 0.016): void {
    this.remotePlayers.forEach(player => {
      player.update(deltaTime);
    });
  }

  /**
   * Get remote player by identity
   */
  getRemotePlayer(identity: string): RemotePlayer | undefined {
    return this.remotePlayers.get(identity);
  }

  /**
   * Check if remote player exists
   */
  hasRemotePlayer(identity: string): boolean {
    return this.remotePlayers.has(identity);
  }

  /**
   * Get all remote player identities
   */
  getRemotePlayerIdentities(): string[] {
    return Array.from(this.remotePlayers.keys());
  }

  /**
   * Get remote player count
   */
  getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  /**
   * Set position update rate (in Hz)
   */
  setPositionUpdateRate(hz: number): void {
    this.positionSendInterval = Math.max(10, 1000 / hz);
    console.log(`[MultiplayerManager] Position update rate set to ${hz} Hz`);
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Send leave message
    this.sendLeaveMessage();

    // Dispose all remote players
    this.remotePlayers.forEach(player => player.dispose());
    this.remotePlayers.clear();

    // Clear callbacks
    this.onPlayerJoinedCallbacks = [];
    this.onPlayerLeftCallbacks = [];

    this.room = null;

    console.log('[MultiplayerManager] Cleaned up');
  }

  /**
   * Get current room
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Get local identity
   */
  getLocalIdentity(): string {
    return this.localIdentity;
  }
}
