"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import { useChatHistoryStateWeb } from "@/hooks/chat/use-chat-history-state-web";
import { useChatCommands } from "@/hooks/use-chat-commands";
import { useChatSend } from "@/hooks/use-chat-send";
import { useChatSession } from "@/hooks/use-chat-session";
import { useChatStreaming } from "@/hooks/use-chat-streaming";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import {
  formatAttachmentSize,
  type ChatAttachment,
} from "@/lib/openclaw/chat-attachments";
import type { AgentItem } from "@/lib/openclaw/chat-types";

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 0) return "--:--";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildAttachmentPrompt(attachments: ChatAttachment[]) {
  if (attachments.length === 0) return "";
  const lines = attachments.map((attachment, index) => {
    const details = [
      `序号: ${index + 1}`,
      `类型: ${attachment.kind}`,
      `文件名: ${attachment.name}`,
      `MIME: ${attachment.mimeType}`,
      `大小: ${formatAttachmentSize(attachment.size)}`,
      attachment.durationMs ? `时长: ${formatDuration(attachment.durationMs)}` : null,
      `下载地址: ${attachment.url}`,
    ].filter(Boolean);
    return `- ${details.join(" | ")}`;
  });

  const imageCount = attachments.filter((attachment) => attachment.kind === "image").length;
  const audioCount = attachments.filter((attachment) => attachment.kind === "audio").length;
  const videoCount = attachments.filter((attachment) => attachment.kind === "video").length;
  const fileCount = attachments.filter((attachment) => attachment.kind === "file").length;

  return [
    "[附件上下文开始]",
    "你正在处理一条附带附件的用户消息。",
    "请先根据下面列出的受控附件下载地址查看附件内容，再结合最后的用户正文回答。",
    "如果你能够访问这些地址，请优先读取附件内容后再分析。",
    "如果你当前运行环境无法直接访问下载地址，请明确告诉用户你无法直接下载附件，并基于现有文字说明继续回答，不要假装已经看过附件。",
    `附件统计: 图片 ${imageCount} 个，音频 ${audioCount} 个，视频 ${videoCount} 个，普通文件 ${fileCount} 个。`,
    "附件列表:",
    ...lines,
    "处理要求:",
    "1. 先看附件，再理解用户正文。",
    "2. 引用附件内容时，尽量指出你依据的是哪个附件。",
    "3. 如果附件和正文有冲突，以附件实际内容为准，并明确说明。",
    "4. 不要忽略任何一个附件。",
    "[附件上下文结束]",
  ].join("\n");
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function useChatControllerWeb({
  client,
  connected,
  health,
  toast,
  mounted,
}: {
  client: GatewayClient | null;
  connected: boolean;
  health: { contextWeight?: unknown; contextLimit?: unknown } | null | undefined;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  mounted: boolean;
}) {
  const [inputText, setInputText] = useState("");
  const [isUsageDropdownOpen, setIsUsageDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<string | null>(null);
  const [agents] = useState<AgentItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const {
    pendingAttachments,
    appendFiles,
    handleFileSelect,
    handleDrop,
    removeFile,
    clearPendingAttachments,
  } = useChatAttachments({ toast });

  const {
    messages,
    clearMessages,
    appendOptimisticMessage,
    removeMessage,
    invalidateHistory,
    fetchHistory,
  } = useChatHistoryStateWeb({
    client,
    connected,
    toast,
    scrollRef,
  });

  const {
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
    fetchUsage,
    toggleDetails,
    handleSwitchSession: switchSession,
    handleNewSession: createNewSession,
  } = useChatSession({
    client,
    connected,
  });

  const {
    isTyping,
    displayMessages,
    showScrollButton,
    currentRunIdRef,
    activity,
    setIsTyping,
    clearTransient,
    startPolling,
    stopPolling,
  } = useChatStreaming({
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
  });

  useEffect(() => {
    if (isUsageDropdownOpen) {
      fetchUsage();
    }
  }, [fetchUsage, isUsageDropdownOpen]);

  useEffect(() => {
    if (!connected || !client) return;
    fetchHistory(activeSession);
  }, [activeSession, client, connected, fetchHistory]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const handleOpenSidebar = useCallback((content: string) => {
    setSidebarContent(content);
    setSidebarOpen(true);
  }, []);

  const totalTokens = toNumber(activeSessionData?.totalTokens)
    || toNumber(health?.contextWeight)
    || toNumber(sessionUsage?.input);
  const contextLimit = toNumber(activeSessionData?.contextTokens)
    || toNumber(activeModelData?.contextWindow)
    || toNumber(config?.agents?.defaults?.contextTokens)
    || toNumber(health?.contextLimit, 128000);

  const handleSend = useChatSend({
    client,
    connected,
    activeSession,
    inputText,
    pendingAttachments,
    buildAttachmentPrompt,
    clearPendingAttachments,
    appendOptimisticMessage,
    removeMessage,
    invalidateHistory,
    setInputText,
    setIsTyping,
    clearTransient,
    startPolling,
    stopPolling,
    currentRunIdRef,
    toast,
  });

  const handleSwitchSession = useCallback((key: string) => {
    clearPendingAttachments();
    switchSession(key);
    clearMessages();
    invalidateHistory(key);
    setInputText("");
    currentRunIdRef.current = "";
    stopPolling();
    setIsTyping(false);
    clearTransient();
  }, [clearMessages, clearPendingAttachments, clearTransient, currentRunIdRef, invalidateHistory, setIsTyping, stopPolling, switchSession]);

  const handleNewSession = useCallback(() => {
    clearPendingAttachments();
    createNewSession();
    clearMessages();
    setInputText("");
    currentRunIdRef.current = "";
    stopPolling();
    setIsTyping(false);
    clearTransient();
  }, [clearMessages, clearPendingAttachments, clearTransient, createNewSession, currentRunIdRef, setIsTyping, stopPolling]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleAttachmentsDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleDrop(e);
  }, [handleDrop]);

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" });
        await appendFiles([file]);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
      };
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请检查麦克风权限";
      toast({ title: "无法开始录音", description: message, variant: "destructive" });
    }
  }, [appendFiles, isRecording, toast]);

  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const { handleSelectModel, handleCommandClick } = useChatCommands({
    client,
    activeSession,
    appendOptimisticMessage,
    removeMessage,
    invalidateHistory,
    setIsTyping,
    setInputText,
    setSelectedModel,
    toast,
  });

  return {
    mounted,
    agents,
    inputText,
    setInputText,
    isTyping,
    displayMessages,
    showScrollButton,
    activeSession,
    activeSessionData,
    sessions,
    models,
    selectedModel,
    showDetails,
    usageLoading,
    pendingAttachments,
    fileInputRef,
    isDragging,
    isRecording,
    sidebarOpen,
    sidebarContent,
    totalTokens,
    contextLimit,
    activity,
    scrollRef: scrollRef as RefObject<HTMLDivElement>,
    bottomRef: bottomRef as RefObject<HTMLDivElement>,
    setSidebarOpen,
    setIsUsageDropdownOpen,
    handleOpenSidebar,
    handleSend,
    handleSwitchSession,
    handleNewSession,
    handleSelectModel,
    handleCommandClick,
    toggleDetails,
    scrollToBottom,
    handleFileSelect,
    handleAttachmentsDrop,
    handleDragOver,
    handleDragLeave,
    removeFile,
    onToggleRecording: isRecording ? handleStopRecording : handleStartRecording,
  };
}
