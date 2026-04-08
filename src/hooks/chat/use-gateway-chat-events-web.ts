"use client";

import { useEffect, useRef } from "react";
import type { GatewayClient, GatewayEventFrame } from "@/lib/openclaw/gateway-client";
import type {
  ChatContentPart,
  ChatEventPayload,
  ChatMessage,
  SessionItem,
  SessionUsage,
} from "@/lib/openclaw/chat-types";
import { isToolDiagnosticText } from "@/lib/openclaw/chat-message-normalizer";
import type { StreamSegment, ToolTransientMessage } from "@/lib/openclaw/live-run-thread";

function toContentArray(content: ChatMessage["content"]): ChatContentPart[] {
  if (Array.isArray(content)) {
    return content.filter((part): part is ChatContentPart => typeof part === "object" && part !== null);
  }
  if (typeof content === "object" && content !== null) {
    return [content as ChatContentPart];
  }
  if (typeof content === "string" && content.trim()) {
    return [{ type: "text", text: content }];
  }
  return [];
}

function upsertToolMessage(
  prev: ToolTransientMessage[],
  id: string,
  patch: Partial<ToolTransientMessage>,
): ToolTransientMessage[] {
  const index = prev.findIndex((item) => item.id === id);
  if (index === -1) {
    return [{ id, role: "tool", ...patch } as ToolTransientMessage, ...prev];
  }
  const next = [...prev];
  next[index] = { ...next[index], ...patch, id, role: "tool" } as ToolTransientMessage;
  return next;
}

function appendToolDetail(
  prev: ToolTransientMessage[],
  id: string,
  extra: string,
): ToolTransientMessage[] {
  const index = prev.findIndex((item) => item.id === id);
  if (index === -1) return prev;
  const next = [...prev];
  const current = next[index];
  const base = typeof current.text === "string" && current.text.trim()
    ? current.text
    : typeof current.content === "string"
      ? current.content
      : "";
  const merged = base ? `${base}\n\n${extra}` : extra;
  next[index] = { ...current, text: merged, content: merged };
  return next;
}

