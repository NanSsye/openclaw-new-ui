import { generateUUID } from "./uuid";

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: any;
  seq?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: any;
  error?: { code: string; message: string; details?: any };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: {
      scopes?: string[];
  };
  snapshot?: any;
  payload?: any;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string; error?: any }) => void;
  onError?: (err: any) => void;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: any, reject: any, timer: any }>();
  private closed = false;
  private backoffMs = 800;
  private isConnecting = false;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(public opts: GatewayBrowserClientOptions) {}

  start() {
    console.log(`[Gateway] start() called, closed=${this.closed}`);
    this.closed = false;
    this.connect();
  }

  stop() {
    console.log(`[Gateway] stop() called, closed=${this.closed}`);
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.closed || this.isConnecting) {
      console.log(`[Gateway] Connect skipped: closed=${this.closed}, isConnecting=${this.isConnecting}`);
      return;
    }
    this.isConnecting = true;
    
    // Clear any pending connect timeout from a previous connect attempt
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    
    let targetUrl = this.opts.url;
    if (this.opts.token && !targetUrl.includes("token=")) {
        const sep = targetUrl.includes("?") ? "&" : "?";
        targetUrl = `${targetUrl}${sep}token=${this.opts.token}`;
    }

    console.log(`[Gateway] Connecting to ${targetUrl}...`, {
      url: this.opts.url,
      hasToken: !!this.opts.token,
      readyState: this.ws?.readyState,
    });

    try {
        this.ws = new WebSocket(targetUrl);
        console.log(`[Gateway] WebSocket created, readyState=${this.ws.readyState}`);
        
        this.connectTimeout = setTimeout(() => {
            // Only close if we're still the active connection (not superseded by a newer connect)
            if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                console.warn(`[Gateway] Connection timeout! readyState=${this.ws.readyState}`);
                this.ws.close();
            }
            this.connectTimeout = null;
        }, 10000);

        this.ws.onopen = () => {
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            console.log(`[Gateway] WebSocket Opened! readyState=${this.ws?.readyState}`);
            this.sendConnect();
        };

        this.ws.onmessage = (ev) => {
          console.log(`[Gateway] Received message: ${String(ev.data).substring(0, 200)}...`);
          this.handleMessage(String(ev.data));
        };

        this.ws.onclose = (ev) => {
            console.log(`[Gateway] WebSocket onclose: code=${ev.code}, reason=${ev.reason}, wasClean=${ev.wasClean}`);
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            this.isConnecting = false;
            this.handleClose(ev.code, ev.reason);
        };

        this.ws.onerror = (ev) => {
            console.error(`[Gateway] WebSocket onerror! readyState=${this.ws?.readyState}`, ev);
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            this.isConnecting = false;
            this.opts.onError?.(ev);
        };
    } catch (e) {
        this.isConnecting = false;
        console.error("[Gateway] Connection exception", e);
        this.opts.onError?.(e);
        this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) {
      console.log(`[Gateway] Reconnect skipped: closed=${this.closed}`);
      return;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.5, 10000);
    console.log(`[Gateway] Scheduling reconnect in ${delay}ms (backoff=${this.backoffMs})`);
    setTimeout(() => this.connect(), delay);
  }

  private handleClose(code: number, reason: string) {
    console.warn(`[Gateway] Connection closed: code=${code}, reason=${reason}, closed=${this.closed}`);
    this.ws = null;
    this.opts.onClose?.({ code, reason });
    this.scheduleReconnect();
  }

  private sendConnect() {
    const params = {
      minProtocol: 1,
      maxProtocol: 5,
      client: {
        id: "openclaw-control-ui", // CRITICAL: Must be this to pass schema
        version: "v2026.3.11",
        platform: "web",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.write"],
      auth: {
        token: this.opts.token,
        password: this.opts.password,
      },
    };

    console.log("[Gateway] Sending connect request...");
    this.request("connect", params, 15000)
      .then((hello: any) => {
        console.log("[Gateway] Connect successful", hello);
        if (hello.features?.scopes) {
            console.log("[Gateway] Scopes granted:", hello.features.scopes);
        }
        this.backoffMs = 800;
        this.isConnecting = false;
        this.opts.onHello?.(hello);
      })
      .catch((err) => {
        this.isConnecting = false;
        console.error("[Gateway] Connect request failed", err);
        // Special case: if connect failed with missing scope, try changing client id/mode?
        this.ws?.close();
      });
  }

  private handleMessage(raw: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch { return; }

    if (parsed.type === "hello-ok") {
        this.opts.onHello?.(parsed);
        return;
    }

    if (parsed.type === "event") {
      this.opts.onEvent?.(parsed);
    } else if (parsed.type === "res") {
      const pending = this.pending.get(parsed.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(parsed.id);
        if (parsed.ok) pending.resolve(parsed.payload);
        else pending.reject(parsed.error);
      }
    }
  }

  request(method: string, params?: any, timeoutMs: number = 30000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[Gateway] Request ${method} rejected: not connected, readyState=${this.ws?.readyState}`);
      return Promise.reject(new Error("Not connected"));
    }
    const id = generateUUID();
    
    const frame = { 
      type: "req", 
      id, 
      method, 
      params
    };
    
    console.log(`[Gateway] Sending request: ${method} (id=${id})`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
          if (this.pending.has(id)) {
              this.pending.delete(id);
              console.warn(`[Gateway] Request ${method} timed out (id=${id})`);
              reject(new Error(`Request ${method} timed out`));
          }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws?.send(JSON.stringify(frame));
    });
  }
}
