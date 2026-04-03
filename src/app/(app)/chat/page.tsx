"use client";

import { useEffect, useState, useRef, useCallback, useSyncExternalStore, type ComponentType } from "react";
import { motion } from "framer-motion";
import { 
  Bot, ChevronDown, BarChart2, Monitor,
  Plus, Terminal,
  Trash2, BarChart, Brain,
  RotateCcw, Box, StopCircle, Zap, Book, Download,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGateway } from "@/context/gateway-context";
import { MessageItem } from "@/components/chat/message-item";
import { ChatToolbar } from "@/components/chat/chat-toolbar";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatContextMonitor } from "@/components/chat/chat-context-monitor";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import { useChatCommands, type ChatCommand } from "@/hooks/use-chat-commands";
import { useChatSession } from "@/hooks/use-chat-session";
import { useChatStreaming } from "@/hooks/use-chat-streaming";
import { useChatSend } from "@/hooks/use-chat-send";
import type { AgentItem, ChatMessage } from "@/lib/openclaw/chat-types";

type SlashCommand = ChatCommand & { icon: ComponentType<{ className?: string }> };

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "new", label: "新建会话", description: "开启一个全新的对话上下文", category: "session", icon: Plus },
  { name: "reset", label: "重置会话", description: "重置当前会话的上下文", category: "session", icon: RotateCcw },
  { name: "compact", label: "压缩上下文", description: "压缩当前对话的上下文以节省 Token", category: "session", icon: Box },
  { name: "clear", label: "清空历史", description: "清空当前页面的聊天记录", category: "session", icon: Trash2 },
  { name: "stop", label: "停止生成", description: "由于网关限制，此命令可能部分失效", category: "session", icon: StopCircle },
  
  { name: "model", label: "切换模型", description: "查看或设置当前使用的模型", args: "<name>", category: "model", icon: Brain },
  { name: "think", label: "思考等级", description: "设置模型思考深度 (off/low/mid/high)", args: "<level>", category: "model", icon: Brain },
  { name: "fast", label: "快速模式", description: "切换是否开启快速响应模式", args: "<on|off>", category: "model", icon: Zap },
  { name: "verbose", label: "详细输出", description: "调试模式：输出更多中间过程", args: "<on|off>", category: "model", icon: Terminal },

  { name: "status", label: "运行状态", description: "查看当前网关及会话健康度", category: "tools", icon: BarChart },
  { name: "usage", label: "用量统计", description: "查看当前 Token 消耗概览", category: "tools", icon: BarChart2 },
  { name: "help", label: "查看帮助", description: "显示所有可用的命令列表", category: "tools", icon: Book },
  { name: "export", label: "导出对话", description: "将对话导出为 Markdown 文件", category: "tools", icon: Download },

  { name: "agents", label: "智能体列表", description: "列出当前活跃的所有子智能体", category: "agents", icon: Monitor },
  { name: "kill", label: "终止智能体", description: "强制停止特定的子智能体运行", args: "<id|all>", category: "agents", icon: X },
  { name: "skill", label: "运行技能", description: "直接调用特定的插件技能", args: "<name>", category: "agents", icon: Zap },
];

import {
  formatAttachmentSize,
  type ChatAttachment,
} from "@/lib/openclaw/chat-attachments";

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

