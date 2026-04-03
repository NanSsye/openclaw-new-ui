"use client";

import { motion } from "framer-motion";
import { LoaderCircle, Mic, Plus, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PendingAttachmentList } from "@/components/chat/attachment-list";
import type { PendingAttachment } from "@/lib/openclaw/chat-attachments";

export function ChatComposer({
  pendingAttachments,
  onRemoveAttachment,
  fileInputRef,
  onFileSelect,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  isRecording,
  onToggleRecording,
  inputText,
  onInputChange,
  onSend,
  connected,
  isTyping,
}: {
  pendingAttachments: PendingAttachment[];
  onRemoveAttachment: (localId: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: React.ChangeEventHandler<HTMLInputElement>;
  isDragging: boolean;
  onDragOver: React.DragEventHandler<HTMLDivElement>;
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
  onDrop: React.DragEventHandler<HTMLDivElement>;
  isRecording: boolean;
  onToggleRecording: () => void;
  inputText: string;
  onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
  connected: boolean;
  isTyping: boolean;
}) {
  return (
    <motion.div
      layout
      className="relative group/input"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <PendingAttachmentList attachments={pendingAttachments} onRemove={onRemoveAttachment} />
      <div
        className={cn(
          "absolute -inset-1 bg-gradient-to-r from-primary/30 via-purple-500/30 to-blue-500/30 rounded-[2.5rem] blur opacity-10 group-focus-within/input:opacity-50 transition duration-500",
          isDragging && "opacity-100 ring-2 ring-primary scale-[1.01]",
        )}
      />
      <Card
        className={cn(
          "relative bg-background/80 backdrop-blur-md border-border shadow-2xl rounded-[1.5rem] sm:rounded-[2.2rem] overflow-hidden p-2 sm:p-3 flex items-center gap-2 sm:gap-3 pr-3 sm:pr-5 transition-all focus-within:ring-2 ring-primary/20",
          isDragging && "bg-primary/5 border-primary/40 shadow-primary/20",
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileSelect}
          className="hidden"
          multiple
          accept="image/*,audio/*,video/*,.pdf,.txt,.json,.zip,.docx,.xlsx,.pptx"
        />
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
          onClick={onToggleRecording}
          className={cn(
            "rounded-xl sm:rounded-2xl size-8 sm:size-10 shrink-0 hover:bg-muted",
            isRecording && "text-red-500 bg-red-500/10 hover:bg-red-500/15",
          )}
        >
          {isRecording ? <Square className="size-4 sm:size-5" /> : <Mic className="size-4 sm:size-5 text-muted-foreground" />}
        </Button>
        <textarea
          value={inputText}
          onChange={onInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Message OpenClaw..."
          className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[40px] sm:min-h-[48px] max-h-32 sm:max-h-48 py-2 sm:py-3 px-1 sm:px-2 text-sm sm:text-base font-medium custom-scrollbar"
          rows={1}
        />
        <Button
          onClick={onSend}
          disabled={(!inputText.trim() && pendingAttachments.length === 0) || !connected}
          className="rounded-xl sm:rounded-2xl size-9 sm:size-11 grow-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 active:scale-90 transition-all shrink-0"
        >
          {isTyping ? <LoaderCircle className="size-4 sm:size-5 animate-spin" /> : <Send className="size-4 sm:size-5" />}
        </Button>
      </Card>
    </motion.div>
  );
}
