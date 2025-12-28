// Protocol definitions for secure intranet chat
export const PROTOCOL_VERSION = '1.0.0';
export const MAX_MESSAGE_SIZE = 64 * 1024; // 64KB
export const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const NONCE_SIZE = 24; // XChaCha20-Poly1305
export const KEY_SIZE = 32;
export const CONTACT_REQUEST_TTL = 60 * 60 * 1000; // 1 hour

// Open/Demo server configuration for testing
export const OPEN_SERVER_CONFIG = {
  host: 'demo.securechat.local',
  port: 8080,
  useTLS: false,
  isOpenServer: true
};

export const FINGERPRINT_WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  'yankee', 'zulu', 'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'amber', 'bronze', 'coral', 'dusk', 'ember'
];

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  KEY_EXCHANGE = 'key_exchange',
  RECEIPT = 'receipt',
  PRESENCE = 'presence',
  CONTACT_REQUEST = 'contact_request',
  CONTACT_ACCEPT = 'contact_accept'
}

export enum MessageStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export enum WSEventType {
  MESSAGE = 'message',
  PRESENCE = 'presence',
  RECEIPT = 'receipt',
  ERROR = 'error',
  AUTH = 'auth',
  PING = 'ping',
  PONG = 'pong'
}

export interface IdentityKeyPair {
  publicKey: string; // Base64
  privateKey: string; // Base64
}

export interface SigningKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface PreKeyBundle {
  identityKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKey?: string;
  registrationId: number;
}

export interface TransportEnvelope {
  version: string;
  toUserId: string;
  fromUserId: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  ttl: number;
  ciphertext: string; // Base64 encoded
  nonce: string; // Base64 encoded
}

export interface E2EEPayload {
  type: MessageType;
  content: string;
  senderKeyRef: string;
  timestamp: number;
  padding?: string;
}

export interface SessionState {
  conversationId: string;
  contactId: string;
  rootKey: string;
  sendingChainKey: string;
  receivingChainKey: string;
  sendingRatchetKey: IdentityKeyPair;
  receivingRatchetKey: string;
  messageNumber: number;
  previousChainLength: number;
}

export interface User {
  id: string;
  username: string;
  identityKey: string;
  signedPreKey: string;
  createdAt: number;
}

export interface Contact {
  id: string;
  username: string;
  identityKey: string;
  verified: boolean;
  verifiedAt?: number;
  nickname?: string;
  lastSeen?: number;
  online?: boolean;
}

export interface ContactRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromPublicKey: string;
  fromFingerprint: string;
  toUserId: string;
  toUsername: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername?: string;
  receiverId: string;
  type: MessageType;
  content: string;
  imageData?: string; // Base64 image data for image messages
  timestamp: number;
  status: MessageStatus;
  encrypted: boolean;
}

export interface ServerConfig {
  host: string;
  port: number;
  useTLS: boolean;
  isOpenServer?: boolean;
  certificatePin?: string;
}

export interface OutboxMessage {
  id: string;
  envelope: TransportEnvelope;
  retryCount: number;
  lastAttempt: number;
  createdAt: number;
}
