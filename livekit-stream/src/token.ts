import { SignJWT } from 'jose';
import { LIVEKIT_CONFIG } from './config';

export interface TokenOptions {
  roomName: string;
  participantName: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}

export async function generateToken(options: TokenOptions): Promise<string> {
  const {
    roomName,
    participantName,
    canPublish = true,
    canSubscribe = true,
    canPublishData = true,
  } = options;

  const secret = new TextEncoder().encode(LIVEKIT_CONFIG.apiSecret);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    video: {
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    },
    sub: participantName,
    iss: LIVEKIT_CONFIG.apiKey,
    nbf: now,
    exp: now + 6 * 60 * 60,
    jti: participantName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret);

  return token;
}
