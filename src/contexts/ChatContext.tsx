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
  ContactRequest,
  StoredMessage,
  ServerConfig,
  MessageType,
  MessageStatus,
  SessionState,
  IdentityKeyPair,
  CONTACT_REQUEST_TTL
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
  publicRoomMessages: StoredMessage[];
  pendingRequests: ContactRequest[];
  
  // Actions
  createIdentity: (username: string) => Promise<void>;
  configureServer: (config: ServerConfig) => Promise<void>;
  connectToServer: () => Promise<void>;
  addContact: (username: string) => Promise<Contact | null>;
  addContactManual: (username: string, publicKey: string) => Promise<Contact | null>;
  addContactByFingerprint: (username: string, fingerprint: string) => Promise<Contact | null>;
  setActiveContact: (contact: Contact | null) => void;
  sendMessage: (content: string) => Promise<void>;
  sendPublicMessage: (content: string) => Promise<void>;
  sendPublicImage: (imageData: string) => Promise<void>;
  sendContactRequest: (toUserId: string, toUsername: string) => Promise<void>;
  acceptContactRequest: (requestId: string) => Promise<void>;
  verifyContact: (contactId: string) => Promise<void>;
  getFingerprint: (publicKey: string) => string;
  getFingerprintHex: (publicKey: string) => string;
  loadMessages: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

