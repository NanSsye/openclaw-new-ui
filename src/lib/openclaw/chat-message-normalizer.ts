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

export function isToolDiagnosticText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\(no output\)$/i.test(trimmed)) return true;
  if (/^\d{3}$/.test(trimmed)) return true;
  if (/^\d+:[^:\n]+:\d+:/m.test(trimmed)) return true;
  if (/^\d+:[A-Za-z_][\w.]*\s*=/m.test(trimmed)) return true;
  if (/^\d+:\s*(def |function |const |let |var |import |from |return |with |if |elif |for |while |class )/m.test(trimmed)) return true;
  if (/^Command still running\b/i.test(trimmed)) return true;
  if (/^Process status\b/i.test(trimmed)) return true;
  if (/^OpenClaw status\b/i.test(trimmed)) return true;
  if (/^Testing:\s/i.test(trimmed)) return true;
  if (/^(Result|Output|stdout|stderr|Command|Exit code|Status):/im.test(trimmed)) return true;
  if (/^(Loaded|Active|Main PID|Tasks|Memory|CPU|CGroup):/im.test(trimmed)) return true;
  if (/^[•*-]\s+\S.*\b(loaded|active|running|failed)\b/im.test(trimmed) && /(Loaded:|Active:|Main PID:|Tasks:|Memory:|CPU:|CGroup:)/im.test(trimmed)) return true;
  if (/[┌┐└┘├┤┬┴─│]/.test(trimmed)) return true;
  if ((trimmed.match(/\|/g) || []).length >= 8) return true;
  if (trimmed.includes('"attachment":{') && /\/api\/chat\/attachments\//i.test(trimmed)) return true;
  if (/^\{\s*"attachment"\s*:/m.test(trimmed)) return true;
  if (/^total\s+\d+/im.test(trimmed)) return true;
  if (/(^|\s)[d-][rwx-]{9}(\s|$)/m.test(trimmed)) return true;
  if (/^adding:\s/im.test(trimmed)) return true;
  if (/(deflated|inflated|stored)\s+\d+%/im.test(trimmed)) return true;
  if (/^Done:\s+/im.test(trimmed)) return true;
  if (/^(cp|mv|ls|zip|unzip|tar|curl|wget|chmod|chown)\s+/im.test(trimmed)) return true;
  if (/\b(openclaw-[\w.-]+\.(zip|tar|tgz|gz|js))\b/i.test(trimmed)) return true;
  if (/^(\/(usr|tmp|root|app)\/[^\s]+)(:\d+)?$/im.test(trimmed)) return true;
  if (/^(\/(usr|tmp|root|app)\/[^\s]+)\s+\d+$/im.test(trimmed)) return true;
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const noisyLines = lines.filter((line) =>
      /^adding:\s/i.test(line)
      || /^total\s+\d+/i.test(line)
      || /(^|\s)[d-][rwx-]{9}(\s|$)/.test(line)
      || /(deflated|inflated|stored)\s+\d+%/i.test(line)
      || /\/tmp\//.test(line)
      || /\/usr\//.test(line)
      || /\/root\//.test(line)
      || /\/app\//.test(line)
      || /\.js\b/i.test(line)
      || /[┌┐└┘├┤┬┴─│]/.test(line)
      || (line.match(/\|/g) || []).length >= 3
      || /^(Loaded|Active|Main PID|Tasks|Memory|CPU|CGroup):/i.test(line)
      || /^OpenClaw status$/i.test(line)
      || /^\d+:[^:]+:\d+:/.test(line)
      || /^\d+:[A-Za-z_][\w.]*\s*=/.test(line)
      || /^\d+:\s*(def |function |const |let |var |import |from |return |with |if |elif |for |while |class )/.test(line)
    ).length;
    if (noisyLines >= Math.max(2, Math.ceil(lines.length * 0.5))) return true;
  }
  return false;
}

function appendToolDetail(part: ChatContentPart, extra: string): ChatContentPart {
  const previous = typeof part.detail === "string"
    ? part.detail
    : typeof part.content === "string"
      ? part.content
      : typeof part.result === "string"
        ? part.result
        : "";
  return {
    ...part,
    detail: previous ? `${previous}\n\n${extra}` : extra,
  };
}

function mergeAdjacentToolOutput(parts: ChatContentPart[]): ChatContentPart[] {
  const merged: ChatContentPart[] = [];
  for (const part of parts) {
    const type = (part.type || "").toLowerCase();
    const text = typeof part.text === "string" ? part.text : "";
    const previous = merged[merged.length - 1];
    const previousType = (previous?.type || "").toLowerCase();
    const previousIsTool = !!previous && (["tool_result", "toolresult", "tool-result", "tool_call", "toolcall", "tool_use", "tooluse", "tool-call"].includes(previousType) || !!previous.name);

    if ((type === "text" || !type) && isToolDiagnosticText(text) && previousIsTool) {
      merged[merged.length - 1] = appendToolDetail(previous, text);
      continue;
    }

    merged.push(part);
  }
  return merged;
}

export function normalizeMessageParts(content: ChatMessage["content"], message?: ChatMessage | null): ChatContentPart[] {
  let initialParts: ChatContentPart[] = [];
  if (Array.isArray(content)) {
    initialParts = content;
    const textFromMessage = typeof message?.text === "string" ? message.text.trim() : "";
    const contentText = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (textFromMessage && textFromMessage !== contentText) {
      initialParts = [...initialParts, { type: "text", text: textFromMessage }];
    }
  }
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

  return mergeAdjacentToolOutput(finalParts);
}

