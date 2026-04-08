"use client";

import { memo, useMemo, type ComponentPropsWithoutRef, type ComponentType, type JSX, type ReactNode } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import type { AgentItem, ChatContentPart, ChatMessage } from "@/lib/openclaw/chat-types";
import {
  extractFallbackAttachmentsFromContent,
  getMessageAttachments,
  normalizeMessageParts,
  stripFallbackAttachmentLinks,
  isToolDiagnosticText,
} from "@/lib/openclaw/chat-message-normalizer";
import { ChatAttachmentList } from "./attachment-list";
import { Bot, Brain, Box, Terminal, User } from "lucide-react";
import { ToolCard } from "./tool-card";

const UnsafeSyntaxHighlighter = SyntaxHighlighter as unknown as ComponentType<{
  language?: string;
  PreTag?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: ReactNode;
}>;

type MarkdownNodeProps<T extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & {
    node?: unknown;
    inline?: boolean;
    children?: ReactNode;
  };

const markdownComponents = {
  code({ inline, className, children, ...props }: MarkdownNodeProps<"code">) {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <UnsafeSyntaxHighlighter
        language={match[1]}
        PreTag="div"
        className="rounded-xl my-4 text-xs overflow-x-auto"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </UnsafeSyntaxHighlighter>
    ) : (
      <code className={cn("bg-muted px-1.5 py-0.5 rounded text-xs break-all", className)} {...props}>
        {children}
      </code>
    );
  },
  p: ({ children }: MarkdownNodeProps<"p">) => <p className="leading-relaxed mb-3 last:mb-0 break-words overflow-wrap-break-word">{children}</p>,
  ul: ({ children }: MarkdownNodeProps<"ul">) => <ul className="list-disc pl-5 mb-4 space-y-1 break-words">{children}</ul>,
  ol: ({ children }: MarkdownNodeProps<"ol">) => <ol className="list-decimal pl-5 mb-4 space-y-1 break-words">{children}</ol>,
  li: ({ children }: MarkdownNodeProps<"li">) => <li className="break-words leading-relaxed">{children}</li>,
  a: ({ ...props }: MarkdownNodeProps<"a">) => <a {...props} className="text-primary hover:underline font-bold break-all overflow-wrap-break-word" target="_blank" rel="noopener noreferrer" />,
  h1: ({ children }: MarkdownNodeProps<"h1">) => <h1 className="text-xl font-black mt-6 mb-4 break-words">{children}</h1>,
  h2: ({ children }: MarkdownNodeProps<"h2">) => <h2 className="text-lg font-black mt-5 mb-3 break-words">{children}</h2>,
  h3: ({ children }: MarkdownNodeProps<"h3">) => <h3 className="text-base font-black mt-4 mb-2 break-words">{children}</h3>,
  table: ({ children }: MarkdownNodeProps<"table">) => <table className="min-w-full divide-y divide-border overflow-auto my-4 text-xs block">{children}</table>,
  thead: ({ children }: MarkdownNodeProps<"thead">) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }: MarkdownNodeProps<"tbody">) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }: MarkdownNodeProps<"tr">) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
  th: ({ children }: MarkdownNodeProps<"th">) => <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider">{children}</th>,
  td: ({ children }: MarkdownNodeProps<"td">) => <td className="px-3 py-2 whitespace-nowrap">{children}</td>,
  strong: ({ children }: MarkdownNodeProps<"strong">) => <strong className="font-bold break-words">{children}</strong>,
  em: ({ children }: MarkdownNodeProps<"em">) => <em className="italic break-words">{children}</em>,
};

