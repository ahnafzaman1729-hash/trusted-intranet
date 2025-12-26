import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  IdentityKeyPair,
  Contact,
  StoredMessage,
  SessionState,
  ServerConfig,
  OutboxMessage
} from './protocol';

interface SecureChatDB extends DBSchema {
  identity: {
    key: string;
    value: {
      id: string;
      username: string;
      identityKeyPair: IdentityKeyPair;
      signingKeyPair: { publicKey: string; privateKey: string };
      createdAt: number;
    };
  };
  contacts: {
    key: string;
    value: Contact;
    indexes: { 'by-username': string };
  };
  messages: {
    key: string;
    value: StoredMessage;
    indexes: { 
      'by-conversation': string;
      'by-timestamp': number;
    };
  };
  sessions: {
    key: string;
    value: SessionState;
    indexes: { 'by-contact': string };
  };
  outbox: {
    key: string;
    value: OutboxMessage;
    indexes: { 'by-created': number };
  };
  seenMessages: {
    key: string;
    value: { id: string; timestamp: number };
  };
  serverConfig: {
    key: string;
    value: ServerConfig;
  };
}

const DB_NAME = 'secure-chat-db';
const DB_VERSION = 1;

let db: IDBPDatabase<SecureChatDB> | null = null;

export async function initStorage(): Promise<void> {
  if (db) return;
  
  db = await openDB<SecureChatDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Identity store
      database.createObjectStore('identity', { keyPath: 'id' });
      
      // Contacts store
      const contactsStore = database.createObjectStore('contacts', { keyPath: 'id' });
      contactsStore.createIndex('by-username', 'username');
      
      // Messages store
      const messagesStore = database.createObjectStore('messages', { keyPath: 'id' });
      messagesStore.createIndex('by-conversation', 'conversationId');
      messagesStore.createIndex('by-timestamp', 'timestamp');
      
      // Sessions store
      const sessionsStore = database.createObjectStore('sessions', { keyPath: 'conversationId' });
      sessionsStore.createIndex('by-contact', 'contactId');
      
      // Outbox store
      const outboxStore = database.createObjectStore('outbox', { keyPath: 'id' });
      outboxStore.createIndex('by-created', 'createdAt');
      
      // Seen messages for replay protection
      database.createObjectStore('seenMessages', { keyPath: 'id' });
      
      // Server config
      database.createObjectStore('serverConfig', { keyPath: 'host' });
    }
  });
}

function getDB(): IDBPDatabase<SecureChatDB> {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// Identity operations
export async function saveIdentity(identity: SecureChatDB['identity']['value']): Promise<void> {
  await getDB().put('identity', identity);
}

export async function getIdentity(): Promise<SecureChatDB['identity']['value'] | undefined> {
  const all = await getDB().getAll('identity');
  return all[0];
}

export async function clearIdentity(): Promise<void> {
  await getDB().clear('identity');
}

// Contact operations
export async function saveContact(contact: Contact): Promise<void> {
  await getDB().put('contacts', contact);
}

export async function getContact(id: string): Promise<Contact | undefined> {
  return getDB().get('contacts', id);
}

export async function getContactByUsername(username: string): Promise<Contact | undefined> {
  return getDB().getFromIndex('contacts', 'by-username', username);
}

export async function getAllContacts(): Promise<Contact[]> {
  return getDB().getAll('contacts');
}

export async function deleteContact(id: string): Promise<void> {
  await getDB().delete('contacts', id);
}

// Message operations
export async function saveMessage(message: StoredMessage): Promise<void> {
  await getDB().put('messages', message);
}

export async function getMessage(id: string): Promise<StoredMessage | undefined> {
  return getDB().get('messages', id);
}

export async function getMessagesByConversation(conversationId: string): Promise<StoredMessage[]> {
  return getDB().getAllFromIndex('messages', 'by-conversation', conversationId);
}

export async function deleteMessage(id: string): Promise<void> {
  await getDB().delete('messages', id);
}

// Session operations
export async function saveSession(session: SessionState): Promise<void> {
  await getDB().put('sessions', session);
}

export async function getSession(conversationId: string): Promise<SessionState | undefined> {
  return getDB().get('sessions', conversationId);
}

export async function getSessionByContact(contactId: string): Promise<SessionState | undefined> {
  return getDB().getFromIndex('sessions', 'by-contact', contactId);
}

// Outbox operations
export async function addToOutbox(message: OutboxMessage): Promise<void> {
  await getDB().put('outbox', message);
}

export async function getOutboxMessages(): Promise<OutboxMessage[]> {
  return getDB().getAll('outbox');
}

export async function removeFromOutbox(id: string): Promise<void> {
  await getDB().delete('outbox', id);
}

export async function updateOutboxMessage(message: OutboxMessage): Promise<void> {
  await getDB().put('outbox', message);
}

// Replay protection
export async function isMessageSeen(id: string): Promise<boolean> {
  const seen = await getDB().get('seenMessages', id);
  return !!seen;
}

export async function markMessageSeen(id: string): Promise<void> {
  await getDB().put('seenMessages', { id, timestamp: Date.now() });
}

export async function cleanupSeenMessages(olderThan: number): Promise<void> {
  const tx = getDB().transaction('seenMessages', 'readwrite');
  const store = tx.objectStore('seenMessages');
  const all = await store.getAll();
  
  for (const item of all) {
    if (item.timestamp < olderThan) {
      await store.delete(item.id);
    }
  }
  
  await tx.done;
}

// Server config operations
export async function saveServerConfig(config: ServerConfig): Promise<void> {
  await getDB().put('serverConfig', config);
}

export async function getServerConfig(): Promise<ServerConfig | undefined> {
  const all = await getDB().getAll('serverConfig');
  return all[0];
}

export async function clearAllData(): Promise<void> {
  const database = getDB();
  await database.clear('identity');
  await database.clear('contacts');
  await database.clear('messages');
  await database.clear('sessions');
  await database.clear('outbox');
  await database.clear('seenMessages');
  await database.clear('serverConfig');
}