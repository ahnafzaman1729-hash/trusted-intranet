import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  initCrypto,
  generateIdentityKeyPair,
  generateSigningKeyPair,
  generateFingerprint,
  generateFingerprintHex,
  performKeyExchange,
  encryptMessage,
  decryptMessage,
  createEnvelope,
  generateConversationId
} from '@/lib/crypto';
import {
  initStorage,
  saveIdentity,
  getIdentity,
  saveContact,
  getContact,
  getAllContacts,
  saveMessage,
  getMessagesByConversation,
  saveServerConfig,
  getServerConfig,
  addToOutbox,
  getOutboxMessages,
  removeFromOutbox,
  isMessageSeen,
  markMessageSeen,
  saveSession,
  getSession
} from '@/lib/storage';
import { networkService } from '@/lib/network';
import {
  Contact,
  StoredMessage,
  ServerConfig,
  MessageType,
  MessageStatus,
  SessionState,
  IdentityKeyPair
} from '@/lib/protocol';

interface Identity {
  id: string;
  username: string;
  identityKeyPair: IdentityKeyPair;
  signingKeyPair: { publicKey: string; privateKey: string };
  createdAt: number;
}

interface ChatContextType {
  initialized: boolean;
  identity: Identity | null;
  contacts: Contact[];
  messages: Map<string, StoredMessage[]>;
  activeContact: Contact | null;
  connected: boolean;
  serverConfig: ServerConfig | null;
  
  // Actions
  createIdentity: (username: string) => Promise<void>;
  configureServer: (config: ServerConfig) => Promise<void>;
  connectToServer: () => Promise<void>;
  addContact: (username: string) => Promise<Contact | null>;
  addContactManual: (username: string, publicKey: string) => Promise<Contact | null>;
  setActiveContact: (contact: Contact | null) => void;
  sendMessage: (content: string) => Promise<void>;
  verifyContact: (contactId: string) => Promise<void>;
  getFingerprint: (publicKey: string) => string;
  getFingerprintHex: (publicKey: string) => string;
  loadMessages: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Map<string, StoredMessage[]>>(new Map());
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  
  const sessionKeys = useRef<Map<string, string>>(new Map());

