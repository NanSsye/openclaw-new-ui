"use client";

import { XCircle, ImageIcon, Music4, Film, FileText } from "lucide-react";
import Image from "next/image";
import { formatAttachmentSize, type ChatAttachment, type PendingAttachment } from "@/lib/openclaw/chat-attachments";

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 0) return "--:--";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PendingAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: PendingAttachment[];
  onRemove: (localId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2 px-2 relative z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {attachments.map((attachment) => (
        <div key={attachment.localId} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 group/file max-w-full">
          {attachment.kind === "image" ? <ImageIcon className="size-3 text-primary" /> : attachment.kind === "audio" ? <Music4 className="size-3 text-primary" /> : attachment.kind === "video" ? <Film className="size-3 text-primary" /> : <FileText className="size-3 text-primary" />}
          {attachment.previewUrl && attachment.kind === "image" ? (
            <Image src={attachment.previewUrl} alt={attachment.name} width={32} height={32} unoptimized className="size-8 rounded-lg object-cover border border-primary/20" />
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
              onRemove(attachment.localId);
            }}
            className="hover:text-destructive transition-colors ml-1 cursor-pointer p-0.5"
          >
            <XCircle className="size-3.5 fill-background" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ChatAttachmentList({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="not-prose mb-3 space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-2xl border border-border/50 bg-muted/20 p-3">
          {attachment.kind === "image" ? (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
  );
}
