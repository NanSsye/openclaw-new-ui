"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { GatewayClient, GatewayEventFrame } from "@/lib/openclaw/gateway-client";
import type { ChatContentPart, ChatEventPayload, ChatHistoryResponse, ChatMessage, SessionUsage } from "@/lib/openclaw/chat-types";

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

export function useChatStreaming({
  client,
  connected,
  activeSession,
  fetchHistory,
  fetchSessions,
  setSessions,
  setSessionUsage,
  toast,
  scrollRef,
  messages,
}: {
  client: GatewayClient | null;
  connected: boolean;
  activeSession: string;
  fetchHistory: (key: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
  setSessions: React.Dispatch<React.SetStateAction<import("@/lib/openclaw/chat-types").SessionItem[]>>;
  setSessionUsage: React.Dispatch<React.SetStateAction<SessionUsage | null>>;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [streamingMessages, setStreamingMessages] = useState<ChatMessage[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRunIdRef = useRef<string>("");
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    currentRunIdRef.current = "";
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!client || !connected) {
        stopPolling();
        return;
      }

      try {
        const res = await client.request<ChatHistoryResponse>("chat.history", { sessionKey: activeSession, limit: 20 });
        const msgs = res.messages || [];
        const userMsgIdx = [...msgs].reverse().findIndex((m) => m.role === "user");
        let streamingStartIdx = 0;
        if (userMsgIdx >= 0) {
          streamingStartIdx = msgs.length - 1 - userMsgIdx + 1;
        }

        const nextStreamingMessages: ChatMessage[] = msgs.slice(streamingStartIdx).map((m, idx) => ({
          id: `streaming-${Date.now()}-${idx}`,
          role: m.role,
          content: toContentArray(m.content),
          toolCallId: m.toolCallId,
          tool_call_id: m.tool_call_id,
          name: m.name,
          arguments: m.arguments,
          args: m.args,
          text: m.text,
        }));

        if (nextStreamingMessages.length > 0) {
          setStreamingMessages(nextStreamingMessages);
          setStreamingMessage(nextStreamingMessages[nextStreamingMessages.length - 1]);
          setIsTyping(true);
        }
      } catch (e) {
        console.warn("[Chat] Polling error", e);
      }
    }, 800);
  }, [activeSession, client, connected, stopPolling]);

  useEffect(() => {
    if (!client) return;
    const handleEvent = (evt: GatewayEventFrame) => {
      const payload = (evt.payload ?? {}) as ChatEventPayload;
      if (evt.event !== "chat") return;

      const { state, message, sessionKey, errorMessage } = payload;
      const normalizedActive = activeSession.startsWith("agent:") ? activeSession.split(":").pop() : activeSession;
      const safeSessionKey = sessionKey || "";
      const normalizedEvent = safeSessionKey.startsWith("agent:") ? safeSessionKey.split(":").pop() : safeSessionKey;

      if (sessionKey !== activeSession && normalizedEvent !== normalizedActive) {
        return;
      }

      if (state === "delta") {
        const content = message?.content;
        if (Array.isArray(content)) {
          const nextStreamingMessages: ChatMessage[] = content.map((part, idx) => ({
            id: `streaming-${Date.now()}-${idx}`,
            role: part.toolCallId || part.tool_call_id ? "tool" : "assistant",
            content: [part],
            toolCallId: part.toolCallId,
            tool_call_id: part.tool_call_id,
            name: part.name,
            arguments: part.arguments,
            args: part.args,
            text: part.text,
            partIndex: idx,
          }));
          setStreamingMessages(nextStreamingMessages);
        } else {
          const fallbackContent = content !== undefined ? toContentArray(content) : toContentArray(message ?? null);
          setStreamingMessages([{ id: `streaming-${Date.now()}`, role: "assistant", content: fallbackContent }]);
        }

        setStreamingMessage(message ?? null);
        setIsTyping(true);
        if (payload.usage) {
          const usage = payload.usage;
          setSessionUsage(usage);
          setSessions((prev) => prev.map((session) => session.key === sessionKey ? { ...session, usage } : session));
        }
      } else if (state === "final" || state === "after-final" || state === "aborted") {
        stopPolling();
        fetchHistory(activeSession);
        fetchSessions();
        setStreamingMessage(null);
        setStreamingMessages([]);
        setIsTyping(false);
        if (payload.usage) {
          const usage = payload.usage;
          setSessionUsage(usage);
          setSessions((prev) => prev.map((session) => session.key === sessionKey ? { ...session, usage } : session));
        }
      } else if (state === "error") {
        stopPolling();
        setStreamingMessage(null);
        setStreamingMessages([]);
        setIsTyping(false);
        toastRef.current({ title: "对话错误", description: errorMessage || "网关处理消息时遇到错误", variant: "destructive" });
      }
    };

    client.setOnEvent(handleEvent);
    return () => {
      client.setOnEvent(undefined);
    };
  }, [activeSession, client, fetchHistory, fetchSessions, setSessionUsage, setSessions, stopPolling]);

  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: isTyping || streamingMessage ? "auto" : "smooth",
        });
      }
    }
  }, [isTyping, messages, scrollRef, streamingMessage, streamingMessages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      setShowScrollButton(!isNearBottom);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    isTyping,
    streamingMessage,
    streamingMessages,
    showScrollButton,
    currentRunIdRef,
    setIsTyping,
    setStreamingMessage,
    setStreamingMessages,
    startPolling,
    stopPolling,
  };
}