  // Initialize crypto and storage
  useEffect(() => {
    async function init() {
      try {
        await initCrypto();
        await initStorage();
        
        const storedIdentity = await getIdentity();
        if (storedIdentity) {
          setIdentity(storedIdentity);
        }
        
        const storedContacts = await getAllContacts();
        setContacts(storedContacts);
        
        const storedConfig = await getServerConfig();
        if (storedConfig) {
          setServerConfig(storedConfig);
          networkService.configure(storedConfig);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    }
    
    init();
  }, []);

  // Set up network handlers
  useEffect(() => {
    const unsubMessage = networkService.onMessage(async (envelope) => {
      // Check for replay
      if (await isMessageSeen(envelope.messageId)) {
        console.log('Duplicate message ignored:', envelope.messageId);
        return;
      }
      await markMessageSeen(envelope.messageId);
      
      // Get session key
      const sessionKey = sessionKeys.current.get(envelope.conversationId);
      if (!sessionKey) {
        console.error('No session key for conversation:', envelope.conversationId);
        return;
      }
      
      try {
        const payload = decryptMessage(envelope.ciphertext, envelope.nonce, sessionKey);
        
        const storedMessage: StoredMessage = {
          id: envelope.messageId,
          conversationId: envelope.conversationId,
          senderId: envelope.fromUserId,
          receiverId: envelope.toUserId,
          type: payload.type,
          content: payload.content,
          timestamp: payload.timestamp,
          status: MessageStatus.DELIVERED,
          encrypted: true
        };
        
        await saveMessage(storedMessage);
        
        setMessages(prev => {
          const newMap = new Map(prev);
          const convMessages = newMap.get(envelope.conversationId) || [];
          newMap.set(envelope.conversationId, [...convMessages, storedMessage]);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    });
    
    const unsubPresence = networkService.onPresence((userId, online) => {
      setContacts(prev => prev.map(c => 
        c.id === userId ? { ...c, online, lastSeen: Date.now() } : c
      ));
    });
    
    const unsubConnection = networkService.onConnection((isConnected) => {
      setConnected(isConnected);
    });
    
    return () => {
      unsubMessage();
      unsubPresence();
      unsubConnection();
    };
  }, []);

  // Process outbox when connected
  useEffect(() => {
    if (!connected) return;
    
    async function processOutbox() {
      const outboxMessages = await getOutboxMessages();
      for (const msg of outboxMessages) {
        try {
          await networkService.sendMessage(msg.envelope);
          await removeFromOutbox(msg.id);
        } catch (error) {
          console.error('Failed to send queued message:', error);
        }
      }
    }
    
    processOutbox();
  }, [connected]);

  const createIdentity = useCallback(async (username: string) => {
    const identityKeyPair = generateIdentityKeyPair();
    const signingKeyPair = generateSigningKeyPair();
    
    const newIdentity: Identity = {
      id: uuidv4(),
      username,
      identityKeyPair,
      signingKeyPair,
      createdAt: Date.now()
    };
    
    await saveIdentity(newIdentity);
    setIdentity(newIdentity);
  }, []);

  const configureServer = useCallback(async (config: ServerConfig) => {
    await saveServerConfig(config);
    setServerConfig(config);
    networkService.configure(config);
  }, []);

  const connectToServer = useCallback(async () => {
    if (!identity || !serverConfig) return;
    
    try {
      // Register with server
      const { userId, token } = await networkService.register(
        identity.username,
        identity.identityKeyPair.publicKey,
        identity.signingKeyPair.publicKey
      );
      
      // Update identity with server-assigned ID if different
      if (userId !== identity.id) {
        const updatedIdentity = { ...identity, id: userId };
        await saveIdentity(updatedIdentity);
        setIdentity(updatedIdentity);
      }
      
      // Connect WebSocket
      networkService.connect(token);
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw error;
    }
  }, [identity, serverConfig]);

  const addContact = useCallback(async (username: string): Promise<Contact | null> => {
    const user = await networkService.lookupUser(username);
    if (!user) return null;
    
    const contact: Contact = {
      id: user.id,
      username: user.username,
      identityKey: user.identityKey,
      verified: false
    };
    
    await saveContact(contact);
    setContacts(prev => [...prev, contact]);
    
    // Establish session
    if (identity) {
      const conversationId = generateConversationId(identity.id, contact.id);
      const sharedKey = performKeyExchange(
        identity.identityKeyPair.privateKey,
        contact.identityKey
      );
      sessionKeys.current.set(conversationId, sharedKey);
      
      const session: SessionState = {
        conversationId,
        contactId: contact.id,
        rootKey: sharedKey,
        sendingChainKey: sharedKey,
        receivingChainKey: sharedKey,
        sendingRatchetKey: identity.identityKeyPair,
        receivingRatchetKey: contact.identityKey,
        messageNumber: 0,
        previousChainLength: 0
      };
      await saveSession(session);
    }
    
    return contact;
  }, [identity]);

  const addContactManual = useCallback(async (username: string, publicKey: string): Promise<Contact | null> => {
    const contact: Contact = {
      id: uuidv4(),
      username,
      identityKey: publicKey,
      verified: false
    };
    
    await saveContact(contact);
    setContacts(prev => [...prev, contact]);
    
    // Establish session
    if (identity) {
      const conversationId = generateConversationId(identity.id, contact.id);
      const sharedKey = performKeyExchange(
        identity.identityKeyPair.privateKey,
        contact.identityKey
      );
      sessionKeys.current.set(conversationId, sharedKey);
      
      const session: SessionState = {
        conversationId,
        contactId: contact.id,
        rootKey: sharedKey,
        sendingChainKey: sharedKey,
        receivingChainKey: sharedKey,
        sendingRatchetKey: identity.identityKeyPair,
        receivingRatchetKey: contact.identityKey,
        messageNumber: 0,
        previousChainLength: 0
      };
      await saveSession(session);
    }
    
    return contact;
  }, [identity]);

  const sendMessage = useCallback(async (content: string) => {
    if (!identity || !activeContact) return;
    
    const conversationId = generateConversationId(identity.id, activeContact.id);
    
    // Get or create session key
    let sessionKey = sessionKeys.current.get(conversationId);
    if (!sessionKey) {
      const session = await getSession(conversationId);
      if (session) {
        sessionKey = session.sendingChainKey;
        sessionKeys.current.set(conversationId, sessionKey);
      } else {
        // Create new session
        sessionKey = performKeyExchange(
          identity.identityKeyPair.privateKey,
          activeContact.identityKey
        );
        sessionKeys.current.set(conversationId, sessionKey);
      }
    }
    
    const { ciphertext, nonce } = encryptMessage(
      content,
      MessageType.TEXT,
      sessionKey,
      identity.identityKeyPair.publicKey
    );
    
    const envelope = createEnvelope(
      activeContact.id,
      identity.id,
      conversationId,
      ciphertext,
      nonce
    );
    
    const storedMessage: StoredMessage = {
      id: envelope.messageId,
      conversationId,
      senderId: identity.id,
      receiverId: activeContact.id,
      type: MessageType.TEXT,
      content,
      timestamp: Date.now(),
      status: MessageStatus.QUEUED,
      encrypted: true
    };
    
    await saveMessage(storedMessage);
    setMessages(prev => {
      const newMap = new Map(prev);
      const convMessages = newMap.get(conversationId) || [];
      newMap.set(conversationId, [...convMessages, storedMessage]);
      return newMap;
    });
    
    if (connected) {
      try {
        await networkService.sendMessage(envelope);
        storedMessage.status = MessageStatus.SENT;
        await saveMessage(storedMessage);
        setMessages(prev => {
          const newMap = new Map(prev);
          const convMessages = newMap.get(conversationId) || [];
          newMap.set(conversationId, convMessages.map(m => 
            m.id === storedMessage.id ? storedMessage : m
          ));
          return newMap;
        });
      } catch {
        await addToOutbox({
          id: envelope.messageId,
          envelope,
          retryCount: 0,
          lastAttempt: Date.now(),
          createdAt: Date.now()
        });
      }
    } else {
      // In offline/local mode, mark as sent locally for testing
      storedMessage.status = MessageStatus.SENT;
      await saveMessage(storedMessage);
      setMessages(prev => {
        const newMap = new Map(prev);
        const convMessages = newMap.get(conversationId) || [];
        newMap.set(conversationId, convMessages.map(m => 
          m.id === storedMessage.id ? storedMessage : m
        ));
        return newMap;
      });
      
      // Also queue for when server becomes available
      await addToOutbox({
        id: envelope.messageId,
        envelope,
        retryCount: 0,
        lastAttempt: Date.now(),
        createdAt: Date.now()
      });
    }
  }, [identity, activeContact, connected]);

  const verifyContact = useCallback(async (contactId: string) => {
    const contact = await getContact(contactId);
    if (contact) {
      const updatedContact = { ...contact, verified: true, verifiedAt: Date.now() };
      await saveContact(updatedContact);
      setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
    }
  }, []);

  const getFingerprint = useCallback((publicKey: string) => {
    return generateFingerprint(publicKey);
  }, []);

  const getFingerprintHex = useCallback((publicKey: string) => {
    return generateFingerprintHex(publicKey);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const msgs = await getMessagesByConversation(conversationId);
    setMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(conversationId, msgs);
      return newMap;
    });
  }, []);

  const value: ChatContextType = {
    initialized,
    identity,
    contacts,
    messages,
    activeContact,
    connected,
    serverConfig,
    createIdentity,
    configureServer,
    connectToServer,
    addContact,
    addContactManual,
    setActiveContact,
    sendMessage,
    verifyContact,
    getFingerprint,
    getFingerprintHex,
    loadMessages
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}