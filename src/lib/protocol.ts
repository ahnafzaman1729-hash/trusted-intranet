// Protocol definitions for secure intranet chat
export const PROTOCOL_VERSION = '1.0.0';
export const MAX_MESSAGE_SIZE = 64 * 1024; // 64KB
export const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const NONCE_SIZE = 24; // XChaCha20-Poly1305
export const KEY_SIZE = 32;

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
  KEY_EXCHANGE = 'key_exchange',
  RECEIPT = 'receipt',
  PRESENCE = 'presence'
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

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content: string;
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