"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type {
  ConfigData,
  ConfigGetResponse,
  ModelItem,
  ModelsListResponse,
  SessionItem,
  SessionsUsageResponse,
  SessionListResponse,
  SessionUsage,
} from "@/lib/openclaw/chat-types";

export function useChatSession({
  client,
  connected,
}: {
  client: GatewayClient | null;
  connected: boolean;
}) {
  const [activeSession, setActiveSession] = useState("main");
  const [showDetails, setShowDetails] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const initRef = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem("openclaw.control.settings.v1");
    if (raw) {
      try {
        const settings = JSON.parse(raw);
        if (settings.sessionKey) setActiveSession(settings.sessionKey);
        if (settings.chatShowThinking !== undefined) setShowDetails(settings.chatShowThinking);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("openclaw.control.settings.v1");
    const settings = raw ? JSON.parse(raw) : {};
    settings.chatShowThinking = showDetails;
    localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
  }, [showDetails]);

  const fetchSessions = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res = await client.request<SessionListResponse>("sessions.list", { limit: 50, includeGlobal: true, includeUnknown: true });
      setSessions(res.sessions || []);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }, [client, connected]);

  const fetchModels = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res = await client.request<ModelsListResponse>("models.list", {});
      setModels(res.models || []);
    } catch (e) {
      console.error("Failed to load models", e);
    }
  }, [client, connected]);

  const fetchConfig = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res = await client.request<ConfigGetResponse>("config.get", {});
      if (res) {
        const actualConfig = res.config || res;
        setConfig(actualConfig);
        const modelCfg = actualConfig.agents?.defaults?.model;
        const defaultModelId = typeof modelCfg === "object" ? modelCfg.primary : modelCfg;
        if (defaultModelId && !selectedModel) setSelectedModel(defaultModelId);
      }
    } catch (e) {
      console.error("Failed to load config", e);
    }
  }, [client, connected, selectedModel]);

  const fetchUsage = useCallback(async () => {
    if (!client || !connected) return;
    setUsageLoading(true);
    try {
      const res = await client.request<SessionsUsageResponse>("sessions.usage", { limit: 100 }, 60000);
      if (res.sessions && Array.isArray(res.sessions)) {
        setSessions((prev) => {
          const next = [...prev];
          res.sessions?.forEach((u) => {
            const idx = next.findIndex((s) => s.key === u.key);
            if (idx !== -1) next[idx] = { ...next[idx], usage: u.usage };
          });
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to load usage", e);
    } finally {
      setUsageLoading(false);
    }
  }, [client, connected]);

  useEffect(() => {
    if (connected && client && !initRef.current) {
      initRef.current = true;
      const init = async () => {
        await fetchConfig();
        await fetchSessions();
        await fetchModels();
      };
      init();
    }
  }, [client, connected, fetchConfig, fetchModels, fetchSessions]);

  const activeModelData = useMemo(() => models.find((m) => m.id === selectedModel), [models, selectedModel]);

  const activeSessionData = useMemo<SessionItem>(() => {
    const session = sessions.find((item) => item.key === activeSession);
    if (session) return session;
    const label = activeSession.startsWith("agent:") ? activeSession.split(":").pop() || activeSession : activeSession;
    return { key: activeSession, label, displayName: label };
  }, [sessions, activeSession]);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => {
      const next = !prev;
      const raw = localStorage.getItem("openclaw.control.settings.v1");
      if (raw) {
        try {
          const settings = JSON.parse(raw);
          settings.chatShowThinking = next;
          localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
        } catch {}
      }
      return next;
    });
  }, []);

  const handleSwitchSession = useCallback((key: string) => {
    setActiveSession(key);
  }, []);

  const handleNewSession = useCallback(() => {
    const newKey = `s-${Math.random().toString(36).slice(2, 8)}`;
    handleSwitchSession(newKey);
  }, [handleSwitchSession]);

  return {
    activeSession,
    showDetails,
    usageLoading,
    config,
    sessionUsage,
    sessions,
    models,
    selectedModel,
    activeModelData,
    activeSessionData,
    setSessionUsage,
    setSessions,
    setSelectedModel,
    fetchSessions,
    fetchModels,
    fetchConfig,
    fetchUsage,
    toggleDetails,
    handleSwitchSession,
    handleNewSession,
  };
}
