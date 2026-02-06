import { useEffect, useRef, useState, useCallback } from 'react';
import { MultiplayerManager } from '../multiplayer/MultiplayerManager';

export interface UseMultiplayerOptions {
  enabled?: boolean;
  participantName?: string;
  positionUpdateRate?: number; // Hz (10-20 recommended)
}

export interface UseMultiplayerReturn {
  manager: MultiplayerManager | null;
  isReady: boolean;
  playerCount: number;
  connect: () => void;
  disconnect: () => void;
}

/**
 * React hook for managing multiplayer functionality
 * Initializes MultiplayerManager and handles lifecycle
 */
export function useMultiplayer(options: UseMultiplayerOptions = {}): UseMultiplayerReturn {
  const {
    enabled = false,
    positionUpdateRate = 20,
  } = options;

  const managerRef = useRef<MultiplayerManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  // Initialize manager on mount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Create manager if it doesn't exist
    if (!managerRef.current) {
      const manager = new MultiplayerManager();
      manager.setPositionUpdateRate(positionUpdateRate);

      // Register event callbacks
      manager.onRemotePlayerJoined((identity) => {
        console.log(`[useMultiplayer] Remote player joined: ${identity}`);
        setPlayerCount(manager.getRemotePlayerCount());
      });

      manager.onRemotePlayerLeft((identity) => {
        console.log(`[useMultiplayer] Remote player left: ${identity}`);
        setPlayerCount(manager.getRemotePlayerCount());
      });

      managerRef.current = manager;
    }

    return () => {
      // Cleanup on unmount or when disabled
      if (managerRef.current) {
        managerRef.current.cleanup();
        managerRef.current = null;
        setIsReady(false);
        setPlayerCount(0);
      }
    };
  }, [enabled, positionUpdateRate]);

  // Connect to multiplayer (called when room is ready)
  const connect = useCallback(() => {
    if (managerRef.current && managerRef.current.getRoom()) {
      setIsReady(true);
      console.log('[useMultiplayer] Connected to multiplayer');
    }
  }, []);

  // Disconnect from multiplayer
  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.cleanup();
      setIsReady(false);
      setPlayerCount(0);
      console.log('[useMultiplayer] Disconnected from multiplayer');
    }
  }, []);

  return {
    manager: managerRef.current,
    isReady,
    playerCount,
    connect,
    disconnect,
  };
}
