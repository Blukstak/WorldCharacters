import { useEffect, useRef, useState } from 'react';
import { ColyseusManager } from '../multiplayer/ColyseusManager';

export interface UseColyseusOptions {
  enabled?: boolean;
  serverUrl?: string;
  roomName?: string;
  playerName?: string;
  modelPath?: string;
}

export interface UseColyseusReturn {
  manager: ColyseusManager | null;
  isConnected: boolean;
  playerCount: number;
  sessionId: string;
  error: string | null;
}

export function useColyseus(options: UseColyseusOptions = {}): UseColyseusReturn {
  const {
    enabled = false,
    serverUrl = 'ws://localhost:2567',
    roomName = 'game',
    playerName,
    modelPath,
  } = options;

  const managerRef = useRef<ColyseusManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;

    const connect = async () => {
      try {
        const manager = new ColyseusManager(serverUrl);
        managerRef.current = manager;

        await manager.connect(roomName, {
          name: playerName,
          modelPath,
        });

        if (disposed) {
          manager.disconnect();
          return;
        }

        setIsConnected(true);
        setSessionId(manager.getSessionId());
        setError(null);

        // Track player count using manager callbacks
        const updatePlayerCount = () => {
          const room = manager.getRoom();
          if (room) {
            const count = room.state.players.size;
            console.log('[useColyseus] Updating player count:', count);
            setPlayerCount(count);
          }
        };

        // Initial count
        updatePlayerCount();

        // Register callbacks for remote player join/leave
        manager.onRemotePlayerJoined(() => {
          console.log('[useColyseus] Remote player joined callback');
          updatePlayerCount();
        });

        manager.onRemotePlayerLeft(() => {
          console.log('[useColyseus] Remote player left callback');
          updatePlayerCount();
        });

        console.log('[useColyseus] Connected successfully');
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Connection failed');
          console.error('[useColyseus] Connection error:', err);
        }
      }
    };

    connect();

    return () => {
      disposed = true;
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
      setIsConnected(false);
      setPlayerCount(0);
      setSessionId('');
    };
  }, [enabled, serverUrl, roomName, playerName, modelPath]);

  return {
    manager: managerRef.current,
    isConnected,
    playerCount,
    sessionId,
    error,
  };
}
