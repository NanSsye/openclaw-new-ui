"use client";

import { useCallback, useRef, type RefObject, useState } from "react";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type { ChatHistoryResponse, ChatMessage } from "@/lib/openclaw/chat-types";

const HISTORY_LIMIT = 100;

function getMessageTextValue(message: ChatMessage) {
  if (typeof message.text === "string" && message.text.trim()) return message.text.trim();
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function getAttachmentUrls(message: ChatMessage) {
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : Array.isArray(message.files)
      ? message.files
      : [];
  return attachments.map((attachment) => attachment.url).filter(Boolean).sort();
}

function getUserMessageSignature(message: ChatMessage) {
  return JSON.stringify({
    text: getMessageTextValue(message),
    attachments: getAttachmentUrls(message),
  });
}

function mergeHistoryWithOptimistic(previous: ChatMessage[], history: ChatMessage[]) {
  const historyIds = new Set(history.map((message) => String(message.id || "")).filter(Boolean));
  const historyUserSignatureCounts = new Map<string, number>();
  history
    .filter((message) => message.role === "user")
    .forEach((message) => {
      const signature = getUserMessageSignature(message);
      historyUserSignatureCounts.set(signature, (historyUserSignatureCounts.get(signature) || 0) + 1);
    });

  const matchedHistorySignatureCounts = new Map<string, number>();

  const pendingOptimistic = previous.filter((message) => {
    if (!message || message.role !== "user" || !message.optimistic) return false;
    const messageId = String(message.id || "");
    if (messageId && historyIds.has(messageId)) return false;
    const signature = getUserMessageSignature(message);
    const historyCount = historyUserSignatureCounts.get(signature) || 0;
    const matchedCount = matchedHistorySignatureCounts.get(signature) || 0;
    if (matchedCount < historyCount) {
      matchedHistorySignatureCounts.set(signature, matchedCount + 1);
      return false;
    }
    return true;
  });

  return [...history, ...pendingOptimistic];
}

export function useChatHistoryStateWeb({
  client,
  connected,
  toast,
  scrollRef,
}: {
  client: GatewayClient | null;
  connected: boolean;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inflightHistoryRef = useRef(new Map<string, Promise<ChatHistoryResponse>>());

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const appendOptimisticMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((message) => String(message.id || "") !== messageId));
  }, []);

  const invalidateHistory = useCallback((sessionKey?: string) => {
    if (!sessionKey) {
      inflightHistoryRef.current.clear();
      return;
    }
    const cacheKey = `${sessionKey}:${HISTORY_LIMIT}`;
    inflightHistoryRef.current.delete(cacheKey);
  }, []);

  const applyHistory = useCallback((history: ChatMessage[]) => {
    setMessages((prev) => mergeHistoryWithOptimistic(prev, history));
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "auto" });
    }, 100);
  }, [scrollRef]);

  const fetchHistory = useCallback(async (sessionKey: string, force = false) => {
    if (!client || !connected) return;
    const cacheKey = `${sessionKey}:${HISTORY_LIMIT}`;
    if (force) {
      inflightHistoryRef.current.delete(cacheKey);
    }

    try {
      let request = inflightHistoryRef.current.get(cacheKey);
      if (!request) {
        request = client.request<ChatHistoryResponse>("chat.history", { sessionKey, limit: HISTORY_LIMIT });
        inflightHistoryRef.current.set(cacheKey, request);
      }

      const res = await request;
      const nextMessages = res.messages || [];
      applyHistory(nextMessages);
    } catch {
      toast({ title: "加载历史失败", description: "无法同步漫游记录", variant: "destructive" });
    } finally {
      inflightHistoryRef.current.delete(cacheKey);
    }
  }, [applyHistory, client, connected, toast]);

  return {
    messages,
    setMessages,
    clearMessages,
    appendOptimisticMessage,
    removeMessage,
    invalidateHistory,
    fetchHistory,
  };
}
