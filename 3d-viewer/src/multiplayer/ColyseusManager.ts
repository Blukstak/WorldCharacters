import { Client, Room } from 'colyseus.js';
import { Vector3 } from '@babylonjs/core';
import { RemotePlayer } from '../player/RemotePlayer';
import type { GameState } from '../../../colyseus-server/src/schema/GameState';
import type { Player as PlayerSchema } from '../../../colyseus-server/src/schema/Player';

export class ColyseusManager {
  private client: Client;
  private room: Room<GameState> | null = null;
  private remotePlayers: Map<string, RemotePlayer> = new Map();

  // Callbacks
  private onPlayerJoinedCallbacks: Array<(sessionId: string, player: PlayerSchema) => void> = [];
  private onPlayerLeftCallbacks: Array<(sessionId: string) => void> = [];

  constructor(serverUrl: string = 'ws://localhost:2567') {
    this.client = new Client(serverUrl);
    console.log('[ColyseusManager] Initialized with server:', serverUrl);
  }

  async connect(roomName: string, options: { name?: string; modelPath?: string }): Promise<void> {
    try {
      console.log('[ColyseusManager] Attempting to join/create room...');
      const joinOptions: Record<string, string> = {
        name: options.name || `Player-${Math.random().toString(36).substr(2, 9)}`,
      };
      // Only send modelPath if explicitly provided - let server pick randomly
      if (options.modelPath) {
        joinOptions.modelPath = options.modelPath;
      }
      this.room = await this.client.joinOrCreate<GameState>('game_room', joinOptions);

      console.log('[ColyseusManager] Connected to room:', this.room.id);

      // Set up error handler first
      this.room.onError((code, message) => {
        console.error('[ColyseusManager] Room error:', code, message);
      });

      this.room.onLeave((code) => {
        console.log('[ColyseusManager] Left room with code:', code);
      });

      // Wait for initial state synchronization before setting up handlers
      await new Promise<void>((resolve) => {
        if (this.room!.state && this.room!.state.players) {
          // State already synced
          console.log('[ColyseusManager] State already synced');
          resolve();
        } else {
          // Wait for first state change
          console.log('[ColyseusManager] Waiting for initial state sync...');
          this.room!.onStateChange.once((state) => {
            console.log('[ColyseusManager] Initial state received');
            console.log('[ColyseusManager] Players map exists:', !!state.players);
            resolve();
          });
        }
      });

      this.setupRoomHandlers();
      console.log('[ColyseusManager] Room handlers set up successfully');
    } catch (error) {
      console.error('[ColyseusManager] Failed to connect:', error);
      console.error('[ColyseusManager] Error name:', error instanceof Error ? error.name : 'unknown');
      console.error('[ColyseusManager] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[ColyseusManager] Error stack:', error instanceof Error ? error.stack : 'no stack');
      throw error;
    }
  }

  private setupRoomHandlers(): void {
    if (!this.room) {
      console.error('[ColyseusManager] setupRoomHandlers: room is null!');
      return;
    }

    try {
      console.log('[ColyseusManager] Setting up room handlers...');

      // Listen for server broadcast when new players join
      console.log('[ColyseusManager] Setting up playerJoined message handler');

      this.room.onMessage('playerJoined', (message: any) => {
        console.log('[ColyseusManager] 🎯 playerJoined message received!', message);

        const sessionId = message.sessionId;

        // Wait for player to appear in state (state sync might be delayed)
        const checkPlayer = (attempts: number = 0) => {
          const player = this.room!.state.players.get(sessionId);

          if (!player) {
            if (attempts < 10) {
              console.log('[ColyseusManager] Player not in state yet, retrying...', attempts);
              setTimeout(() => checkPlayer(attempts + 1), 100);
            } else {
              console.warn('[ColyseusManager] Player not found in state after retries:', sessionId);
            }
            return;
          }

          console.log('[ColyseusManager] Remote player joined:', sessionId, player.name);
          console.log('[ColyseusManager] Notifying', this.onPlayerJoinedCallbacks.length, 'callbacks');

          // Notify callbacks
          this.onPlayerJoinedCallbacks.forEach(cb => {
            console.log('[ColyseusManager] Calling join callback...');
            cb(sessionId, player);
          });
        };

        checkPlayer();
      });

      // Schema v3 API: Use onRemove for deletions
      this.room.state.players.onRemove = (player: PlayerSchema, sessionId: string) => {
        console.log('[ColyseusManager] Player removed:', sessionId);

        // Cleanup remote player
        const remotePlayer = this.remotePlayers.get(sessionId);
        if (remotePlayer) {
          remotePlayer.dispose();
          this.remotePlayers.delete(sessionId);
        }

        // Notify callbacks
        this.onPlayerLeftCallbacks.forEach(cb => cb(sessionId));
      };

      // Also iterate existing players in the room
      this.room.state.players.forEach((player: PlayerSchema, sessionId: string) => {
        if (sessionId !== this.room?.sessionId) {
          console.log('[ColyseusManager] Existing player found:', sessionId, player.name);
          this.onPlayerJoinedCallbacks.forEach(cb => cb(sessionId, player));
        }
      });

      console.log('[ColyseusManager] Handlers attached successfully');
    } catch (error) {
      console.error('[ColyseusManager] Error in setupRoomHandlers:', error);
      console.error('[ColyseusManager] Error details:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Send click-to-move command
  sendMoveCommand(destination: Vector3): void {
    if (!this.room) return;

    this.room.send('move', {
      x: destination.x,
      z: destination.z,
    });
  }

  // Send position update (from local pathfinding)
  sendPositionUpdate(position: Vector3, rotation: number): void {
    if (!this.room) return;

    this.room.send('position', {
      x: position.x,
      y: position.y,
      z: position.z,
      rotationY: rotation,
    });
  }

  // Send movement stop
  sendStopCommand(): void {
    if (!this.room) return;
    this.room.send('stop');
  }

  // Register remote player instance
  registerRemotePlayer(sessionId: string, player: RemotePlayer): void {
    this.remotePlayers.set(sessionId, player);
  }

  // Update remote players based on Colyseus state
  updateRemotePlayers(deltaTime: number = 0.016): void {
    if (!this.room) return;

    this.remotePlayers.forEach((remotePlayer, sessionId) => {
      const playerState = this.room!.state.players.get(sessionId);
      if (playerState) {
        // Update remote player with server state
        remotePlayer.updateFromSchema(playerState);
      }
      remotePlayer.update(deltaTime);
    });
  }

  // Event callbacks
  onRemotePlayerJoined(callback: (sessionId: string, player: PlayerSchema) => void): void {
    this.onPlayerJoinedCallbacks.push(callback);
  }

  onRemotePlayerLeft(callback: (sessionId: string) => void): void {
    this.onPlayerLeftCallbacks.push(callback);
  }

  getRoom(): Room<GameState> | null {
    return this.room;
  }

  getSessionId(): string {
    return this.room?.sessionId || '';
  }

  getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }

    // Cleanup remote players
    this.remotePlayers.forEach(player => player.dispose());
    this.remotePlayers.clear();

    console.log('[ColyseusManager] Disconnected');
  }
}
