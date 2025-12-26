import { ServerConfig, TransportEnvelope, WSEventType, PreKeyBundle, User } from './protocol';

type MessageHandler = (envelope: TransportEnvelope) => void;
type PresenceHandler = (userId: string, online: boolean) => void;
type ConnectionHandler = (connected: boolean) => void;

class NetworkService {
  private config: ServerConfig | null = null;
  private ws: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private presenceHandlers: PresenceHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private authToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;

  configure(config: ServerConfig): void {
    this.config = config;
  }

  getBaseUrl(): string {
    if (!this.config) throw new Error('Network not configured');
    const protocol = this.config.useTLS ? 'https' : 'http';
    return `${protocol}://${this.config.host}:${this.config.port}`;
  }

  getWsUrl(): string {
    if (!this.config) throw new Error('Network not configured');
    const protocol = this.config.useTLS ? 'wss' : 'ws';
    return `${protocol}://${this.config.host}:${this.config.port}/ws`;
  }

  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await window.fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }

  async register(username: string, identityKey: string, signedPreKey: string): Promise<{ userId: string; token: string }> {
    return this.fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, identityKey, signedPreKey })
    });
  }

  async login(userId: string, signature: string): Promise<{ token: string }> {
    const result = await this.fetch<{ token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ userId, signature })
    });
    this.authToken = result.token;
    return result;
  }

  async lookupUser(username: string): Promise<User | null> {
    try {
      return await this.fetch(`/api/users/lookup?username=${encodeURIComponent(username)}`);
    } catch {
      return null;
    }
  }

  async getPreKeyBundle(userId: string): Promise<PreKeyBundle | null> {
    try {
      return await this.fetch(`/api/users/${userId}/prekey`);
    } catch {
      return null;
    }
  }

  async sendMessage(envelope: TransportEnvelope): Promise<{ delivered: boolean }> {
    return this.fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify(envelope)
    });
  }

  async fetchMessages(): Promise<TransportEnvelope[]> {
    return this.fetch('/api/messages');
  }

  async acknowledgeMessages(messageIds: string[]): Promise<void> {
    await this.fetch('/api/messages/ack', {
      method: 'POST',
      body: JSON.stringify({ messageIds })
    });
  }

  connect(token: string): void {
    this.authToken = token;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    try {
      const url = `${this.getWsUrl()}?token=${this.authToken}`;
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyConnection(true);
        this.startPing();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.notifyConnection(false);
        this.stopPing();
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case WSEventType.MESSAGE:
          this.messageHandlers.forEach(h => h(message.payload));
          break;
        case WSEventType.PRESENCE:
          this.presenceHandlers.forEach(h => h(message.userId, message.online));
          break;
        case WSEventType.PONG:
          // Server responded to ping
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  send(type: WSEventType, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send(WSEventType.PING, {});
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      console.log(`Reconnect attempt ${this.reconnectAttempts}`);
      this.doConnect();
    }, delay);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.push(handler);
    return () => {
      this.presenceHandlers = this.presenceHandlers.filter(h => h !== handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  private notifyConnection(connected: boolean): void {
    this.connectionHandlers.forEach(h => h(connected));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const networkService = new NetworkService();