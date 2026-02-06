import { Server } from 'colyseus';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom';

const port = Number(process.env.PORT || 2567);

// Create HTTP server
const httpServer = createServer();

// Create Colyseus server
const gameServer = new Server({
  server: httpServer,
});

// Register room handlers
gameServer.define('game_room', GameRoom);

// Start HTTP server
httpServer.listen(port, () => {
  console.log(`[Colyseus] Server listening on ws://localhost:${port}`);
});
