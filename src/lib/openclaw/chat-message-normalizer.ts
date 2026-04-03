import type { ChatAttachment } from "@/lib/openclaw/chat-attachments";
import type { ChatContentPart, ChatMessage } from "@/lib/openclaw/chat-types";

export function getMessageAttachments(message?: ChatMessage | null): ChatAttachment[] {
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

function isSupportedFileAttachmentUrl(url: string) {
  const normalized = url.toLowerCase().split(/[?#]/)[0];
  return (
    /\/api\/chat\/attachments\//i.test(url) ||
    /\.(pdf|txt|md|json|csv|zip|7z|rar|doc|docx|xls|xlsx|ppt|pptx)$/i.test(normalized)
  );
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
    if (kind === "file" && !isSupportedFileAttachmentUrl(url)) return [];
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

export function extractFallbackAttachmentsFromContent(content: ChatMessage["content"], message?: ChatMessage | null): ChatAttachment[] {
  const seen = new Map<string, ChatAttachment>();
  const addFromText = (text: unknown) => {
    if (typeof text !== "string" || !text) return;
    for (const attachment of extractFallbackAttachments(text)) {
      if (!seen.has(attachment.url)) {
        seen.set(attachment.url, attachment);
      }
    }
  };

  if (typeof content === "string") addFromText(content);
  else if (Array.isArray(content)) {
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

export function stripFallbackAttachmentLinks(text: string, attachments: ChatAttachment[]) {
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

export function normalizeMessageParts(content: ChatMessage["content"], message?: ChatMessage | null): ChatContentPart[] {
  let initialParts: ChatContentPart[] = [];
  if (Array.isArray(content)) initialParts = content;
  else if (typeof content === "string" && content.trim()) initialParts = [{ type: "text", text: content }];
  else if (message?.text) initialParts = [{ type: "text", text: message.text }];
  else if (message?.thinking || message?.thought) initialParts = [{ type: "thinking", ...message }];
  else if (message?.name && (message?.arguments || message?.args)) initialParts = [{ type: "tool_call", ...message }];
  else if (message?.toolCallId || message?.tool_call_id) initialParts = [{ type: "tool_result", ...message }];

  const finalParts: ChatContentPart[] = [];
  initialParts.forEach((part) => {
    const text = part.text ?? null;
    if (text && (part.type === "text" || !part.type)) {
      let lastIndex = 0;
      const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
      let match: RegExpExecArray | null;
      while ((match = thinkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) finalParts.push({ type: "text", text: text.slice(lastIndex, match.index) });
        finalParts.push({ type: "thinking", text: match[1] });
        lastIndex = thinkRegex.lastIndex;
      }
      if (lastIndex < text.length) finalParts.push({ type: "text", text: text.slice(lastIndex) });
    } else {
      finalParts.push(part);
    }
  });

  return finalParts;
}
