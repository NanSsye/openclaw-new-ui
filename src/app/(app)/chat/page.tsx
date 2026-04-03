"use client";

import { useEffect, useState, useRef, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, User, Bot, Paperclip, ChevronDown, Check,
  Plus, Terminal, Wrench, BarChart2, SquareTerminal,
  MessagesSquare, Clock, XCircle, ChevronRight,
  MoreHorizontal, Trash2, Power, Settings2, Key,
  BarChart, ListTodo, FileText, Brain, ChevronDownCircle,
  RotateCcw, Box, StopCircle, Eye, Zap, Book, Download,
  Monitor, X, CheckCircle2, Mic, Square, ImageIcon, Music4, LoaderCircle, Film
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGateway } from "@/context/gateway-context";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const SLASH_COMMANDS = [
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

const CATEGORY_LABELS: any = {
    session: "会话控制",
    model: "模型设置",
    tools: "工具与状态",
    agents: "多智能体"
};

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { generateUUID } from "@/lib/openclaw/uuid";
import {
  detectAttachmentKind,
  formatAttachmentSize,
  MAX_CHAT_ATTACHMENT_SIZE,
  type ChatAttachment,
  type PendingAttachment,
  uploadChatAttachment,
} from "@/lib/openclaw/chat-attachments";

const MemoizedMarkdown = memo(({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{text}</ReactMarkdown>
));
MemoizedMarkdown.displayName = "MemoizedMarkdown";

const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        return !inline && match ? (
            <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-xl my-4 text-xs overflow-x-auto"
                {...props}
            >
                {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
        ) : (
            <code className={cn("bg-muted px-1.5 py-0.5 rounded text-xs break-all", className)} {...props}>
                {children}
            </code>
        );
    },
    p: ({ children }: any) => <p className="leading-relaxed mb-3 last:mb-0 break-words overflow-wrap-break-word">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 mb-4 space-y-1 break-words">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-4 space-y-1 break-words">{children}</ol>,
    li: ({ children }: any) => <li className="break-words leading-relaxed">{children}</li>,
    a: ({ node, ...props }: any) => <a {...props} className="text-primary hover:underline font-bold break-all overflow-wrap-break-word" target="_blank" rel="noopener noreferrer" />,
    h1: ({ children }: any) => <h1 className="text-xl font-black mt-6 mb-4 break-words">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-black mt-5 mb-3 break-words">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-black mt-4 mb-2 break-words">{children}</h3>,
    table: ({ children }: any) => <table className="min-w-full divide-y divide-border overflow-auto my-4 text-xs block">{children}</table>,
    thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
    tbody: ({ children }: any) => <tbody className="divide-y divide-border">{children}</tbody>,
    tr: ({ children }: any) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
    th: ({ children }: any) => <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2 whitespace-nowrap">{children}</td>,
    strong: ({ children }: any) => <strong className="font-bold break-words">{children}</strong>,
    em: ({ children }: any) => <em className="italic break-words">{children}</em>,
};

function createPendingAttachment(file: File, extra?: { durationMs?: number }) {
  const mimeType = file.type || "application/octet-stream";
  const kind = detectAttachmentKind(mimeType);
  return {
    localId: generateUUID(),
    kind,
    file,
    name: file.name || `${kind}-${Date.now()}`,
    mimeType,
    size: file.size,
    previewUrl: kind === "image" || kind === "audio" || kind === "video" ? URL.createObjectURL(file) : undefined,
    durationMs: extra?.durationMs,
    status: "queued",
  } satisfies PendingAttachment;
}

function getMessageAttachments(message: any): ChatAttachment[] {
  if (Array.isArray(message?.attachments)) return message.attachments;
  if (Array.isArray(message?.files)) return message.files;
  return [];
}

function inferAttachmentKindFromUrl(url: string): ChatAttachment["kind"] {
  const normalized = url.toLowerCase().split(/[?#]/)[0];
  if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/.test(normalized)) return "image";
  if (/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/.test(normalized)) return "audio";
  if (/\.(mp4|mov|m4v|webm|ogv|mkv|avi)$/.test(normalized)) return "video";
  return "file";
}

function extractFallbackAttachments(text: string): ChatAttachment[] {
  if (typeof text !== "string" || !text) return [];

  const urlRegex = /https?:\/\/[^\s)"]+/gi;
  const seen = new Set<string>();
  const matches = text.match(urlRegex) || [];

  return matches.flatMap((rawUrl, index) => {
    const url = rawUrl.replace(/[),.;!?]+$/, "");
    if (!url || seen.has(url)) return [];

    const kind = inferAttachmentKindFromUrl(url);
    if (kind === "file" && !/\/api\/chat\/attachments\//i.test(url)) return [];

    seen.add(url);
    const pathSegment = url.split("/").pop() || `attachment-${index + 1}`;
    const decodedName = decodeURIComponent(pathSegment);

    return [{
      id: `fallback-${index}-${decodedName}`,
      kind,
      name: decodedName,
      mimeType: kind === "image" ? "image/*" : kind === "audio" ? "audio/*" : kind === "video" ? "video/*" : "application/octet-stream",
      size: 0,
      url,
    } satisfies ChatAttachment];
  });
}

function stripFallbackAttachmentLinks(text: string, attachments: ChatAttachment[]) {
  if (typeof text !== "string" || !text || attachments.length === 0) return text;

  const attachmentUrls = new Set(attachments.map((attachment) => attachment.url));
  const lines = text.split(/\r?\n/);
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !attachmentUrls.has(trimmed);
  });

  return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractFallbackAttachmentsFromContent(content: any, message: any): ChatAttachment[] {
  const seen = new Map<string, ChatAttachment>();

  const addFromText = (text: unknown) => {
    if (typeof text !== "string" || !text) return;
    for (const attachment of extractFallbackAttachments(text)) {
      if (!seen.has(attachment.url)) {
        seen.set(attachment.url, attachment);
      }
    }
  };

  if (typeof content === "string") {
    addFromText(content);
  } else if (Array.isArray(content)) {
    content.forEach((part) => {
      if (typeof part === "string") addFromText(part);
      else if (typeof part?.text === "string") addFromText(part.text);
      else if (typeof part?.content === "string") addFromText(part.content);
    });
  }

  addFromText(message?.text);
  addFromText(message?.content);

  return Array.from(seen.values());
}

async function getAudioDurationMs(file: File) {
  if (!(typeof window !== "undefined" && file.type.startsWith("audio/"))) return undefined;
  const objectUrl = URL.createObjectURL(file);
  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const durationMs = await new Promise<number | undefined>((resolve) => {
      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
      audio.onloadedmetadata = () => {
        cleanup();
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined);
      };
      audio.onerror = () => {
        cleanup();
        resolve(undefined);
      };
      audio.src = objectUrl;
    });
    return durationMs;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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

export default function ChatPage() {
  const { connected, client, health } = useGateway();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<any | null>(null);
  const [streamingMessages, setStreamingMessages] = useState<any[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [activeSession, setActiveSession] = useState("main");
  const [showDetails, setShowDetails] = useState(true);

  // Load settings from local storage on mount
  useEffect(() => {
    const raw = localStorage.getItem("openclaw.control.settings.v1");
    if (raw) {
      try {
        const settings = JSON.parse(raw);
        if (settings.sessionKey) setActiveSession(settings.sessionKey);
        if (settings.chatShowThinking !== undefined) setShowDetails(settings.chatShowThinking);
      } catch {
        // localStorage 解析失败时使用默认值
      }
    }
  }, []);

  // Save showDetails to localStorage when it changes
  useEffect(() => {
    const raw = localStorage.getItem("openclaw.control.settings.v1");
    const settings = raw ? JSON.parse(raw) : {};
    settings.chatShowThinking = showDetails;
    localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
  }, [showDetails]);
  
  const [isCommandsOpen, setIsCommandsOpen] = useState(false);
  const [isUsageDropdownOpen, setIsUsageDropdownOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<string | null>(null);
  const [sessionUsage, setSessionUsage] = useState<any>(null);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  
  // Streaming poll ref
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The runId of the current streaming session (set when chat.send is called)
  const currentRunIdRef = useRef<string>("");

  const fetchSessions = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res: any = await client.request("sessions.list", { limit: 50, includeGlobal: true, includeUnknown: true });
      setSessions(res.sessions || []);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }, [client, connected]);

  const fetchModels = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res: any = await client.request("models.list", {});
      setModels(res.models || []);
    } catch (e) {
      console.error("Failed to load models", e);
    }
  }, [client, connected]);

  const fetchConfig = useCallback(async () => {
    if (!client || !connected) return;
    try {
      const res: any = await client.request("config.get", {});
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
      const res: any = await client.request("sessions.usage", { limit: 100 }, 60000);
      if (res.sessions && Array.isArray(res.sessions)) {
        setSessions(prev => {
            const next = [...prev];
            res.sessions.forEach((u: any) => {
                const idx = next.findIndex(s => s.key === u.key);
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

  const fetchHistory = useCallback(async (key: string) => {
    if (!client || !connected) return;
    try {
      const res: any = await client.request("chat.history", { sessionKey: key, limit: 100 });
      setMessages(res.messages || []);
      setIsTyping(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
      }, 100);
    } catch (e) {
      toast({ title: "加载历史失败", description: "无法同步漫游记录", variant: "destructive" });
    }
  }, [client, connected, toast]);

  const activeModelData = useMemo(() => {
    return models.find(m => m.id === selectedModel);
  }, [models, selectedModel]);


  // Track if we've initialized for the current connected session to prevent infinite loops
  const initRef = useRef<boolean>(false);

  useEffect(() => {
    if (connected && client && !initRef.current) {
      initRef.current = true;
      const init = async () => {
        await fetchConfig();
        await fetchSessions();
        await fetchModels();
        await fetchHistory(activeSession);
      };
      init();
    }
  }, [connected, client, activeSession, fetchConfig, fetchSessions, fetchModels, fetchHistory]);

  useEffect(() => {
    if (showModelMenu) {
      fetchModels();
    }
  }, [showModelMenu, connected, client]);

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
  }, [isUsageDropdownOpen, connected, client]);

  // Use a ref to always get the latest toast function without causing effect re-runs
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Filter messages to avoid showing the "in-progress" assistant message twice
  // When streamingMessage is active, exclude the last assistant message from display
  // Simple display: show all messages, the streamingMessage overlays on top
  const displayedMessages = messages;

  useEffect(() => {
    if (!client) return;
    const handleEvent = (evt: any) => {
      console.log("[streaming] handleEvent called, event:", evt.event, "payload.state:", evt.payload?.state);
      if (evt.event === "chat") {
        const { state, message, sessionKey, errorMessage } = evt.payload;
        console.log("[streaming] chat event, state:", state, "message keys:", message ? Object.keys(message) : null);

        // Flexible session key check
        const normalizedActive = activeSession.startsWith("agent:") ? activeSession.split(":").pop() : activeSession;
        const normalizedEvent = (sessionKey || "").startsWith("agent:") ? sessionKey.split(":").pop() : sessionKey;

        if (sessionKey !== activeSession && normalizedEvent !== normalizedActive) {
            console.log("[streaming] session key mismatch, skipping");
            return;
        }

        if (state === "delta") {
            console.log("[streaming] delta state detected!");
            // 将 message.content 数组拆分为多个独立的 message
            const content = message?.content;
            console.log("[streaming] delta event, message:", JSON.stringify(message));
            if (Array.isArray(content)) {
              console.log("[streaming] content is array, length:", content.length);
              // 为每个 content part 创建独立的 message 对象
              const newStreamingMessages = content.map((part: any, idx: number) => ({
                id: `streaming-${Date.now()}-${idx}`,
                role: part.toolCallId || part.tool_call_id ? 'tool' : 'assistant',
                // MessageItem 期望 content 是数组，所以把 part 包装成数组
                content: [part],
                // 同时把 part 的关键属性提取到顶层，让 MessageItem 能正确识别类型
                toolCallId: part.toolCallId,
                tool_call_id: part.tool_call_id,
                name: part.name,
                arguments: part.arguments,
                args: part.args,
                text: part.text,
                partIndex: idx,
              }));
              setStreamingMessages(newStreamingMessages);
            } else {
              // 非数组情况：将 content 包装成数组或使用默认格式
              console.log("[streaming] content is not array, using fallback:", typeof content, content);
              // 如果 content 存在，包装成数组；否则使用整个 message 作为 content
              const fallbackContent = content !== undefined ? [content] : (message ? [message] : []);
              setStreamingMessages([{
                id: `streaming-${Date.now()}`,
                role: 'assistant',
                content: fallbackContent,
              }]);
            }
            setStreamingMessage(message);
            setIsTyping(true);
            if (evt.payload.usage) {
                const usage = evt.payload.usage;
                setSessionUsage(usage);
                setSessions(prev => prev.map(s => s.key === sessionKey ? { ...s, usage } : s));
            }
        } else if (state === "final" || state === "after-final" || state === "aborted") {
            // Stop streaming poll
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            // Fetch history immediately (no debounce) to avoid gap
            fetchHistory(activeSession);
            fetchSessions();
            setStreamingMessage(null);
            setStreamingMessages([]);
            setIsTyping(false);
            if (evt.payload.usage) {
                const usage = evt.payload.usage;
                setSessionUsage(usage);
                setSessions(prev => prev.map(s => s.key === sessionKey ? { ...s, usage } : s));
            }
        } else if (state === "error") {
            console.error("Chat error from gateway:", errorMessage);
            // Stop streaming poll
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setStreamingMessage(null);
            setStreamingMessages([]);
            setIsTyping(false);
            toastRef.current({ title: "对话错误", description: errorMessage || "网关处理消息时遇到错误", variant: "destructive" });
        }
      }
    };
    (client as any).opts.onEvent = handleEvent;
  }, [client, activeSession, fetchHistory, fetchSessions]);

  useEffect(() => {
    if (scrollRef.current) {
        const container = scrollRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

        if (isNearBottom) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: isTyping || streamingMessage ? "auto" : "smooth"
            });
        }
    }
  }, [messages, streamingMessage, streamingMessages, isTyping]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleOpenSidebar = useCallback((content: string) => {
    setSidebarContent(content);
    setSidebarOpen(true);
  }, []);

  const toggleDetails = useCallback(() => {
    setShowDetails(prev => {
        const next = !prev;
        const raw = localStorage.getItem("openclaw.control.settings.v1");
        if (raw) {
            try {
                const settings = JSON.parse(raw);
                settings.chatShowThinking = next;
                localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(settings));
            } catch {
                // localStorage 保存失败时静默忽略
              }
        }
        return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if ((!inputText.trim() && pendingAttachments.length === 0) || !client || !connected) return;
    const text = inputText.trim();
    const messageId = generateUUID();
    const optimisticAttachments = pendingAttachments.map((attachment) => ({
      id: attachment.localId,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.previewUrl || "",
      durationMs: attachment.durationMs,
    }));
    const userMessage = {
        id: messageId,
        role: "user",
        content: text,
        attachments: optimisticAttachments,
        createdAt: new Date().toISOString()
    };

    // Optimistically add user message so it appears immediately
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);
    setStreamingMessage(null);
    setStreamingMessages([]);

    const attachmentsToUpload = [...pendingAttachments];
    setPendingAttachments([]);

    // Store refs for polling callback
    const toastRef = { current: toast };

    // Start polling for streaming progress
    const startPolling = () => {
      // Clear any existing poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollIntervalRef.current = setInterval(async () => {
        if (!client || !connected) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
        try {
          const res: any = await client.request("chat.history", { sessionKey: activeSession, limit: 20 });
          const msgs = res.messages || [];
          
          console.log("[Chat] History msgs:", msgs.map((m: any) => ({
            role: m.role,
            runId: m.runId,
            contentType: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : typeof m.content
          })));
          
          // Find the user message index to know where streaming starts
          const userMsgIdx = [...msgs].reverse().findIndex((m: any) => m.role === "user");
          let streamingStartIdx = 0;
          if (userMsgIdx >= 0) {
            streamingStartIdx = msgs.length - 1 - userMsgIdx + 1; // +1 to skip the user message itself
          }
          
          // Get all messages that come after the user's message (these are streaming)
          const streamingMsgs = msgs.slice(streamingStartIdx).map((m: any, idx: number) => ({
            id: `streaming-${Date.now()}-${idx}`,
            role: m.role,
            content: Array.isArray(m.content) ? m.content : [m.content],
            toolCallId: m.toolCallId,
            tool_call_id: m.tool_call_id,
            name: m.name,
            arguments: m.arguments,
            args: m.args,
            text: m.text,
          }));
          
          if (streamingMsgs.length > 0) {
            console.log("[Chat] Streaming update, messages count:", streamingMsgs.length, "roles:", streamingMsgs.map((m: any) => m.role));
            setStreamingMessages(streamingMsgs);
            setStreamingMessage(streamingMsgs[streamingMsgs.length - 1]); // Keep last for compatibility
            setIsTyping(true);
          }
        } catch (e) {
          console.warn("[Chat] Polling error", e);
        }
      }, 800);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      currentRunIdRef.current = "";
    };

    try {
        const uploadedAttachments = await Promise.all(
          attachmentsToUpload.map(async (attachment) => {
            const uploaded = await uploadChatAttachment(attachment.file, activeSession, { durationMs: attachment.durationMs });
            return uploaded;
          }),
        );

        const attachmentPrompt = buildAttachmentPrompt(uploadedAttachments);
        const finalMessage = attachmentPrompt ? `${attachmentPrompt}\n\n${text}`.trim() : text;

        // Start polling immediately when sending
        startPolling();

        const sendRes: any = await client.request("chat.send", {
            sessionKey: activeSession,
            message: finalMessage,
            idempotencyKey: messageId,
            attachments: uploadedAttachments,
        });
        // Capture the runId for filtering
        if (sendRes?.runId) {
          currentRunIdRef.current = sendRes.runId;
          console.log("[Chat] Captured runId:", sendRes.runId);
        }
        // Note: We don't stop polling here because the response might still be generating
        // The onEvent handler will stop it when we get "final" or "after-final"
    } catch (e: any) {
        stopPolling();
        setIsTyping(false);
        setStreamingMessage(null);
        toastRef.current({ title: "发送失败", description: e.message, variant: "destructive" });
    } finally {
        attachmentsToUpload.forEach((attachment) => {
          if (attachment.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
        });
    }
  }, [inputText, pendingAttachments, client, connected, activeSession, toast]);

  const handleSwitchSession = (key: string) => {
    pendingAttachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setActiveSession(key);
    setStreamingMessage("");
    setInputText("");
    setPendingAttachments([]);
    setMessages([]);
    currentRunIdRef.current = "";
    fetchHistory(key);
    setShowSessionMenu(false);
  };

  const handleNewSession = () => {
    const newKey = `s-${Math.random().toString(36).slice(2, 8)}`;
    handleSwitchSession(newKey);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const nextAttachments = await Promise.all(files.map(async (file) => createPendingAttachment(file, { durationMs: await getAudioDurationMs(file) })));
      const oversize = nextAttachments.find((attachment) => attachment.size > MAX_CHAT_ATTACHMENT_SIZE);
      if (oversize) {
        if (oversize.previewUrl) {
          URL.revokeObjectURL(oversize.previewUrl);
        }
        toast({ title: "附件过大", description: `${oversize.name} 超过 20MB 限制`, variant: "destructive" });
      }
      setPendingAttachments((prev) => [...prev, ...nextAttachments.filter((attachment) => attachment.size <= MAX_CHAT_ATTACHMENT_SIZE)]);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const nextAttachments = await Promise.all(files.map(async (file) => createPendingAttachment(file, { durationMs: await getAudioDurationMs(file) })));
      const accepted = nextAttachments.filter((attachment) => attachment.size <= MAX_CHAT_ATTACHMENT_SIZE);
      nextAttachments.filter((attachment) => attachment.size > MAX_CHAT_ATTACHMENT_SIZE).forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      if (accepted.length !== nextAttachments.length) {
        toast({ title: "部分附件未加入", description: "超过 20MB 的附件已被忽略", variant: "destructive" });
      }
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const removeFile = (localId: string) => {
    setPendingAttachments(prev => {
      const target = prev.find((attachment) => attachment.localId === localId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((attachment) => attachment.localId !== localId);
    });
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
        const durationMs = await getAudioDurationMs(file);
        setPendingAttachments((prev) => [...prev, createPendingAttachment(file, { durationMs })]);
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
  }, [isRecording, toast]);

  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const activeSessionData = useMemo(() => {
    const s = sessions.find(sess => sess.key === activeSession);
    if (s) return s;
    const label = activeSession.startsWith('agent:') ? activeSession.split(':').pop() || activeSession : activeSession;
    return { label, displayName: label };
  }, [sessions, activeSession]);

  const handleCommandClick = (cmd: any) => {
    setIsCommandsOpen(false);
    if (cmd.args) {
      setInputText(`/${cmd.name} `);
      // Give it a tiny timeout to ensure the modal closes and focus works
      setTimeout(() => {
        const input = document.querySelector('textarea');
        if (input) input.focus();
      }, 50);
    } else {
      const cmdText = `/${cmd.name}`;
      // Execute simple commands immediately
      const userMessage = {
        id: generateUUID(),
        role: "user",
        content: cmdText,
        attachments: [],
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
      client?.request("chat.send", { 
          sessionKey: activeSession, 
          message: cmdText, 
          idempotencyKey: userMessage.id
      }).catch(e => {
          setIsTyping(false);
          toast({ title: "命令执行失败", description: e.message, variant: "destructive" });
      });
    }
  };

  const renderCommandsModal = () => (
    <Dialog open={isCommandsOpen} onOpenChange={setIsCommandsOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <SquareTerminal className="size-6 text-orange-500" /> 快捷命令控制台
          </DialogTitle>
          <p className="text-xs text-muted-foreground opacity-50 mt-1 uppercase tracking-widest font-black">OpenClaw Mesh Command Center</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {Object.keys(CATEGORY_LABELS).map(cat => {
              const catCmds = SLASH_COMMANDS.filter(c => c.category === cat);
              if (catCmds.length === 0) return null;
              return (
                  <div key={cat} className="space-y-4">
                      <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 whitespace-nowrap">{CATEGORY_LABELS[cat]}</span>
                          <div className="h-px w-full bg-gradient-to-r from-muted-foreground/10 to-transparent" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {catCmds.map(cmd => (
                            <button 
                                key={cmd.name}
                                onClick={() => handleCommandClick(cmd)}
                                className="flex items-start gap-4 p-4 rounded-[1.2rem] bg-muted/20 border border-border/40 hover:bg-primary/5 hover:border-primary/20 transition-all group text-left relative overflow-hidden active:scale-95"
                            >
                                <div className="size-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0 group-hover:text-primary transition-colors">
                                    <cmd.icon className="size-5 stroke-[1.5]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold tracking-tight">/{cmd.name}</p>
                                        <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground opacity-30">{cmd.label}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-2 opacity-60 group-hover:opacity-100 transition-opacity">{cmd.description}</p>
                                </div>
                                {cmd.args && (
                                    <div className="absolute right-3 top-3">
                                        <div className="px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 text-[8px] font-black uppercase tracking-widest">Args</div>
                                    </div>
                                )}
                            </button>
                        ))}
                      </div>
                  </div>
              )
          })}
        </div>
        <div className="p-4 bg-muted/20 border-t text-center">
            <p className="text-[10px] text-muted-foreground/40 font-medium">点击命令可直接执行或快速填入参数</p>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex h-full bg-muted/5 overflow-hidden">
        {mounted && document.getElementById('header-context-monitor-portal') && createPortal(
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-muted/50 border border-border/50 text-[9px] sm:text-[11px] font-medium tracking-widest text-muted-foreground/80 shadow-sm cursor-help hover:bg-muted/80 transition-all font-mono" title="当前上下文窗口状态">
                <div className={cn(
                    "size-1.5 sm:size-2 rounded-full shrink-0",
                    ((activeSessionData?.totalTokens || health?.contextWeight || sessionUsage?.input || 0) / ((activeSessionData?.contextTokens || activeModelData?.contextWindow || config?.agents?.defaults?.contextTokens || health?.contextLimit || 128000) || 1)) > 0.8 ? "bg-red-500" :
                    ((activeSessionData?.totalTokens || health?.contextWeight || sessionUsage?.input || 0) / ((activeSessionData?.contextTokens || activeModelData?.contextWindow || config?.agents?.defaults?.contextTokens || health?.contextLimit || 128000) || 1)) > 0.5 ? "bg-yellow-500" : "bg-emerald-500"
                )} />
                <span className="font-bold">{formatContext(activeSessionData?.totalTokens || health?.contextWeight || sessionUsage?.input || 0)}</span>
                <span className="opacity-30 text-[8px] sm:text-[10px]">/</span>
                <span className="opacity-50 font-bold">{formatContext(activeSessionData?.contextTokens || activeModelData?.contextWindow || config?.agents?.defaults?.contextTokens || health?.contextLimit || 128000)}</span>
            </div>,
            document.getElementById('header-context-monitor-portal')!
        )}

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
                <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mb-2 sm:mb-4">
                    <motion.div layout className="flex w-max items-center gap-1 px-1 pb-1">
                        {/* Model Selector - Far Left with text */}
                        <div className="relative shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[9px] font-medium px-2 hover:scale-105 transition-all shrink-0 focus-visible:ring-0 gap-1"
                                    >
                                        <Brain className="size-3 text-muted-foreground" />
                                        <span className="max-w-[80px] truncate">{selectedModel || "Model"}</span>
                                        <ChevronDown className="size-2.5 opacity-40 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-64 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                                    <div className="p-2.5 border-b border-border/40 text-[9px] font-medium uppercase opacity-40 tracking-widest pl-3 flex items-center gap-2 mb-1">
                                        <Monitor className="size-3" /> 模型列表
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-1 py-1.5 custom-scrollbar">
                                        {(() => {
                                          const grouped: Record<string, typeof models> = {};
                                          models.forEach(m => {
                                            const provider = m.provider || m.config_key || m.owned_by || "unknown";
                                            if (!grouped[provider]) grouped[provider] = [];
                                            grouped[provider].push(m);
                                          });
                                          const getProviderColor = (provider: string) => {
                                            const hash = provider.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                                            const hue = hash % 360;
                                            return `hsl(${hue}, 65%, 50%)`;
                                          };
                                          return Object.entries(grouped).map(([provider, providerModels]) => {
                                            const color = getProviderColor(provider);
                                            return (
                                              <div key={provider}>
                                                <div className="flex items-center gap-2 px-2.5 py-1.5 mt-1 first:mt-0">
                                                  <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                                                  <span className="text-[9px] font-medium uppercase tracking-widest opacity-40">{provider}</span>
                                                </div>
                                                {providerModels.map((m, i) => (
                                                  <DropdownMenuItem
                                                    key={`${m.id}-${i}`}
                                                    onClick={() => {
                                                      setSelectedModel(m.id);
                                                      // Send /model command directly
                                                      const cmdText = `/model ${m.id}`;
                                                      const userMessage = {
                                                        id: generateUUID(),
                                                        role: "user",
                                                        content: cmdText,
                                                        attachments: [],
                                                        createdAt: new Date().toISOString()
                                                      };
                                                      setMessages(prev => [...prev, userMessage]);
                                                      setIsTyping(true);
                                                      client?.request("chat.send", {
                                                          sessionKey: activeSession,
                                                          message: cmdText,
                                                          idempotencyKey: userMessage.id
                                                      }).catch(e => {
                                                          setIsTyping(false);
                                                          toast({ title: "命令执行失败", description: e.message, variant: "destructive" });
                                                      });
                                                    }}
                                                    className={cn(
                                                      "w-full text-left p-2.5 rounded-xl transition-all group flex items-start gap-3 cursor-pointer outline-none focus:bg-muted",
                                                      selectedModel === m.id ? "border" : "border-transparent"
                                                    )}
                                                    style={selectedModel === m.id ? { backgroundColor: `${color}15`, borderColor: `${color}30` } : {}}
                                                  >
                                                    <div className="size-2 rounded-full mt-1.5" style={{ backgroundColor: color, opacity: 0.6 }} />
                                                    <div className="flex flex-col min-w-0">
                                                      <p className="text-[11px] truncate" style={selectedModel === m.id ? { color } : {}}>{m.name || m.id}</p>
                                                    </div>
                                                  </DropdownMenuItem>
                                                ))}
                                              </div>
                                            );
                                          });
                                        })()}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Session Selector - Second from left with text */}
                        <div className="relative shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[9px] font-medium px-2 hover:scale-105 transition-all shrink-0 focus-visible:ring-0 gap-1"
                                    >
                                        <MessagesSquare className="size-3 text-muted-foreground" />
                                        <span className="max-w-[60px] truncate">{activeSessionData.displayName || activeSessionData.label || activeSession.split(":").pop()}</span>
                                        <ChevronDown className="size-2.5 opacity-40 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                                    <div className="p-3 border-b border-border/40 flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-50 pl-1">会话列表</span>
                                        <Button variant="ghost" size="icon" className="size-6 rounded-lg text-primary hover:bg-primary/5" onClick={handleNewSession}><Plus className="size-3.5" /></Button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1 p-1 custom-scrollbar">
                                        {(() => {
                                          const grouped: Record<string, typeof sessions> = {};
                                          sessions.forEach(s => {
                                            const agentPrefix = s.key?.startsWith("agent:") ? s.key.split(":")[1] : "main";
                                            if (!grouped[agentPrefix]) grouped[agentPrefix] = [];
                                            grouped[agentPrefix].push(s);
                                          });
                                          const getAgentColor = (agentId: string) => {
                                            if (agentId === "main") return "hsl(199, 89%, 48%)"; // Sky Blue for main
                                            const hash = agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                                            const hue = hash % 360;
                                            return `hsl(${hue}, 65%, 50%)`;
                                          };
                                          return Object.entries(grouped).map(([agentId, agentSessions]) => {
                                            const color = getAgentColor(agentId);
                                            return (
                                            <div key={agentId}>
                                              <div className="flex items-center gap-2 px-2.5 py-1.5 mt-1 first:mt-0">
                                                <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                                                <span className="text-[9px] font-medium uppercase tracking-widest opacity-40">{agentId}</span>
                                              </div>
                                              {agentSessions.map(s => (
                                                <DropdownMenuItem
                                                  key={s.key}
                                                  onClick={() => handleSwitchSession(s.key)}
                                                  className={cn(
                                                    "w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer outline-none focus:bg-muted",
                                                    activeSession === s.key ? "border" : "border-transparent"
                                                  )}
                                                  style={activeSession === s.key ? { backgroundColor: `${color}15`, borderColor: `${color}30` } : {}}
                                                >
                                                  <Bot className="size-3.5 shrink-0" style={{ color, opacity: 0.6 }} />
                                                  <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-[11px] truncate" style={activeSession === s.key ? { color } : {}}>{s.displayName || s.label || s.key.split(":").pop()}</p>
                                                    <p className="text-[9px] opacity-30 font-mono truncate">{s.key}</p>
                                                  </div>
                                                  {activeSession === s.key && <Check className="size-3" style={{ color }} />}
                                                </DropdownMenuItem>
                                              ))}
                                            </div>
                                          );
                                          });
                                        })()}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />

                        {/* Commands Dropdown - Icon only */}
                        <div className="relative shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline" size="sm"
                                        className="size-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-0 hover:scale-105 transition-all shrink-0 focus-visible:ring-0"
                                    >
                                        <SquareTerminal className="size-3.5 text-orange-500" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[60vh] overflow-y-auto">
                                    <div className="p-2.5 border-b border-border/40 text-[9px] font-medium uppercase opacity-40 tracking-widest pl-3 flex items-center gap-2 mb-1">
                                        <SquareTerminal className="size-3 text-orange-500" /> 命令控制台
                                    </div>
                                    <div className="space-y-0.5">
                                        {SLASH_COMMANDS.map(cmd => (
                                            <DropdownMenuItem
                                                key={cmd.name}
                                                onClick={() => handleCommandClick(cmd)}
                                                className="w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer outline-none focus:bg-muted hover:bg-muted"
                                            >
                                                <div className="size-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                                    <cmd.icon className="size-3.5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px]">/{cmd.name}</p>
                                                        {cmd.args && <span className="text-[8px] text-orange-500 font-mono">{cmd.args}</span>}
                                                    </div>
                                                    <p className="text-[9px] text-muted-foreground truncate">{cmd.description}</p>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Usage - Icon only Dropdown */}
                        <div className="relative shrink-0">
                            <DropdownMenu onOpenChange={(open) => setIsUsageDropdownOpen(open)}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline" size="sm"
                                        className="size-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-0 hover:scale-105 transition-all shrink-0 focus-visible:ring-0"
                                    >
                                        <BarChart2 className="size-3.5 text-green-500" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-3 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                                    {usageLoading ? (
                                        <div className="flex flex-col items-center justify-center gap-3 py-6">
                                            <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <p className="text-[10px] font-medium uppercase tracking-widest opacity-40">加载中...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-3">
                                                <BarChart2 className="size-4 text-green-500" />
                                                <span className="text-[10px] font-medium uppercase tracking-widest">用量统计</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                                                    <span className="text-[10px] flex items-center gap-2 opacity-60">
                                                        <div className="size-2 rounded-full bg-blue-500" /> 输入 Token
                                                    </span>
                                                    <span className="font-mono text-xs font-medium">{formatContext(activeSessionData.usage?.input || 0)}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                                                    <span className="text-[10px] flex items-center gap-2 opacity-60">
                                                        <div className="size-2 rounded-full bg-green-500" /> 输出 Token
                                                    </span>
                                                    <span className="font-mono text-xs font-medium">{formatContext(activeSessionData.usage?.output || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                                                <span className="text-[9px] font-medium uppercase tracking-widest text-primary/60">累计总计</span>
                                                <span className="font-mono text-lg font-bold text-primary">{formatContext((activeSessionData.usage?.input || 0) + (activeSessionData.usage?.output || 0))}</span>
                                            </div>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Details Toggle - Icon only */}
                        <Button
                            variant="outline" size="sm"
                            onClick={toggleDetails}
                            className={cn(
                                "size-7 rounded-full border-border/50 px-0 shadow-sm backdrop-blur-sm hover:scale-105 transition-all shrink-0",
                                showDetails ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-background/80 text-muted-foreground/40 grayscale"
                            )}
                        >
                            <Zap className="size-3.5" />
                        </Button>

                        {/* Context monitor deeply moved to React Portal */}
                    </motion.div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto pointer-events-auto">
                <motion.div 
                    layout
                    className="relative group/input"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 px-2 relative z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {pendingAttachments.map((attachment) => (
                                <div key={attachment.localId} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 group/file max-w-full">
                                    {attachment.kind === "image" ? <ImageIcon className="size-3 text-primary" /> : attachment.kind === "audio" ? <Music4 className="size-3 text-primary" /> : attachment.kind === "video" ? <Film className="size-3 text-primary" /> : <FileText className="size-3 text-primary" />}
                                    {attachment.previewUrl && attachment.kind === "image" ? (
                            <img src={attachment.previewUrl} alt={attachment.name} className="size-8 rounded-lg object-cover border border-primary/20" />
                                    ) : attachment.previewUrl && attachment.kind === "video" ? (
                            <video src={attachment.previewUrl} className="size-8 rounded-lg object-cover border border-primary/20" muted playsInline />
                                    ) : null}
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-bold truncate max-w-[150px]">{attachment.name}</div>
                                      <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                                        <span>{formatAttachmentSize(attachment.size)}</span>
                                        {attachment.kind === "audio" && <span>· {formatDuration(attachment.durationMs)}</span>}
                                        {attachment.kind === "video" && <span>· 视频</span>}
                                      </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            removeFile(attachment.localId);
                                        }}
                                        className="hover:text-destructive transition-colors ml-1 cursor-pointer p-0.5"
                                    >
                                        <XCircle className="size-3.5 fill-background" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={cn(
                        "absolute -inset-1 bg-gradient-to-r from-primary/30 via-purple-500/30 to-blue-500/30 rounded-[2.5rem] blur opacity-10 group-focus-within/input:opacity-50 transition duration-500",
                        isDragging && "opacity-100 ring-2 ring-primary scale-[1.01]"
                    )}></div>
                    <Card className={cn(
                        "relative bg-background/80 backdrop-blur-md border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2.2rem] overflow-hidden p-2 sm:p-3 flex items-center gap-2 sm:gap-3 pr-3 sm:pr-5 transition-all focus-within:ring-2 ring-primary/20",
                        isDragging && "bg-primary/5 border-primary/40 shadow-primary/20"
                    )}>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,audio/*,video/*,.pdf,.txt,.json,.zip,.docx,.xlsx,.pptx" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl sm:rounded-2xl size-8 sm:size-10 shrink-0 hover:bg-muted sm:ml-1"
                        >
                            <Plus className="size-5 text-muted-foreground" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            className={cn(
                              "rounded-xl sm:rounded-2xl size-8 sm:size-10 shrink-0 hover:bg-muted",
                              isRecording && "text-red-500 bg-red-500/10 hover:bg-red-500/15"
                            )}
                        >
                            {isRecording ? <Square className="size-4 sm:size-5" /> : <Mic className="size-4 sm:size-5 text-muted-foreground" />}
                        </Button>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Message OpenClaw..."
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[40px] sm:min-h-[48px] max-h-32 sm:max-h-48 py-2 sm:py-3 px-1 sm:px-2 text-sm sm:text-base font-medium custom-scrollbar"
                            rows={1}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={(!inputText.trim() && pendingAttachments.length === 0) || !connected}
                            className="rounded-xl sm:rounded-2xl size-9 sm:size-11 grow-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 active:scale-90 transition-all shrink-0"
                        >
                            {isTyping ? <LoaderCircle className="size-4 sm:size-5 animate-spin" /> : <Send className="size-4 sm:size-5" />}
                        </Button>
                    </Card>
                </motion.div>
            </div>
        </motion.div>

        <AnimatePresence>
          {sidebarOpen && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-[500px] border-l bg-background/60 backdrop-blur-3xl flex flex-col z-30 shadow-2xl"
        >
            <div className="p-8 border-b flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-5">
                    <div className="size-12 bg-primary/10 rounded-[1.2rem] flex items-center justify-center border border-primary/20">
                        <Terminal className="size-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-widest leading-tight">执行详情</h3>
                        <p className="text-[10px] text-muted-foreground font-black opacity-40 mt-1 uppercase tracking-tighter">报文分析控制台</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="rounded-xl hover:bg-destructive/10 hover:text-destructive"><XCircle className="size-7 stroke-[1.5]" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {sidebarContent || ""}
                    </ReactMarkdown>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>
);
}

const MessageItem = memo(({ role, content, sender, isStreaming, onOpenSidebar, message, agents, showDetails }: any) => {
  const isUser = role === "user";
  const { profile } = useProfile();
  const attachments = getMessageAttachments(message);
  const fallbackAttachments = useMemo(() => {
    if (attachments.length > 0) return [];
    return extractFallbackAttachmentsFromContent(content, message);
  }, [attachments.length, content, message]);
  const displayAttachments = attachments.length > 0 ? attachments : fallbackAttachments;

  const agentName = useMemo(() => {
    if (!message?.agentId) return null;
    const a = agents?.find((agent: any) => agent.id === message.agentId);
    return a?.name || a?.id;
  }, [agents, message?.agentId]);
  
  const parts = useMemo(() => {
    let initialParts: any[] = [];
    if (Array.isArray(content)) initialParts = content;
    else if (typeof content === 'string' && content.trim()) initialParts = [{ type: 'text', text: content }];
    else if (message?.text) initialParts = [{ type: 'text', text: message.text }];
    else if (message?.thinking || message?.thought) initialParts = [{ type: 'thinking', ...message }];
    else if (message?.name && (message?.arguments || message?.args)) initialParts = [{ type: 'tool_call', ...message }];
    else if (message?.toolCallId || message?.tool_call_id) initialParts = [{ type: 'tool_result', ...message }];
    
    // Extract <think> blocks from text parts
    const finalParts: any[] = [];
    initialParts.forEach(p => {
        const text = p.text || (typeof p === 'string' ? p : null);
        if (text && (p.type === 'text' || !p.type)) {
            let lastIndex = 0;
            const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
            let match;
            while ((match = thinkRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    finalParts.push({ type: 'text', text: text.slice(lastIndex, match.index) });
                }
                finalParts.push({ type: 'thinking', text: match[1] });
                lastIndex = thinkRegex.lastIndex;
            }
            if (lastIndex < text.length) {
                finalParts.push({ type: 'text', text: text.slice(lastIndex) });
            }
        } else {
            finalParts.push(p);
        }
    });

    return finalParts;
  }, [content, message]);

  const renderPart = (part: any, index: number) => {
    if (typeof part === "string") {
      const text = fallbackAttachments.length > 0 ? stripFallbackAttachmentLinks(part, fallbackAttachments) : part;
      if (!text || !text.trim()) return null;
      return <MemoizedMarkdown key={index} text={text} />;
    }

    const type = (part.type ||"").toLowerCase();
    
    // Robust type detection
    const isToolCall = ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(type) || (part.name && (part.arguments || part.args));
    const isToolResult = ["tool_result", "toolresult", "tool-result"].includes(type) || (part.toolCallId || part.tool_call_id);
    const isThinking = ["thinking", "thought", "reasoning"].includes(type) || part.thinking || part.thought;

    if (isThinking) {
        if (!showDetails) return null;
        const thinkingText = part.text || part.thinking || part.thought || "";
        if (!thinkingText || !thinkingText.trim()) return null;
        return (
            <div key={index} className="my-4 group/think">
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">
                        <Brain className="size-3" /> AI Reasoning
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/10 to-transparent" />
                </div>
                <div className="relative pl-6 border-l-2 border-primary/10 py-1 transition-all duration-500 hover:border-primary/30">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/50 italic text-[11px] sm:text-[13px] leading-relaxed selection:bg-primary/10">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {thinkingText}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        );
    }

    if (isToolCall) {
        const args = part.arguments || part.args || "";
        const argsStr = typeof args === "string" ? args : JSON.stringify(args, null, 2);
        
        // Compact mode for tools
        if (!showDetails) {
            return (
                <div key={index} className="my-1.5 flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/20 border border-border/20 shadow-sm w-fit max-w-full group hover:border-orange-500/20 transition-all duration-300">
                    <div className="size-6 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shrink-0">
                        <Terminal className="size-3 text-orange-600" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                        <span className="font-mono text-[10px] font-bold truncate opacity-80">{part.name || "Tool"}</span>
                        <div className="size-1 rounded-full bg-muted-foreground/20" />
                        <span className="font-mono text-[9px] truncate opacity-40 max-w-[150px]">{argsStr?.slice(0, 40)}{argsStr?.length > 40 ? "..." : ""}</span>
                    </div>
                    <div className="ml-auto flex items-center">
                        <div className="size-4 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Check className="size-2 text-emerald-600" />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div key={index} className="my-3 rounded-[1.5rem] border border-border/40 bg-muted/10 overflow-hidden shadow-sm group hover:border-orange-500/30 transition-all duration-500">
                <div className="flex items-center justify-between px-5 py-3.5 bg-muted/20 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <Terminal className="size-4 text-orange-600" />
                        </div>
                        <span className="font-black text-[13px] uppercase tracking-tight">{part.name || "Tool Call"}</span>
                    </div>
                    {!showDetails ? (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-600 uppercase">
                            <Check className="size-2" /> Done
                         </div>
                    ) : (
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-500/20 text-orange-600 bg-orange-500/5 px-2 py-0.5">Exec</Badge>
                    )}
                </div>
                {showDetails && argsStr && argsStr !== "{}" && (
                    <div className="p-4 font-mono text-[10px] leading-relaxed text-muted-foreground/70 bg-background/20 break-all select-all">
                        {argsStr}
                    </div>
                )}
            </div>
        );
    }

    if (isToolResult) {
        const resContent = part.content || part.text || part.result || "";
        const contentJson = typeof resContent === "string" ? resContent : JSON.stringify(resContent, null, 2);

        if (!showDetails) {
            return (
                <div key={index} className="my-1.5 flex items-center gap-3 px-3 py-2 rounded-2xl bg-primary/5 border border-primary/10 w-fit max-w-full opacity-60">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                        <span className="font-mono text-[10px] font-bold text-primary truncate">SYSTEM OUTPUT</span>
                        <div className="size-1 rounded-full bg-primary/20" />
                        <span className="font-mono text-[9px] truncate opacity-50 max-w-[150px] italic">JSON Metadata Result</span>
                    </div>
                </div>
            );
        }

        return (
            <div key={index} className="my-3 rounded-[1.5rem] border border-border/40 bg-muted/5 overflow-hidden shadow-sm group transition-all duration-500 hover:border-emerald-500/30">
                <div className="flex items-center justify-between px-5 py-3.5 bg-muted/10 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Wrench className="size-4 text-emerald-600" />
                        </div>
                        <span className="font-black text-[13px] uppercase tracking-tight">{part.name || "Result"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" size="sm" 
                            onClick={() => onOpenSidebar?.(`### 🛠️ 工具执行输出\n\n**工具名称:** \`${part.name || "Default"}\`\n\n#### 返回内容 (Payload)\n\n\`\`\`json\n${contentJson}\n\`\`\``)}
                            className="h-7 rounded-lg text-[9px] font-black uppercase tracking-widest border-primary/10 text-primary hover:bg-primary/5 px-3"
                        >
                            View <ChevronRight className="size-2.5 ml-1" />
                        </Button>
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-500/20 text-emerald-600 bg-emerald-500/5 px-2 py-0.5">OK</Badge>
                    </div>
                </div>
                {contentJson && contentJson !== "{}" && (
                    <div className="p-4 font-mono text-[10px] leading-relaxed text-muted-foreground/40 italic opacity-50 truncate">
                        {contentJson.slice(0, 120)}{contentJson.length > 120 ? "..." : ""}
                    </div>
                )}
            </div>
        );
    }

    // Explicit text handling
    if (type === "text" || !type) {
        let text = part.text || (typeof part === 'string' ? part : "");
        if (fallbackAttachments.length > 0) {
            text = stripFallbackAttachmentLinks(text, fallbackAttachments);
        }
        if (!text || !text.trim()) {
            if (isStreaming) return <span className="opacity-0">...</span>;
            return null;
        }

        // Technical noise detection for simplified mode
        if (!showDetails && (text.trim().startsWith("{") || text.includes("<EXTERNAL_UNTRUSTED_CONTENT"))) {
            return (
                <div key={index} className="my-1.5 flex items-center gap-3 px-3 py-2 rounded-2xl bg-primary/5 border border-primary/10 w-fit max-w-full opacity-60">
                    <div className="size-6 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shrink-0">
                        <Terminal className="size-3 text-orange-600" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                        <span className="font-mono text-[10px] font-bold text-orange-600 truncate">SYSTEM DATA</span>
                        <div className="size-1 rounded-full bg-orange-500/20" />
                        <span className="font-mono text-[9px] truncate opacity-40 max-w-[150px] italic">Technical payload collapsed</span>
                    </div>
                </div>
            );
        }

        text = text.replace(/<\/?final>/g, "").trim();
        if (!text) return null;
        return (
            <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {text}
            </ReactMarkdown>
        );
    }

    // Ultimate fallback for unknown complex parts
    let textContent = part.text || part.content || (typeof part === 'object' ? JSON.stringify(part) : String(part));
    if (!textContent || textContent === "{}" || textContent === '{"type":"text","text":""}') return null;
    
    // If it's pure JSON technical content and not in detail mode, hide it or simplify
    if (!showDetails && (textContent.trim().startsWith("{") || textContent.includes("<EXTERNAL_UNTRUSTED_CONTENT"))) {
        return (
            <div key={index} className="my-1.5 flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/40 border border-border/40 w-fit max-w-full opacity-60">
                <Box className="size-3 text-muted-foreground/60" />
                <span className="font-mono text-[9px] truncate opacity-40 italic">Hidden system bloat</span>
            </div>
        );
    }

    textContent = textContent.replace(/<\/?final>/g, "").trim();
    if (!textContent) return null;

    return (
        <MemoizedMarkdown key={index} text={textContent} />
    );
  };

  const displaySender = sender || message?.sender || (isUser ? "You" : (role === "tool" ? "Tool" : "Assistant"));
  const rawTs = message?.createdAt || message?.timestamp || message?.ts;
  const timestamp = rawTs ? new Date(rawTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  const fromId = message?.from;

  if (parts.length === 0 && displayAttachments.length === 0 && !isStreaming) return null;

  return (
    <div className={cn("flex gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out mb-4 sm:mb-6", isUser ? "flex-row-reverse" : "max-w-4xl")}>
      <div className={cn("size-7 sm:size-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border overflow-hidden shadow-sm transition-transform hover:scale-105 mt-1 sm:mt-0", isUser ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-background border-border")}>
        {isUser ? (profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <User className="size-4 sm:size-5" />) : <Bot className="size-4 sm:size-5 text-primary" />}
      </div>
      <div className={cn("flex-1 min-w-0 flex flex-col", isUser ? "items-end" : "items-start")}>
        <div className={cn("mb-1 sm:mb-2 px-1 sm:px-2 flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-muted-foreground/40 font-bold uppercase", isUser ? "flex-row-reverse" : "flex-row")}>
            {displaySender && <span className="text-muted-foreground/60">{displaySender}</span>}
            {fromId && <span className="opacity-50">({fromId})</span>}
            {timestamp && <span className="opacity-50 font-medium">{timestamp}</span>}
        </div>
        <div className={cn(
            "transition-all max-w-full",
            isUser ? "px-3.5 sm:px-6 py-2 sm:py-3.5 rounded-[1.2rem] sm:rounded-[1.8rem] shadow-sm border bg-indigo-50/30 border-indigo-100/40 rounded-tr-none text-indigo-950 font-medium" :
            ((!showDetails && parts.every(p => {
                const type = (p.type || "").toLowerCase();
                const text = (p.text || (typeof p === 'string' ? p : "")).trim();
                // Ignore truly empty parts
                if (!text && !p.name && !p.arguments && !p.args && !p.thinking && !p.thought) return true;

                const isToolCall = ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(type) || (p.name && (p.arguments || p.args));
                const isToolResult = ["tool_result", "toolresult", "tool-result"].includes(type) || (p.toolCallId || p.tool_call_id);
                const isThinking = ["thinking", "thought", "reasoning"].includes(type) || p.thinking || p.thought;
                const isTechNoise = (["text", ""].includes(type) && (text.startsWith("{") || text.includes("<EXTERNAL_UNTRUSTED_CONTENT")));
                return isToolCall || isToolResult || isThinking || isTechNoise || !text;
            })) ? "bg-transparent border-none shadow-none px-0 py-0" : "px-3.5 sm:px-6 py-2 sm:py-3.5 rounded-[1.2rem] sm:rounded-[1.8rem] shadow-sm border bg-background border-border/50 rounded-tl-none")
        )}>
            <div className={cn(
                "prose prose-sm dark:prose-invert max-w-none w-full break-words leading-tight sm:leading-relaxed text-[11px] sm:text-[14px] prose-p:my-1 sm:prose-p:my-2 prose-headings:text-base prose-headings:mt-3 prose-headings:mb-1 sm:prose-headings:mt-4 sm:prose-headings:mb-2 prose-h1:text-lg sm:prose-h1:text-xl prose-pre:p-2 sm:prose-pre:p-3 prose-li:my-0.5 overflow-visible"
            )}>
                {displayAttachments.length > 0 && (
                  <div className="not-prose mb-3 space-y-2">
                    {displayAttachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                        {attachment.kind === "image" ? (
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={attachment.url} alt={attachment.name} className="max-h-64 w-auto rounded-xl border border-border/50 object-cover" />
                          </a>
                        ) : attachment.kind === "audio" ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <Music4 className="size-4 text-primary" />
                              <span className="truncate">{attachment.name}</span>
                              {attachment.durationMs ? <span>· {formatDuration(attachment.durationMs)}</span> : null}
                            </div>
                            <audio controls src={attachment.url} className="w-full" />
                          </div>
                        ) : attachment.kind === "video" ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <Film className="size-4 text-primary" />
                              <span className="truncate">{attachment.name}</span>
                            </div>
                            <video controls src={attachment.url} className="max-h-80 w-full rounded-xl border border-border/50 bg-black" playsInline />
                          </div>
                        ) : (
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <FileText className="size-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{attachment.name}</div>
                              <div className="text-xs text-muted-foreground">{attachment.size > 0 ? formatAttachmentSize(attachment.size) : "点击下载附件"}</div>
                            </div>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {parts.map((part, i) => renderPart(part, i))}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 sm:h-5 bg-primary/80 ml-1 align-middle shadow-[0_0_8px_rgba(var(--primary),0.5)] rounded-full animate-pulse" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

function formatContext(num: number): string {
    if (!num) return "0";
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
}
