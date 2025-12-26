import sodium from 'libsodium-wrappers-sumo';
import { v4 as uuidv4 } from 'uuid';
import {
  IdentityKeyPair,
  PreKeyBundle,
  TransportEnvelope,
  E2EEPayload,
  PROTOCOL_VERSION,
  DEFAULT_TTL,
  NONCE_SIZE,
  KEY_SIZE,
  FINGERPRINT_WORDS,
  MessageType
} from './protocol';

let sodiumReady = false;

export async function initCrypto(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

export function toBase64(data: Uint8Array): string {
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(data: string): Uint8Array {
  return sodium.from_base64(data, sodium.base64_variants.ORIGINAL);
}

export function generateRandomBytes(length: number): Uint8Array {
  return sodium.randombytes_buf(length);
}

export function generateIdentityKeyPair(): IdentityKeyPair {
  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: toBase64(keyPair.publicKey),
    privateKey: toBase64(keyPair.privateKey)
  };
}

export function generateSigningKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = sodium.crypto_sign_keypair();
  return {
    publicKey: toBase64(keyPair.publicKey),
    privateKey: toBase64(keyPair.privateKey)
  };
}

export function generatePreKeyBundle(
  identityKeyPair: IdentityKeyPair,
  signingKeyPair: { publicKey: string; privateKey: string }
): PreKeyBundle {
  const signedPreKey = sodium.crypto_box_keypair();
  const signedPreKeyBytes = signedPreKey.publicKey;
  const signature = sodium.crypto_sign_detached(
    signedPreKeyBytes,
    fromBase64(signingKeyPair.privateKey)
  );
  
  const oneTimePreKey = sodium.crypto_box_keypair();
  
  return {
    identityKey: identityKeyPair.publicKey,
    signedPreKey: toBase64(signedPreKey.publicKey),
    signedPreKeySignature: toBase64(signature),
    oneTimePreKey: toBase64(oneTimePreKey.publicKey),
    registrationId: sodium.randombytes_uniform(0xFFFFFF)
  };
}

export function generateFingerprint(publicKey: string): string {
  const keyBytes = fromBase64(publicKey);
  const hash = sodium.crypto_generichash(32, keyBytes);
  
  const words: string[] = [];
  for (let i = 0; i < 6; i++) {
    const index = hash[i] % FINGERPRINT_WORDS.length;
    words.push(FINGERPRINT_WORDS[index]);
  }
  
  return words.join(' ');
}

export function generateFingerprintHex(publicKey: string): string {
  const keyBytes = fromBase64(publicKey);
  const hash = sodium.crypto_generichash(16, keyBytes);
  return sodium.to_hex(hash).toUpperCase().match(/.{1,4}/g)?.join(' ') || '';
}

export function performKeyExchange(
  myPrivateKey: string,
  theirPublicKey: string
): string {
  const sharedSecret = sodium.crypto_scalarmult(
    fromBase64(myPrivateKey),
    fromBase64(theirPublicKey)
  );
  
  // Derive a proper key using HKDF-like construction
  const derivedKey = sodium.crypto_generichash(KEY_SIZE, sharedSecret);
  return toBase64(derivedKey);
}

export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = generateRandomBytes(NONCE_SIZE);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null, // additional data
    null, // nsec (not used)
    nonce,
    key
  );
  return { ciphertext, nonce };
}

export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // nsec (not used)
    ciphertext,
    null, // additional data
    nonce,
    key
  );
}

export function encryptMessage(
  content: string,
  type: MessageType,
  sharedKey: string,
  senderKeyRef: string
): { ciphertext: string; nonce: string } {
  // Add random padding for traffic analysis resistance
  const paddingLength = sodium.randombytes_uniform(64);
  const padding = toBase64(generateRandomBytes(paddingLength));
  
  const payload: E2EEPayload = {
    type,
    content,
    senderKeyRef,
    timestamp: Date.now(),
    padding
  };
  
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const keyBytes = fromBase64(sharedKey);
  const { ciphertext, nonce } = encrypt(plaintext, keyBytes);
  
  return {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce)
  };
}

export function decryptMessage(
  ciphertext: string,
  nonce: string,
  sharedKey: string
): E2EEPayload {
  const keyBytes = fromBase64(sharedKey);
  const ciphertextBytes = fromBase64(ciphertext);
  const nonceBytes = fromBase64(nonce);
  
  const plaintext = decrypt(ciphertextBytes, nonceBytes, keyBytes);
  const payloadStr = new TextDecoder().decode(plaintext);
  return JSON.parse(payloadStr) as E2EEPayload;
}

export function createEnvelope(
  toUserId: string,
  fromUserId: string,
  conversationId: string,
  ciphertext: string,
  nonce: string
): TransportEnvelope {
  return {
    version: PROTOCOL_VERSION,
    toUserId,
    fromUserId,
    conversationId,
    messageId: uuidv4(),
    timestamp: Date.now(),
    ttl: DEFAULT_TTL,
    ciphertext,
    nonce
  };
}

export function generateConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  const combined = new TextEncoder().encode(sorted.join(':'));
  const hash = sodium.crypto_generichash(16, combined);
  return sodium.to_hex(hash);
}

export function deriveMessageKey(chainKey: string, messageNumber: number): string {
  const chainKeyBytes = fromBase64(chainKey);
  const info = new TextEncoder().encode(`msg:${messageNumber}`);
  const combined = new Uint8Array([...chainKeyBytes, ...info]);
  const derived = sodium.crypto_generichash(KEY_SIZE, combined);
  return toBase64(derived);
}

export function ratchetStep(chainKey: string): string {
  const chainKeyBytes = fromBase64(chainKey);
  const info = new TextEncoder().encode('ratchet');
  const combined = new Uint8Array([...chainKeyBytes, ...info]);
  const newChainKey = sodium.crypto_generichash(KEY_SIZE, combined);
  return toBase64(newChainKey);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = fromBase64(a);
  const bBytes = fromBase64(b);
  if (aBytes.length !== bBytes.length) return false;
  return sodium.memcmp(aBytes, bBytes);
}