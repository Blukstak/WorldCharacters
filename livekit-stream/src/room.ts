import {
  Room,
  RoomEvent,
  VideoPresets,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalParticipant,
} from 'livekit-client';
import { LIVEKIT_CONFIG } from './config';

export interface RoomCallbacks {
  onConnected: (localParticipant: LocalParticipant) => void;
  onTrackSubscribed: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => void;
  onTrackUnsubscribed: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
  onParticipantCountChanged: (count: number) => void;
}

let currentRoom: Room | null = null;

export async function connectToRoom(
  token: string,
  isPublisher: boolean,
  callbacks: RoomCallbacks,
): Promise<Room> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
  });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    callbacks.onTrackSubscribed(
      track as RemoteTrack,
      publication,
      participant,
    );
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    callbacks.onTrackUnsubscribed(
      track as RemoteTrack,
      publication,
      participant,
    );
  });

  room.on(RoomEvent.Disconnected, () => {
    callbacks.onDisconnected();
  });

  room.on(RoomEvent.ParticipantConnected, () => {
    callbacks.onParticipantCountChanged(getParticipantCount(room));
  });

  room.on(RoomEvent.ParticipantDisconnected, () => {
    callbacks.onParticipantCountChanged(getParticipantCount(room));
  });

  try {
    console.log(`[LiveKit] Connecting to ${LIVEKIT_CONFIG.wsUrl}`);
    await room.connect(LIVEKIT_CONFIG.wsUrl, token);
    console.log('[LiveKit] Connection established');

    currentRoom = room;

    if (isPublisher) {
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
    }

    callbacks.onConnected(room.localParticipant);
    callbacks.onParticipantCountChanged(getParticipantCount(room));
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }

  return room;
}

export async function disconnectFromRoom(): Promise<void> {
  if (currentRoom) {
    await currentRoom.disconnect();
    currentRoom = null;
  }
}

export async function toggleMicrophone(): Promise<boolean> {
  if (!currentRoom) return false;
  const enabled = currentRoom.localParticipant.isMicrophoneEnabled;
  await currentRoom.localParticipant.setMicrophoneEnabled(!enabled);
  return !enabled;
}

export async function toggleCamera(): Promise<boolean> {
  if (!currentRoom) return false;
  const enabled = currentRoom.localParticipant.isCameraEnabled;
  await currentRoom.localParticipant.setCameraEnabled(!enabled);
  return !enabled;
}

function getParticipantCount(room: Room): number {
  return room.remoteParticipants.size + 1;
}
