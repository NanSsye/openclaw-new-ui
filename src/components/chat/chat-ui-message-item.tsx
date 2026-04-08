"use client";

import { Bot } from "lucide-react";
import type { AgentItem, UiChatMessage } from "@/lib/openclaw/chat-types";
import { ToolCard } from "./tool-card";
import { MessageItem } from "./message-item";

export function ChatUiMessageItem({
  message,
  agents,
  showDetails,
  onOpenSidebar,
}: {
  message: UiChatMessage;
  agents?: AgentItem[];
  showDetails: boolean;
  onOpenSidebar?: (content: string) => void;
}) {
  if (message.role !== "tool") {
    return (
      <MessageItem
        key={message.id}
        role={message.role}
        content={message.content}
        sender={message.sender}
        isStreaming={!!message.streaming}
        onOpenSidebar={onOpenSidebar}
        message={message.sourceMessage ?? {
          id: message.id,
          role: message.role,
          content: message.content,
          text: message.text,
          attachments: message.attachments,
          files: message.files,
          createdAt: message.createdAt,
          timestamp: message.timestamp,
          ts: message.ts,
          sender: message.sender,
          from: message.from,
          agentId: message.agentId,
        }}
        agents={agents}
        showDetails={showDetails}
      />
    );
  }

  const rawTs = message.createdAt || message.timestamp || message.ts;
  const timestamp = rawTs ? new Date(rawTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="flex gap-2 sm:gap-3 mb-3 sm:mb-4 max-w-4xl">
      <div className="size-7 sm:size-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border overflow-hidden shadow-sm mt-1 sm:mt-0 bg-background border-border">
        <Bot className="size-4 sm:size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col items-start">
        <div className="mb-1 px-1 sm:px-2 flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-muted-foreground/40 font-bold uppercase">
          <span className="text-muted-foreground/60">{message.sender || "Assistant"}</span>
          {timestamp && <span className="opacity-50 font-medium">{timestamp}</span>}
        </div>
        <div className="w-full">
          <ToolCard
            name={message.toolName || "tool"}
            status={message.toolStatus || "success"}
            summary={message.toolSummary}
            args={message.toolArgs}
            detail={message.toolDetail}
            durationMs={message.toolDurationMs}
          />
        </div>
      </div>
    </div>
  );
}
