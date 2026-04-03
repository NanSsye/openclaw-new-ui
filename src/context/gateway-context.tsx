"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { GatewayClient } from "@/lib/openclaw/gateway-client";

export interface PresenceEntry {
  id: string;
  client?: {
    name?: string;
    version?: string;
    platform?: string;
    mode?: string;
    userAgent?: string;
  };
  status?: string;
  location?: string;
  role?: string;
}

export interface HealthInfo {
  uptime?: number;
  cpuUsage?: number;
  [key: string]: unknown;
}

interface SnapshotData {
  server?: {
    version?: string;
    connId?: string;
  };
  version?: string;
  [key: string]: unknown;
}

interface GatewayContextType {
  connected: boolean;
  snapshot: SnapshotData | null;
  error: string | null;
  presence: PresenceEntry[];
  health: HealthInfo | null;
  client: GatewayClient | null;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [client, setClient] = useState<GatewayClient | null>(null);

  useEffect(() => {
    const rawSettings = localStorage.getItem("openclaw.control.settings.v1");
    if (!rawSettings) return;

    try {
        const settings = JSON.parse(rawSettings);
        const token = sessionStorage.getItem("openclaw.control.token.v1") || "";
        const password = sessionStorage.getItem("openclaw.control.password.v1") || settings.password || "";

        const client = new GatewayClient({
          url: settings.gatewayUrl,
          token: token,
          password: password,
          onHello: (hello) => {
            setConnected(true);
            setError(null);
            const snapshotData = hello.payload || hello.snapshot || {};
            setSnapshot({ ...snapshotData, server: hello.server });
            const sn = hello.payload || hello.snapshot;
            if (sn) {
                if (sn.presence) setPresence(sn.presence);
                if (sn.health) setHealth(sn.health);
            }
          },
          onEvent: (evt) => {
            if (evt.event === "presence") {
                setPresence(evt.payload?.presence || []);
            } else if (evt.event === "health") {
                setHealth(evt.payload?.health || null);
            }
          },
          onClose: (info) => {
            setConnected(false);
            if (info.code !== 1000) {
                setError(`Disconnected (${info.code}): ${info.reason || "Check your URL/Token"}`);
            }
          },
          onError: () => {
            setError(`无法建立连接。请检查网关地址 (${settings.gatewayUrl}) 是否正确，并确认 OpenClaw 服务端已启动。`);
          }
        });

        const attachClientTimer = setTimeout(() => {
          setClient(client);
        }, 0);
        client.start();

        return () => {
          clearTimeout(attachClientTimer);
          client.stop();
        };
    } catch {
        const errorTimer = setTimeout(() => {
          setError("Invalid configuration settings.");
        }, 0);
        return () => clearTimeout(errorTimer);
    }
  }, []);

  return (
    <GatewayContext.Provider value={{ connected, snapshot, error, presence, health, client }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  const context = useContext(GatewayContext);
  if (context === undefined) {
    throw new Error("useGateway must be used within a GatewayProvider");
  }
  return context;
}
