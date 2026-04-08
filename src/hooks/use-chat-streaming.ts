"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useGatewayChatEventsWeb } from "@/hooks/chat/use-gateway-chat-events-web";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type { ChatActivity, ChatMessage, SessionUsage, UiChatMessage } from "@/lib/openclaw/chat-types";
import { buildLiveRunListData, type StreamSegment, type ToolTransientMessage } from "@/lib/openclaw/live-run-thread";
import { formatToolActivityLabel, formatToolOneLiner } from "@/lib/openclaw/tool-display";

export function useChatStreaming({
  client,
  connected,
  activeSession,
  fetchHistory,
  invalidateHistory,
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
  fetchHistory: (key: string, force?: boolean) => Promise<void>;
  invalidateHistory: (sessionKey?: string) => void;
  fetchSessions: () => Promise<void>;
  setSessions: React.Dispatch<React.SetStateAction<import("@/lib/openclaw/chat-types").SessionItem[]>>;
  setSessionUsage: React.Dispatch<React.SetStateAction<SessionUsage | null>>;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [chatStream, setChatStream] = useState<string | null>(null);
  const [streamSegments, setStreamSegments] = useState<StreamSegment[]>([]);
  const [toolMessages, setToolMessages] = useState<ToolTransientMessage[]>([]);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRunIdRef = useRef<string>("");

  const clearTransient = useCallback(() => {
    setChatStream(null);
    setStreamSegments([]);
    setToolMessages([]);
    setStreamStartedAt(null);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    currentRunIdRef.current = "";
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      if (!client || !connected) {
        stopPolling();
        return;
      }
      try {
        await fetchHistory(activeSession);
      } catch (e) {
        console.warn("[Chat] Polling error", e);
      }
    }, 800);
  }, [activeSession, client, connected, fetchHistory, stopPolling]);

  useGatewayChatEventsWeb({
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
  });

  const displayMessages = useMemo(() => buildLiveRunListData({
    historyMessages: messages,
    toolMessages,
    streamSegments,
    liveStreamText: chatStream,
    liveStreamStartedAt: streamStartedAt,
    activeRunId: null,
  }), [messages, toolMessages, streamSegments, chatStream, streamStartedAt]);

  const activity = useMemo<ChatActivity | null>(() => {
    const latestTool = [...displayMessages].reverse().find((message): message is UiChatMessage => message.role === "tool");
    if (latestTool && (latestTool.toolStatus === "running" || isTyping)) {
      return {
        kind: "tool",
        label: formatToolActivityLabel(latestTool.toolName || "tool"),
        detail: latestTool.toolSummary || formatToolOneLiner(latestTool.toolName || "tool", latestTool.toolArgs),
        toolName: latestTool.toolName,
        toolSummary: latestTool.toolSummary,
      };
    }
    if (chatStream?.trim()) {
      return {
        kind: "writing",
        label: "正在组织回复",
        detail: chatStream.trim().slice(0, 120),
      };
    }
    if (isTyping) {
      return {
        kind: "thinking",
        label: "正在思考",
        detail: "模型正在分析上下文并准备下一步动作",
      };
    }
    return null;
  }, [chatStream, displayMessages, isTyping]);

  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: isTyping || chatStream ? "auto" : "smooth",
        });
      }
    }
  }, [isTyping, messages, scrollRef, chatStream, toolMessages, streamSegments, displayMessages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      setShowScrollButton((prev) => {
        const next = !isNearBottom;
        return prev === next ? prev : next;
      });
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    isTyping,
    showScrollButton,
    currentRunIdRef,
    displayMessages,
    activity,
    setIsTyping,
    startPolling,
    stopPolling,
    clearTransient,
  };
}
