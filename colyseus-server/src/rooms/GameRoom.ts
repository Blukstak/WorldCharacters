import { Room, Client } from 'colyseus';
import { GameState } from '../schema/GameState';
import { Player } from '../schema/Player';

export class GameRoom extends Room<GameState> {
  maxClients = 20;
  private modelIndex = 0;

  onCreate(options: any) {
    this.setState(new GameState());

    // Server time sync (optional but helpful)
    this.setSimulationInterval((deltaTime) => {
      this.state.serverTime += deltaTime;
    }, 100); // 10 Hz server tick

    console.log('[GameRoom] Room created:', this.roomId);

    // Set up message handlers once for the room
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    // Handle click-to-move
    this.onMessage('move', (client, message: { x: number; z: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Basic validation: destination in bounds
      const AREA_SIZE = 50;
      const validX = Math.max(-AREA_SIZE / 2, Math.min(AREA_SIZE / 2, message.x));
      const validZ = Math.max(-AREA_SIZE / 2, Math.min(AREA_SIZE / 2, message.z));

      player.destX = validX;
      player.destZ = validZ;
      player.isMoving = true;
      player.animation = 'walk';
      player.timestamp = Date.now();

      console.log(`[GameRoom] Player ${player.name} moving to (${validX}, ${validZ})`);
    });

    // Handle position updates (from client pathfinding)
    this.onMessage('position', (client, message: { x: number; y: number; z: number; rotationY: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Update position (server trusts client for now - can add validation later)
      player.x = message.x;
      player.y = message.y;
      player.z = message.z;
      player.rotationY = message.rotationY;
      player.timestamp = Date.now();
    });

    // Handle movement stop
    this.onMessage('stop', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.isMoving = false;
      player.animation = 'idle';
    });
  }

  onJoin(client: Client, options: any) {
    console.log('[GameRoom] Player joined:', client.sessionId, options);

    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || `Player-${client.sessionId.substr(0, 6)}`;

    // Alternate model selection for visual variety
    const AVAILABLE_MODELS = [
      '/models/GreenGuy_Animated.glb',
      '/models/BusinessMan.glb',
    ];
    player.modelPath = options.modelPath ||
      AVAILABLE_MODELS[this.modelIndex++ % AVAILABLE_MODELS.length];

    // Random spawn position to avoid players overlapping
    const spawnRadius = 10;
    player.x = (Math.random() - 0.5) * spawnRadius;
    player.y = 0;
    player.z = (Math.random() - 0.5) * spawnRadius;

    // Set initial animation state so remote players see animation immediately
    player.animation = 'walk';
    player.isMoving = false;

    console.log(`[GameRoom] Player ${player.name} spawning at (${player.x.toFixed(1)}, ${player.z.toFixed(1)}) with model: ${player.modelPath}, animation: ${player.animation}`);

    this.state.players.set(client.sessionId, player);

    // Broadcast to all OTHER clients that a new player joined
    this.broadcast('playerJoined', {
      sessionId: client.sessionId,
      name: player.name,
      modelPath: player.modelPath,
      x: player.x,
      y: player.y,
      z: player.z,
    }, { except: client });

    console.log(`[GameRoom] Broadcast playerJoined to other clients`);
  }

  onLeave(client: Client, consented: boolean) {
    console.log('[GameRoom] Player left:', client.sessionId, 'consented:', consented);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log('[GameRoom] Room disposed:', this.roomId);
  }
}
