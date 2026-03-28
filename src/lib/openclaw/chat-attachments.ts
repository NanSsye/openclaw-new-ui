const CHAT_ATTACHMENT_API_BASE =
  process.env.NEXT_PUBLIC_CHAT_ATTACHMENT_API || "https://lt.xianan.xin:1563";

export type ChatAttachmentKind = "file" | "image" | "audio" | "video";

export type ChatAttachment = {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

export type PendingAttachmentStatus = "queued" | "uploading" | "uploaded" | "failed";

export type PendingAttachment = {
  localId: string;
  kind: ChatAttachmentKind;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  durationMs?: number;
  status: PendingAttachmentStatus;
  uploaded?: ChatAttachment;
  error?: string;
};

export const MAX_CHAT_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export function detectAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export async function uploadChatAttachment(file: File, sessionKey: string, extra?: { durationMs?: number }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sessionKey", sessionKey);
  formData.append("kind", detectAttachmentKind(file.type || "application/octet-stream"));
  if (typeof extra?.durationMs === "number") {
    formData.append("durationMs", String(extra.durationMs));
  }

  const res = await fetch(`${CHAT_ATTACHMENT_API_BASE}/api/chat/attachments`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "附件上传失败");
  }

  return data.attachment as ChatAttachment;
}