export function useGatewayChatEventsWeb({
  client,
  activeSession,
  clearTransient,
  fetchHistory,
  invalidateHistory,
  fetchSessions,
  setChatStream,
  setIsTyping,
  setSessionUsage,
  setSessions,
  setStreamSegments,
  setStreamStartedAt,
  setToolMessages,
  stopPolling,
  toast,
}: {
  client: GatewayClient | null;
  activeSession: string;
  clearTransient: () => void;
  fetchHistory: (key: string, force?: boolean) => Promise<void>;
  invalidateHistory: (sessionKey?: string) => void;
  fetchSessions: () => Promise<void>;
  setChatStream: React.Dispatch<React.SetStateAction<string | null>>;
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionUsage: React.Dispatch<React.SetStateAction<SessionUsage | null>>;
  setSessions: React.Dispatch<React.SetStateAction<SessionItem[]>>;
  setStreamSegments: React.Dispatch<React.SetStateAction<StreamSegment[]>>;
  setStreamStartedAt: React.Dispatch<React.SetStateAction<number | null>>;
  setToolMessages: React.Dispatch<React.SetStateAction<ToolTransientMessage[]>>;
  stopPolling: () => void;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const toastRef = useRef(toast);
  const segmentCounterRef = useRef(0);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoveryRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => () => {
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!client) return;

    const handleEvent = (evt: GatewayEventFrame) => {
      const payload = (evt.payload ?? {}) as ChatEventPayload;
      if (evt.event !== "chat") return;

      const { state, message, sessionKey, errorMessage } = payload;
      const normalizedActive = activeSession.startsWith("agent:") ? activeSession.split(":").pop() : activeSession;
      const safeSessionKey = sessionKey || "";
      const normalizedEvent = safeSessionKey.startsWith("agent:") ? safeSessionKey.split(":").pop() : safeSessionKey;

      if (sessionKey !== activeSession && normalizedEvent !== normalizedActive) return;

      if (state === "delta") {
        const contentParts = message?.content !== undefined ? toContentArray(message.content) : toContentArray(message ?? null);
        const nextStreamChunks: string[] = [];
        let sawToolInDelta = false;
        let lastToolId: string | null = null;

        if (contentParts.length === 0 && message?.text && !isToolDiagnosticText(message.text)) {
          nextStreamChunks.push(message.text);
        }

        for (let idx = 0; idx < contentParts.length; idx++) {
          const part = contentParts[idx];
          const type = (part.type || "").toLowerCase();
          const isToolCall = ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(type) || !!(part.name && (part.arguments || part.args));
          const isToolResult = ["tool_result", "toolresult", "tool-result"].includes(type) || !!(part.toolCallId || part.tool_call_id);
          const toolId = String(part.toolCallId || part.tool_call_id || `${part.name || "tool"}-${idx}`);

          if (isToolCall) {
            sawToolInDelta = true;
            lastToolId = toolId;
            setToolMessages((prev) => upsertToolMessage(prev, toolId, {
              name: String(part.name || "tool"),
              content: [{ ...part, type: "tool_call" }],
              text: typeof part.summary === "string" ? part.summary : undefined,
            }));
            continue;
          }

          if (isToolResult) {
            sawToolInDelta = true;
            lastToolId = toolId;
            setToolMessages((prev) => upsertToolMessage(prev, toolId, {
              name: String(part.name || "tool"),
              content: [{ ...part, type: "tool_result" }],
              text: typeof part.text === "string" ? part.text : undefined,
            }));
            continue;
          }

          const text = typeof part.text === "string"
            ? part.text
            : typeof part.content === "string"
              ? part.content
              : "";
          if (!text.trim()) continue;
          if (isToolDiagnosticText(text) && lastToolId) {
            setToolMessages((prev) => appendToolDetail(prev, lastToolId!, text));
            continue;
          }
          if (!isToolDiagnosticText(text)) {
            nextStreamChunks.push(text);
          }
        }

        const nextStreamText = nextStreamChunks.join("\n").trim();
        if (nextStreamText) {
          if (sawToolInDelta) {
            const timestampMs = Date.now();
            segmentCounterRef.current += 1;
            setStreamSegments((prev) => [
              ...prev,
              {
                id: `segment-${timestampMs}-${segmentCounterRef.current}`,
                text: nextStreamText,
                timestampMs,
              },
            ]);
            setChatStream(null);
          } else {
            setChatStream(nextStreamText);
          }
          setStreamStartedAt((prev) => prev ?? Date.now());
        }

        setIsTyping(true);
        if (payload.usage) {
          const usage = payload.usage;
          setSessionUsage(usage);
          setSessions((prev) => prev.map((session) => session.key === sessionKey ? { ...session, usage } : session));
        }
        return;
      }

      if (state === "final" || state === "after-final" || state === "aborted") {
        stopPolling();
        const recoveryRunId = String(payload.message?.runId || payload.message?.id || sessionKey || activeSession);
        const recoveryKey = `${activeSession}:${recoveryRunId}`;
        const now = Date.now();
        const lastRecovery = lastRecoveryRef.current;
        if (lastRecovery && lastRecovery.key === recoveryKey && now - lastRecovery.at < 1200) {
          clearTransient();
          setIsTyping(false);
          return;
        }
        lastRecoveryRef.current = { key: recoveryKey, at: now };
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
        }
        recoveryTimeoutRef.current = setTimeout(() => {
          invalidateHistory(activeSession);
          fetchHistory(activeSession, true);
          fetchSessions();
          recoveryTimeoutRef.current = null;
        }, 250);
        clearTransient();
        setIsTyping(false);
        if (payload.usage) {
          const usage = payload.usage;
          setSessionUsage(usage);
          setSessions((prev) => prev.map((session) => session.key === sessionKey ? { ...session, usage } : session));
        }
        return;
      }

      if (state === "error") {
        stopPolling();
        clearTransient();
        setIsTyping(false);
        toastRef.current({ title: "对话错误", description: errorMessage || "网关处理消息时遇到错误", variant: "destructive" });
      }
    };

    client.setOnEvent(handleEvent);
    return () => client.setOnEvent(undefined);
  }, [
    activeSession,
    clearTransient,
    client,
    fetchHistory,
    fetchSessions,
    invalidateHistory,
    setChatStream,
    setIsTyping,
    setSessionUsage,
    setSessions,
    setStreamSegments,
    setStreamStartedAt,
    setToolMessages,
    stopPolling,
  ]);
}
