import { generateToken } from './token';
import {
  connectToRoom,
  disconnectFromRoom,
  toggleMicrophone,
  toggleCamera,
} from './room';
import {
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalParticipant,
} from 'livekit-client';

const joinForm = document.getElementById('join-form') as HTMLDivElement;
const roomView = document.getElementById('room-view') as HTMLDivElement;
const roomNameInput = document.getElementById('room-name') as HTMLInputElement;
const participantNameInput = document.getElementById('participant-name') as HTMLInputElement;
const btnPublish = document.getElementById('btn-publish') as HTMLButtonElement;
const btnViewer = document.getElementById('btn-viewer') as HTMLButtonElement;
const videoGrid = document.getElementById('video-grid') as HTMLDivElement;
const roomTitle = document.getElementById('room-title') as HTMLSpanElement;
const participantCount = document.getElementById('participant-count') as HTMLSpanElement;
const btnToggleMic = document.getElementById('btn-toggle-mic') as HTMLButtonElement;
const btnToggleCamera = document.getElementById('btn-toggle-camera') as HTMLButtonElement;
const btnLeave = document.getElementById('btn-leave') as HTMLButtonElement;
const statusBar = document.getElementById('status-bar') as HTMLDivElement;

let isPublisher = false;
let micEnabled = true;
let cameraEnabled = true;

btnPublish.addEventListener('click', () => joinRoom(true));
btnViewer.addEventListener('click', () => joinRoom(false));
btnToggleMic.addEventListener('click', handleToggleMic);
btnToggleCamera.addEventListener('click', handleToggleCamera);
btnLeave.addEventListener('click', handleLeave);

async function joinRoom(asPublisher: boolean): Promise<void> {
  const roomName = roomNameInput.value.trim();
  const participantName = participantNameInput.value.trim();

  if (!roomName || !participantName) {
    setStatus('Please enter room name and your name', 'error');
    return;
  }

  isPublisher = asPublisher;
  setStatus('Generating token...', 'info');

  try {
    const token = await generateToken({
      roomName,
      participantName,
      canPublish: asPublisher,
      canSubscribe: true,
      canPublishData: true,
    });

    setStatus('Connecting...', 'info');

    await connectToRoom(token, asPublisher, {
      onConnected: handleConnected,
      onTrackSubscribed: handleTrackSubscribed,
      onTrackUnsubscribed: handleTrackUnsubscribed,
      onDisconnected: handleDisconnected,
      onError: handleError,
      onParticipantCountChanged: handleParticipantCount,
    });

    joinForm.style.display = 'none';
    roomView.style.display = 'flex';
    roomTitle.textContent = roomName;
    setStatus('Connected', 'success');

    btnToggleMic.style.display = asPublisher ? 'inline-block' : 'none';
    btnToggleCamera.style.display = asPublisher ? 'inline-block' : 'none';
  } catch (error) {
    setStatus(`Connection failed: ${error}`, 'error');
  }
}

function handleConnected(localParticipant: LocalParticipant): void {
  console.log(`Connected as ${localParticipant.identity}`);

  if (isPublisher) {
    for (const pub of localParticipant.videoTrackPublications.values()) {
      if (pub.track) {
        const element = pub.track.attach();
        element.style.transform = 'scaleX(-1)';
        addVideoTile(localParticipant.identity ?? 'You', element, true);
      }
    }
  }
}

function handleTrackSubscribed(
  track: RemoteTrack,
  _publication: RemoteTrackPublication,
  participant: RemoteParticipant,
): void {
  if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
    const element = track.attach();
    if (track.kind === Track.Kind.Video) {
      addVideoTile(participant.identity ?? 'Unknown', element, false);
    } else {
      element.style.display = 'none';
      document.body.appendChild(element);
    }
  }
}

function handleTrackUnsubscribed(
  track: RemoteTrack,
  _publication: RemoteTrackPublication,
  participant: RemoteParticipant,
): void {
  track.detach().forEach((el) => el.remove());
  const tile = document.getElementById(`tile-${participant.identity}`);
  if (tile) tile.remove();
}

function handleDisconnected(): void {
  returnToJoinForm();
  setStatus('Disconnected from room', 'info');
}

function handleError(error: Error): void {
  setStatus(`Error: ${error.message}`, 'error');
}

function handleParticipantCount(count: number): void {
  participantCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

async function handleToggleMic(): Promise<void> {
  micEnabled = await toggleMicrophone();
  btnToggleMic.textContent = micEnabled ? 'Mic On' : 'Mic Off';
  btnToggleMic.classList.toggle('disabled', !micEnabled);
}

async function handleToggleCamera(): Promise<void> {
  cameraEnabled = await toggleCamera();
  btnToggleCamera.textContent = cameraEnabled ? 'Camera On' : 'Camera Off';
  btnToggleCamera.classList.toggle('disabled', !cameraEnabled);
}

async function handleLeave(): Promise<void> {
  await disconnectFromRoom();
  returnToJoinForm();
}

function addVideoTile(
  identity: string,
  mediaElement: HTMLMediaElement,
  isLocal: boolean,
): void {
  const tile = document.createElement('div');
  tile.className = `video-tile${isLocal ? ' local' : ''}`;
  tile.id = `tile-${identity}`;

  mediaElement.className = 'video-element';
  tile.appendChild(mediaElement);

  const label = document.createElement('div');
  label.className = 'video-label';
  label.textContent = isLocal ? `${identity} (You)` : identity;
  tile.appendChild(label);

  videoGrid.appendChild(tile);
}

function returnToJoinForm(): void {
  joinForm.style.display = 'flex';
  roomView.style.display = 'none';
  videoGrid.innerHTML = '';
  micEnabled = true;
  cameraEnabled = true;
  btnToggleMic.textContent = 'Mic On';
  btnToggleCamera.textContent = 'Camera On';
}

function setStatus(message: string, level: 'info' | 'error' | 'success'): void {
  statusBar.textContent = message;
  statusBar.className = `status-${level}`;
}