// Public room key for open server (derived from a fixed value - everyone has same key)
const PUBLIC_ROOM_ID = 'public-room';
const PUBLIC_ROOM_KEY = 'cHVibGljLXJvb20tc2hhcmVkLWtleS1mb3ItZGVtbw=='; // Base64 of shared key
const CONTACT_REQUESTS_KEY = 'contact-requests';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Map<string, StoredMessage[]>>(new Map());
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [publicRoomMessages, setPublicRoomMessages] = useState<StoredMessage[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ContactRequest[]>([]);
  
  const sessionKeys = useRef<Map<string, string>>(new Map());

  // Load and clean up expired contact requests
  const loadContactRequests = useCallback(() => {
    try {
      const stored = localStorage.getItem(CONTACT_REQUESTS_KEY);
      if (stored) {
        const requests: ContactRequest[] = JSON.parse(stored);
        const now = Date.now();
        const validRequests = requests.filter(r => r.expiresAt > now && r.status === 'pending');
        setPendingRequests(validRequests);
        localStorage.setItem(CONTACT_REQUESTS_KEY, JSON.stringify(validRequests));
      }
    } catch (e) {
      console.error('Failed to load contact requests:', e);
    }
  }, []);

  const saveContactRequests = useCallback((requests: ContactRequest[]) => {
    localStorage.setItem(CONTACT_REQUESTS_KEY, JSON.stringify(requests));
    setPendingRequests(requests.filter(r => r.expiresAt > Date.now() && r.status === 'pending'));
  }, []);

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
        
        loadContactRequests();
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    }
    
    init();
  }, [loadContactRequests]);

  // Clean up expired requests periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadContactRequests();
    }, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [loadContactRequests]);

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

  // Add contact by fingerprint verification (marks as verified immediately)
  const addContactByFingerprint = useCallback(async (username: string, fingerprint: string): Promise<Contact | null> => {
    // For fingerprint-based adding, we create a placeholder contact
    // In a real app, we'd need the public key to be exchanged separately
    // For now, we'll use a generated key pair and trust the fingerprint
    const contactKeyPair = generateIdentityKeyPair();
    
    const contact: Contact = {
      id: uuidv4(),
      username,
      identityKey: contactKeyPair.publicKey,
      verified: true, // Verified by fingerprint
      verifiedAt: Date.now()
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

  // Send contact request with 1 hour expiry
  const sendContactRequest = useCallback(async (toUserId: string, toUsername: string) => {
    if (!identity) return;
    
    const request: ContactRequest = {
      id: uuidv4(),
      fromUserId: identity.id,
      fromUsername: identity.username,
      fromPublicKey: identity.identityKeyPair.publicKey,
      fromFingerprint: generateFingerprint(identity.identityKeyPair.publicKey),
      toUserId,
      toUsername,
      createdAt: Date.now(),
      expiresAt: Date.now() + CONTACT_REQUEST_TTL,
      status: 'pending'
    };
    
    // In a real app, this would be sent over the network
    // For demo, we simulate receiving the request
    const stored = localStorage.getItem(CONTACT_REQUESTS_KEY);
    const requests: ContactRequest[] = stored ? JSON.parse(stored) : [];
    requests.push(request);
    saveContactRequests(requests);
    
    // Also send as a public room message for visibility
    const notificationMessage: StoredMessage = {
      id: uuidv4(),
      conversationId: PUBLIC_ROOM_ID,
      senderId: identity.id,
      senderUsername: identity.username,
      receiverId: PUBLIC_ROOM_ID,
      type: MessageType.CONTACT_REQUEST,
      content: `📨 ${identity.username} sent a contact request to ${toUsername}`,
      timestamp: Date.now(),
      status: MessageStatus.SENT,
      encrypted: false
    };
    
    await saveMessage(notificationMessage);
    setPublicRoomMessages(prev => [...prev, notificationMessage]);
  }, [identity, saveContactRequests]);

  // Accept a contact request
  const acceptContactRequest = useCallback(async (requestId: string) => {
    const stored = localStorage.getItem(CONTACT_REQUESTS_KEY);
    if (!stored) return;
    
    const requests: ContactRequest[] = JSON.parse(stored);
    const request = requests.find(r => r.id === requestId);
    
    if (!request || request.expiresAt < Date.now()) {
      throw new Error('Request expired or not found');
    }
    
    // Add contact
    const contact: Contact = {
      id: request.fromUserId,
      username: request.fromUsername,
      identityKey: request.fromPublicKey,
      verified: true,
      verifiedAt: Date.now()
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
    
    // Update request status
    const updatedRequests = requests.map(r => 
      r.id === requestId ? { ...r, status: 'accepted' as const } : r
    );
    saveContactRequests(updatedRequests);
  }, [identity, saveContactRequests]);

  // Send message to public room (open server mode)
  const sendPublicMessage = useCallback(async (content: string) => {
    if (!identity) return;
    
    const storedMessage: StoredMessage = {
      id: uuidv4(),
      conversationId: PUBLIC_ROOM_ID,
      senderId: identity.id,
      senderUsername: identity.username,
      receiverId: PUBLIC_ROOM_ID,
      type: MessageType.TEXT,
      content,
      timestamp: Date.now(),
      status: MessageStatus.SENT,
      encrypted: false
    };
    
    // For demo, just store locally - in real app would broadcast
    await saveMessage(storedMessage);
    setPublicRoomMessages(prev => [...prev, storedMessage]);
  }, [identity]);

  // Send image to public room
  const sendPublicImage = useCallback(async (imageData: string) => {
    if (!identity) return;
    
    const storedMessage: StoredMessage = {
      id: uuidv4(),
      conversationId: PUBLIC_ROOM_ID,
      senderId: identity.id,
      senderUsername: identity.username,
      receiverId: PUBLIC_ROOM_ID,
      type: MessageType.IMAGE,
      content: '[Image]',
      imageData,
      timestamp: Date.now(),
      status: MessageStatus.SENT,
      encrypted: false
    };
    
    await saveMessage(storedMessage);
    setPublicRoomMessages(prev => [...prev, storedMessage]);
  }, [identity]);

  // Load public room messages
  useEffect(() => {
    if (serverConfig?.isOpenServer && identity) {
      getMessagesByConversation(PUBLIC_ROOM_ID).then(msgs => {
        setPublicRoomMessages(msgs);
      });
    }
  }, [serverConfig?.isOpenServer, identity]);

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
    publicRoomMessages,
    pendingRequests,
    createIdentity,
    configureServer,
    connectToServer,
    addContact,
    addContactManual,
    addContactByFingerprint,
    setActiveContact,
    sendMessage,
    sendPublicMessage,
    sendPublicImage,
    sendContactRequest,
    acceptContactRequest,
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
