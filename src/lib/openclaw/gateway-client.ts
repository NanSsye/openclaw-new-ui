import { generateUUID } from "./uuid";

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

type GatewayPendingRequest<T = unknown> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toGatewayError(error: unknown, fallback = "Gateway request failed") {
  if (error instanceof Error) return error;

  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }

  if (error && typeof error === "object") {
    const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
    const messageParts = [
      typeof maybeError.message === "string" && maybeError.message.trim() ? maybeError.message.trim() : "",
      typeof maybeError.code === "string" && maybeError.code.trim() ? `[${maybeError.code.trim()}]` : "",
    ].filter(Boolean);

    const message = messageParts.join(" ") || fallback;
    const normalized = new Error(message);
    if (maybeError.details !== undefined) {
      try {
        (normalized as Error & { cause?: unknown }).cause = maybeError.details;
      } catch {}
    }
    return normalized;
  }

  return new Error(fallback);
}

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
  snapshot?: unknown;
  payload?: unknown;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string; error?: unknown }) => void;
  onError?: (err: unknown) => void;
};

type VerifyGatewayConnectionOptions = {
  url: string;
  token?: string;
  password?: string;
  timeoutMs?: number;
};

export function verifyGatewayConnection({
  url,
  token,
  password,
  timeoutMs = 10000,
}: VerifyGatewayConnectionOptions): Promise<GatewayHelloOk> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const requestId = generateUUID();

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      }
    };

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler();
      try {
        ws?.close(1000, "done");
      } catch {}
    };

    try {
      let targetUrl = url;
      if (token && !targetUrl.includes("token=")) {
        const sep = targetUrl.includes("?") ? "&" : "?";
        targetUrl = `${targetUrl}${sep}token=${token}`;
      }

      ws = new WebSocket(targetUrl);

      timeout = setTimeout(() => {
        finish(() => reject(new Error("连接超时，请检查网关地址或令牌是否正确")));
      }, timeoutMs);

      ws.onopen = () => {
        const frame = {
          type: "req",
          id: requestId,
          method: "connect",
          params: {
            minProtocol: 1,
            maxProtocol: 5,
            client: {
              id: "openclaw-control-ui",
              version: "v2026.3.11",
              platform: "web",
              mode: "webchat",
            },
            role: "operator",
            scopes: ["operator.admin", "operator.approvals", "operator.pairing", "operator.read", "operator.write"],
            auth: {
              token,
              password,
            },
          },
        };

        ws?.send(JSON.stringify(frame));
      };

      ws.onmessage = (ev) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(ev.data));
        } catch {
          return;
        }

        if (isRecord(parsed) && parsed.type === "hello-ok") {
          finish(() => resolve(parsed as GatewayHelloOk));
          return;
        }

        if (isRecord(parsed) && parsed.type === "res" && parsed.id === requestId) {
          if (parsed.ok) {
            const payload = parsed.payload ?? {};
            finish(() => resolve(payload as GatewayHelloOk));
          } else {
            finish(() =>
              reject(
                toGatewayError(
                  isRecord(parsed.error) ? parsed.error : undefined,
                  "网关连接验证失败",
                ),
              ),
            );
          }
        }
      };

      ws.onerror = () => {
        finish(() => reject(new Error("无法连接到网关，请检查地址、令牌或网络")));
      };

      ws.onclose = (ev) => {
        if (!settled) {
          finish(() =>
            reject(new Error(ev.reason || `连接已关闭 (${ev.code})`)),
          );
        }
      };
    } catch (error) {
      finish(() =>
        reject(error instanceof Error ? error : new Error("创建网关连接失败")),
      );
    }
  });
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, GatewayPendingRequest>();
  private closed = false;
  private backoffMs = 800;
  private isConnecting = false;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private helloDelivered = false;

  constructor(public opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    this.helloDelivered = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    this.helloDelivered = false;
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.closed || this.isConnecting) return;
    this.isConnecting = true;

    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    let targetUrl = this.opts.url;
    if (this.opts.token && !targetUrl.includes("token=")) {
        const sep = targetUrl.includes("?") ? "&" : "?";
        targetUrl = `${targetUrl}${sep}token=${this.opts.token}`;
    }

    try {
        this.ws = new WebSocket(targetUrl);

        this.connectTimeout = setTimeout(() => {
            if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                this.ws.close();
            }
            this.connectTimeout = null;
        }, 10000);

        this.ws.onopen = () => {
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            this.sendConnect();
        };

        this.ws.onmessage = (ev) => {
          this.handleMessage(String(ev.data));
        };

        this.ws.onclose = (ev) => {
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            this.isConnecting = false;
            this.handleClose(ev.code, ev.reason);
        };

        this.ws.onerror = (ev) => {
            if (this.connectTimeout !== null) {
              clearTimeout(this.connectTimeout);
              this.connectTimeout = null;
            }
            this.isConnecting = false;
            this.opts.onError?.(ev);
        };
    } catch (e) {
        this.isConnecting = false;
        this.opts.onError?.(e);
        this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.5, 10000);
    setTimeout(() => this.connect(), delay);
  }

  private handleClose(code: number, reason: string) {
    this.ws = null;
    this.helloDelivered = false;
    this.opts.onClose?.({ code, reason });
    this.scheduleReconnect();
  }

  private emitHelloOnce(hello: GatewayHelloOk) {
    if (this.helloDelivered) return;
    this.helloDelivered = true;
    this.opts.onHello?.(hello);
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
      .then((hello) => {
        console.log("[Gateway] Connect successful", hello);
        if (isRecord(hello) && isRecord(hello.features) && Array.isArray(hello.features.scopes)) {
            console.log("[Gateway] Scopes granted:", hello.features.scopes);
        }
        this.backoffMs = 800;
        this.isConnecting = false;
        this.emitHelloOnce(hello as GatewayHelloOk);
      })
      .catch((err) => {
        this.isConnecting = false;
        console.error("[Gateway] Connect request failed", toGatewayError(err, "网关 connect 请求失败"));
        // Special case: if connect failed with missing scope, try changing client id/mode?
        this.ws?.close();
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch { return; }

    if (!isRecord(parsed)) return;

    if (parsed.type === "hello-ok") {
        this.emitHelloOnce(parsed as GatewayHelloOk);
        return;
    }

    if (parsed.type === "event") {
      this.opts.onEvent?.(parsed as GatewayEventFrame);
    } else if (parsed.type === "res") {
      const pending = typeof parsed.id === "string" ? this.pending.get(parsed.id) : undefined;
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(parsed.id as string);
        if (parsed.ok) pending.resolve(parsed.payload);
        else pending.reject(toGatewayError(parsed.error));
      }
    }
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs: number = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Not connected"));
    }
    const id = generateUUID();

    const frame = {
      type: "req",
      id,
      method,
      params
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
          if (this.pending.has(id)) {
              this.pending.delete(id);
              reject(new Error(`Request ${method} timed out`));
          }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws?.send(JSON.stringify(frame));
    });
  }
}
