import { ServerMessage } from '@party-blast/shared';

type MessageHandler = (msg: ServerMessage) => void;

function getDefaultWsUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3001';
}

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  public connected = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('[WS] Connected to server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        // TV screen creates a room on connect
        this.send({ type: 'create_room' });
      };

      this.ws.onmessage = (evt) => {
        try {
          const msg: ServerMessage = JSON.parse(evt.data);
          for (const h of this.handlers) h(msg);
        } catch (e) {
          console.warn('[WS] Parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('[WS] Disconnected. Reconnecting in 3s...');
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[WS] Connection failed', e);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
