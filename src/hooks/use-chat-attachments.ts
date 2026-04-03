"use client";

import { useCallback, useEffect, useState } from "react";
import { generateUUID } from "@/lib/openclaw/uuid";
import { detectAttachmentKind, MAX_CHAT_ATTACHMENT_SIZE, type PendingAttachment } from "@/lib/openclaw/chat-attachments";

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

export function useChatAttachments({
  toast,
}: {
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const appendFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const nextAttachments = await Promise.all(
      files.map(async (file) => createPendingAttachment(file, { durationMs: await getAudioDurationMs(file) })),
    );
    const accepted = nextAttachments.filter((attachment) => attachment.size <= MAX_CHAT_ATTACHMENT_SIZE);
    const rejected = nextAttachments.filter((attachment) => attachment.size > MAX_CHAT_ATTACHMENT_SIZE);

    rejected.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });

    if (rejected.length > 0) {
      const description =
        rejected.length === 1
          ? `${rejected[0].name} 超过 20MB 限制`
          : "超过 20MB 的附件已被忽略";
      toast({ title: rejected.length === 1 ? "附件过大" : "部分附件未加入", description, variant: "destructive" });
    }

    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
  }, [toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await appendFiles(files);
    e.target.value = "";
  }, [appendFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    await appendFiles(files);
  }, [appendFiles]);

  const removeFile = useCallback((localId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((attachment) => attachment.localId === localId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((attachment) => attachment.localId !== localId);
    });
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      prev.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      return [];
    });
  }, []);

  useEffect(() => {
    return () => {
      pendingAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [pendingAttachments]);

  return {
    pendingAttachments,
    setPendingAttachments,
    appendFiles,
    handleFileSelect,
    handleDrop,
    removeFile,
    clearPendingAttachments,
  };
}
