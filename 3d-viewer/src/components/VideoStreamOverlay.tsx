import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
  type LocalTrackPublication,
} from 'livekit-client';
import { generateToken } from '../livekit/token';
import { LIVEKIT_CONFIG } from '../livekit/config';

interface VideoStreamOverlayProps {
  roomName?: string;
  participantName?: string;
  onRoomReady?: (room: Room) => void;
  onDataReceived?: (data: Uint8Array, participant: RemoteParticipant) => void;
}

interface StreamTile {
  identity: string;
  element: HTMLMediaElement;
  isLocal: boolean;
}

export function VideoStreamOverlay({
  roomName = LIVEKIT_CONFIG.defaultRoom,
  participantName,
  onRoomReady,
  onDataReceived,
}: VideoStreamOverlayProps) {
  const roomRef = useRef<Room | null>(null);
  const [tiles, setTiles] = useState<StreamTile[]>([]);
  const [status, setStatus] = useState<string>('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const tilesContainerRef = useRef<HTMLDivElement>(null);

  const addTile = useCallback((identity: string, element: HTMLMediaElement, isLocal: boolean) => {
    setTiles((prev) => {
      if (prev.some((t) => t.identity === identity && t.isLocal === isLocal)) return prev;
      return [...prev, { identity, element, isLocal }];
    });
  }, []);

  const removeTile = useCallback((identity: string) => {
    setTiles((prev) => prev.filter((t) => t.identity !== identity));
  }, []);

  useEffect(() => {
    let disposed = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h360.resolution,
      },
    });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (disposed) return;
      if (track.kind === Track.Kind.Video) {
        const el = track.attach();
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        addTile(participant.identity, el, false);
      } else if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      if (disposed) return;
      track.detach().forEach((el) => el.remove());
      removeTile(participant.identity);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (disposed) return;
      removeTile(participant.identity);
    });

    room.on(RoomEvent.Disconnected, () => {
      if (disposed) return;
      setIsConnected(false);
      setStatus('Disconnected');
      setTiles([]);
    });

    room.on(RoomEvent.DataReceived, (data: Uint8Array, participant?: RemoteParticipant) => {
      if (disposed || !participant) return;
      onDataReceived?.(data, participant);
    });

    room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      if (disposed) return;
      if (publication.track && publication.track.kind === Track.Kind.Video) {
        const el = publication.track.attach();
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        el.style.transform = 'scaleX(-1)';
        addTile(room.localParticipant.identity, el, true);
      }
    });

    const connect = async () => {
      try {
        const name = participantName || `user-${Math.random().toString(36).slice(2, 8)}`;
        setStatus('Generating token...');

        const token = await generateToken({
          roomName,
          participantName: name,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        });

        if (disposed) return;
        setStatus('Connecting to LiveKit...');

        await room.connect(LIVEKIT_CONFIG.wsUrl, token);
        if (disposed) return;

        setIsConnected(true);
        setStatus(`Connected as ${name}`);

        // Notify parent that room is ready for multiplayer
        onRoomReady?.(room);

        // Try to enable camera/mic but don't fail if unavailable
        try {
          await room.localParticipant.setCameraEnabled(true);
        } catch (camErr) {
          console.warn('[VideoStream] Camera unavailable:', camErr);
        }
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch (micErr) {
          console.warn('[VideoStream] Microphone unavailable:', micErr);
        }
      } catch (err) {
        if (disposed) return;
        console.error('[VideoStream] Connection error:', err);
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    connect();

    return () => {
      disposed = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [roomName, participantName, addTile, removeTile]);

  // Attach video elements to DOM tiles
  useEffect(() => {
    tiles.forEach((tile) => {
      const container = document.getElementById(`stream-tile-${tile.identity}-${tile.isLocal}`);
      if (container && !container.contains(tile.element)) {
        container.innerHTML = '';
        container.appendChild(tile.element);
      }
    });
  }, [tiles]);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 max-h-[80vh] overflow-y-auto">
      {/* Status badge */}
      <div
        className={`text-xs px-2 py-1 rounded-full ${
          isConnected
            ? 'bg-green-600/80 text-white'
            : 'bg-yellow-600/80 text-white'
        }`}
      >
        {status}
      </div>

      {/* Video tiles grid */}
      <div ref={tilesContainerRef} className="flex flex-wrap-reverse gap-2 justify-end max-w-[400px]">
        {tiles.map((tile) => (
          <div
            key={`${tile.identity}-${tile.isLocal}`}
            className="relative rounded-lg overflow-hidden border-2 shadow-lg"
            style={{
              width: '160px',
              height: '120px',
              borderColor: tile.isLocal ? '#7c3aed' : '#333',
              background: '#111',
            }}
          >
            <div
              id={`stream-tile-${tile.identity}-${tile.isLocal}`}
              className="w-full h-full"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
              {tile.isLocal ? `${tile.identity} (You)` : tile.identity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