export default function ChatPage() {
  const { connected, client, health } = useGateway();
  const { toast } = useToast();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isUsageDropdownOpen, setIsUsageDropdownOpen] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<string | null>(null);
  const [agents] = useState<AgentItem[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
    fetchHistory,
    toggleDetails,
    handleSwitchSession: switchSession,
    handleNewSession: createNewSession,
  } = useChatSession({
    client,
    connected,
    toast,
    scrollRef,
    clearPendingAttachments,
    setMessages,
  });
  const {
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
  } = useChatStreaming({
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
  });

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (isUsageDropdownOpen) {
      fetchUsage();
    }
  }, [isUsageDropdownOpen, fetchUsage]);

  // Filter messages to avoid showing the "in-progress" assistant message twice
  // When streamingMessage is active, exclude the last assistant message from display
  // Simple display: show all messages, the streamingMessage overlays on top
  const displayedMessages = messages;

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

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
    setMessages,
    setInputText,
    setIsTyping,
    setStreamingMessage,
    setStreamingMessages,
    startPolling,
    stopPolling,
    currentRunIdRef,
    toast,
  });

  const handleSwitchSession = (key: string) => {
    switchSession(key);
    stopPolling();
    setIsTyping(false);
    setStreamingMessage(null);
    setStreamingMessages([]);
    setInputText("");
    currentRunIdRef.current = "";
  };

  const handleNewSession = () => {
    createNewSession();
    stopPolling();
    setIsTyping(false);
    setStreamingMessage(null);
    setStreamingMessages([]);
    setInputText("");
    currentRunIdRef.current = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleAttachmentsDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleDrop(e);
  };

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
    setMessages,
    setIsTyping,
    setInputText,
    setSelectedModel,
    toast,
  });

  return (
    <div className="flex h-full bg-muted/5 overflow-hidden">
        <ChatContextMonitor
            mounted={mounted}
            portalId="header-context-monitor-portal"
            totalTokens={totalTokens}
            contextLimit={contextLimit}
        />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col h-full overflow-hidden relative"
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-8 custom-scrollbar scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pb-32 sm:pb-40">
                {displayedMessages.length === 0 && !isTyping && !streamingMessage && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground pt-40 opacity-20 select-none">
                        <Bot className="size-32 mb-6 stroke-[0.5]" />
                        <div className="text-center font-black uppercase tracking-[0.3em]">
                            <p className="text-2xl">OpenClaw Mesh</p>
                            <p className="text-[10px] mt-2 opacity-60">Gateway Connection Established</p>
                        </div>
                    </div>
                )}
                {displayedMessages.map((m, i) => (
                  <MessageItem 
                    key={`${m.id || i}`} 
                    {...m}
                    isStreaming={false}
                    onOpenSidebar={handleOpenSidebar}
                    message={m}
                    agents={agents}
                    showDetails={showDetails}
                  />
                ))}
                {isTyping && streamingMessage === null && (
                  <div className="flex items-start gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="size-11 rounded-[1.2rem] bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                      <div className="relative">
                        <Bot className="size-6 text-primary animate-pulse" />
                        <div className="absolute -inset-1 bg-primary/20 blur-sm rounded-full animate-ping" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1.5 p-4 rounded-[1.5rem] bg-muted/10 border border-border/40 w-fit">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="size-1.5 rounded-full bg-primary/30" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="size-1.5 rounded-full bg-primary/30" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="size-1.5 rounded-full bg-primary/30" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 pl-2 animate-pulse">OpenClaw is thinking...</p>
                    </div>
                  </div>
                )}
                {streamingMessages.map((msg, idx) => (
                  <MessageItem 
                    key={msg.id || idx}
                    role={msg.role} 
                    content={msg.content}
                    message={msg} 
                    isStreaming={true}
                    onOpenSidebar={handleOpenSidebar}
                    agents={agents}
                    showDetails={showDetails}
                  />
                ))}
                <div ref={bottomRef} className="h-4" />
            </div>
        </div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 p-3 sm:p-8 pt-8 sm:pt-12 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none"
        >
            <div className="max-w-4xl mx-auto pointer-events-auto relative">
                {showScrollButton && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                        <Button
                            variant="outline" size="sm"
                            onClick={scrollToBottom}
                            className="size-7 rounded-full border-border/50 px-0 shadow-sm backdrop-blur-sm hover:scale-105 transition-all shrink-0 bg-background/80 text-muted-foreground"
                        >
                            <ChevronDown className="size-3.5" />
                        </Button>
                    </div>
                )}
                <motion.div layout>
                    <ChatToolbar
                        models={models}
                        selectedModel={selectedModel}
                        onSelectModel={handleSelectModel}
                        activeSession={activeSession}
                        activeSessionData={activeSessionData}
                        sessions={sessions}
                        onNewSession={handleNewSession}
                        onSwitchSession={handleSwitchSession}
                        commands={SLASH_COMMANDS}
                        onCommandClick={handleCommandClick}
                        onUsageDropdownOpenChange={setIsUsageDropdownOpen}
                        usageLoading={usageLoading}
                        showDetails={showDetails}
                        onToggleDetails={toggleDetails}
                    />
                </motion.div>
            </div>

            <div className="max-w-4xl mx-auto pointer-events-auto">
                <ChatComposer
                    pendingAttachments={pendingAttachments}
                    onRemoveAttachment={removeFile}
                    fileInputRef={fileInputRef}
                    onFileSelect={handleFileSelect}
                    isDragging={isDragging}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleAttachmentsDrop}
                    isRecording={isRecording}
                    onToggleRecording={isRecording ? handleStopRecording : handleStartRecording}
                    inputText={inputText}
                    onInputChange={(e) => setInputText(e.target.value)}
                    onSend={handleSend}
                    connected={connected}
                    isTyping={isTyping}
                />
            </div>
        </motion.div>

        <ChatSidebar
          open={sidebarOpen}
          content={sidebarContent}
          onClose={() => setSidebarOpen(false)}
        />
    </motion.div>
  </div>
);
}