const MemoizedMarkdown = memo(({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{text}</ReactMarkdown>
));
MemoizedMarkdown.displayName = "MemoizedMarkdown";

export type MessageItemProps = {
  role?: string;
  content?: ChatMessage["content"];
  sender?: string;
  isStreaming: boolean;
  onOpenSidebar?: (content: string) => void;
  message?: ChatMessage;
  agents?: AgentItem[];
  showDetails: boolean;
};

export const MessageItem = memo(({ role, content, sender, isStreaming, message, agents, showDetails }: MessageItemProps) => {
  const isUser = role === "user";
  const { profile } = useProfile();
  const attachments = getMessageAttachments(message);
  const fallbackAttachments = useMemo(() => {
    if (attachments.length > 0) return [];
    return extractFallbackAttachmentsFromContent(content, message);
  }, [attachments.length, content, message]);
  const displayAttachments = attachments.length > 0 ? attachments : fallbackAttachments;
  const matchedAgent = message?.agentId ? agents?.find((agent) => agent.id === message.agentId) : undefined;
  const agentName = matchedAgent?.name || matchedAgent?.id || null;

  const parts = useMemo(() => normalizeMessageParts(content, message), [content, message]);
  const isPureToolNoiseMessage = useMemo(() => {
    if (displayAttachments.length > 0) return false;
    if (parts.length === 0) return false;
    return parts.every((part) => {
      if (typeof part === "string") return isToolDiagnosticText(part);
      const type = (part.type || "").toLowerCase();
      const text = typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "";
      const isToolCall = ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(type) || !!(part.name && (part.arguments || part.args));
      const isToolResult = ["tool_result", "toolresult", "tool-result"].includes(type) || !!(part.toolCallId || part.tool_call_id);
      const isThinking = ["thinking", "thought", "reasoning"].includes(type) || !!(part.thinking || part.thought);
      return isToolCall || isToolResult || isThinking || isToolDiagnosticText(text);
    });
  }, [displayAttachments.length, parts]);

  const renderPart = (part: ChatContentPart | string, index: number) => {
    if (typeof part === "string") {
      const text = fallbackAttachments.length > 0 ? stripFallbackAttachmentLinks(part, fallbackAttachments) : part;
      if (!text || !text.trim()) return null;
      return <MemoizedMarkdown key={index} text={text} />;
    }

    const type = (part.type || "").toLowerCase();
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
      return (
        <ToolCard
          key={index}
          name={String(part.name || "tool")}
          status="running"
          summary={typeof part.summary === "string" ? part.summary : undefined}
          args={part.arguments || part.args}
        />
      );
    }

    if (isToolResult) {
      const resContent = part.content || part.text || part.result || "";
      return (
        <ToolCard
          key={index}
          name={String(part.name || "tool")}
          status="success"
          summary={typeof part.summary === "string" ? part.summary : undefined}
          detail={resContent}
        />
      );
    }

    if (type === "text" || !type) {
      let text = part.text || "";
      if (fallbackAttachments.length > 0) text = stripFallbackAttachmentLinks(text, fallbackAttachments);
      if (!text || !text.trim()) return isStreaming ? <span className="opacity-0">...</span> : null;
      if (!showDetails && isToolDiagnosticText(text)) {
        return null;
      }
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
      return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={markdownComponents}>{text}</ReactMarkdown>;
    }

    let textContent: string = typeof part.text === "string"
      ? part.text
      : typeof part.content === "string"
        ? part.content
        : typeof part === "object"
          ? JSON.stringify(part)
          : String(part);
    if (!textContent || textContent === "{}" || textContent === '{"type":"text","text":""}') return null;
    if (!showDetails && (String(textContent).trim().startsWith("{") || String(textContent).includes("<EXTERNAL_UNTRUSTED_CONTENT"))) {
      return (
        <div key={index} className="my-1.5 flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/40 border border-border/40 w-fit max-w-full opacity-60">
          <Box className="size-3 text-muted-foreground/60" />
          <span className="font-mono text-[9px] truncate opacity-40 italic">Hidden system bloat</span>
        </div>
      );
    }

    textContent = String(textContent).replace(/<\/?final>/g, "").trim();
    if (!textContent) return null;
    return <MemoizedMarkdown key={index} text={textContent} />;
  };

  const displaySender = sender || agentName || message?.sender || (isUser ? "You" : (role === "tool" ? "Tool" : "Assistant"));
  const rawTs = message?.createdAt || message?.timestamp || message?.ts;
  const timestamp = rawTs ? new Date(rawTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const fromId = message?.from;
  if ((parts.length === 0 && displayAttachments.length === 0 && !isStreaming) || (!showDetails && isPureToolNoiseMessage)) return null;

  return (
    <div className={cn("flex gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out mb-4 sm:mb-6", isUser ? "flex-row-reverse" : "max-w-4xl")}>
      <div className={cn("size-7 sm:size-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border overflow-hidden shadow-sm transition-transform hover:scale-105 mt-1 sm:mt-0", isUser ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-background border-border")}>
        {isUser ? (profile.avatar ? <Image src={profile.avatar} alt={displaySender || "用户头像"} width={36} height={36} unoptimized className="w-full h-full object-cover" /> : <User className="size-4 sm:size-5" />) : <Bot className="size-4 sm:size-5 text-primary" />}
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
          ((!showDetails && parts.every((part) => {
            const type = (part.type || "").toLowerCase();
            const text = (part.text || "").trim();
            if (!text && !part.name && !part.arguments && !part.args && !part.thinking && !part.thought) return true;
            const isToolCall = ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(type) || (part.name && (part.arguments || part.args));
            const isToolResult = ["tool_result", "toolresult", "tool-result"].includes(type) || (part.toolCallId || part.tool_call_id);
            const isThinking = ["thinking", "thought", "reasoning"].includes(type) || part.thinking || part.thought;
            const isTechNoise = (["text", ""].includes(type) && (text.startsWith("{") || text.includes("<EXTERNAL_UNTRUSTED_CONTENT")));
            return isToolCall || isToolResult || isThinking || isTechNoise || !text;
          })) ? "bg-transparent border-none shadow-none px-0 py-0" : "px-3.5 sm:px-6 py-2 sm:py-3.5 rounded-[1.2rem] sm:rounded-[1.8rem] shadow-sm border bg-background border-border/50 rounded-tl-none")
        )}>
          <div className="prose prose-sm dark:prose-invert max-w-none w-full break-words leading-tight sm:leading-relaxed text-[11px] sm:text-[14px] prose-p:my-1 sm:prose-p:my-2 prose-headings:text-base prose-headings:mt-3 prose-headings:mb-1 sm:prose-headings:mt-4 sm:prose-headings:mb-2 prose-h1:text-lg sm:prose-h1:text-xl prose-pre:p-2 sm:prose-pre:p-3 prose-li:my-0.5 overflow-visible">
            <ChatAttachmentList attachments={displayAttachments} />
            {parts.map((part, index) => renderPart(part, index))}
            {isStreaming && <span className="inline-block w-1.5 h-4 sm:h-5 bg-primary/80 ml-1 align-middle shadow-[0_0_8px_rgba(var(--primary),0.5)] rounded-full animate-pulse" />}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";









