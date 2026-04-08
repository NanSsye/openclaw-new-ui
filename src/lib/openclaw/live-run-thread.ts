import {
  extractFallbackAttachmentsFromContent,
  getMessageAttachments,
  isToolDiagnosticText,
  normalizeMessageParts,
} from "@/lib/openclaw/chat-message-normalizer";
import type { ChatContentPart, ChatMessage, UiChatMessage } from "@/lib/openclaw/chat-types";

export type ToolTransientMessage = ChatMessage & {
  id: string;
  role: "tool";
};

export type StreamSegment = {
  id: string;
  text: string;
  timestampMs: number;
};

function isTerminalAssistantMessage(message: UiChatMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return message.id.startsWith("final_") || message.id.startsWith("abort_");
}

function toTimestamp(message: ChatMessage): string | number | undefined {
  return message.createdAt ?? message.timestamp ?? message.ts;
}

function makeToolUiId(message: ChatMessage, index: number, kind: "call" | "result"): string {
  const baseId = String(message.id || "msg");
  const ts = String(toTimestamp(message) || Date.now());
  return `${baseId}_${kind}_${ts}_${index}`;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function sanitizeAttachmentText(text: string, attachmentUrls: string[]): string {
  if (!text.trim()) return "";
  const filteredLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (attachmentUrls.some((url) => line === url)) return false;
      if (/^generated:\s*\d+\s+images?\s+url/i.test(line)) return false;
      if (/^url\s*\d+\s*:/i.test(line)) return false;
      if (/^process exited with code \d+/i.test(line)) return false;
      if (/^saved to:/i.test(line)) return false;
      if (/^output file:/i.test(line)) return false;
      return true;
    });
  return filteredLines.join("\n").trim();
}

function dedupeAttachmentEchoes(messages: UiChatMessage[]): UiChatMessage[] {
  const next: UiChatMessage[] = [];
  for (let index = 0; index < messages.length; index++) {
    const current = messages[index];
    const following = messages[index + 1];

    if (
      current?.role === "assistant"
      && following?.role === "assistant"
      && Array.isArray(current.attachments)
      && current.attachments.length > 0
      && Array.isArray(following.attachments)
      && following.attachments.length > 0
    ) {
      const currentUrls = new Set(current.attachments.map((attachment) => attachment.url));
      const followingUrls = new Set(following.attachments.map((attachment) => attachment.url));
      const hasOverlap = Array.from(currentUrls).some((url) => followingUrls.has(url));
      const currentText = (current.text || "").trim();
      const followingText = (following.text || "").trim();
      if (hasOverlap && !currentText && !!followingText) {
        continue;
      }
    }

    next.push(current);
  }
  return next;
}

function isCodeHeavyDiagnosticText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^import\s.+\sfrom\s.+/m.test(trimmed)) return true;
  if (/^def\s+\w+\(/m.test(trimmed)) return true;
  if (/^function\s+\w+\(/m.test(trimmed)) return true;
  if (/^const\s+\w+\s*=.+/m.test(trimmed)) return true;
  if (/^if\s+.+:/m.test(trimmed)) return true;
  if (/^find:\s.+/m.test(trimmed)) return true;
  if (/^(\/(usr|tmp|root|app)\/[^\s]+)(:\d+)?$/im.test(trimmed)) return true;
  if (/^(\/(usr|tmp|root|app)\/[^\s]+)\s+\d+$/im.test(trimmed)) return true;
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const codeLikeLines = lines.filter((line) =>
    /^import\s/.test(line)
    || /^def\s+\w+\(/.test(line)
    || /^function\s+\w+\(/.test(line)
    || /^const\s+\w+\s*=/.test(line)
    || /^return\s+/.test(line)
    || /^if\s+/.test(line)
    || /^export\s+/.test(line)
    || /^find:\s/.test(line)
    || /\/(usr|tmp|root|app)\//.test(line)
    || /\.js\b/i.test(line)
  ).length;
  return codeLikeLines >= Math.max(1, Math.ceil(lines.length * 0.3));
}

function isDiagnosticText(text: string): boolean {
  return isToolDiagnosticText(text) || isCodeHeavyDiagnosticText(text);
}

function isToolPart(part: ChatContentPart): boolean {
  const type = String(part.type || "").toLowerCase();
  return ["tool_call", "toolcall", "tool_use", "tooluse", "tool-call", "toolinvocation", "tool_invocation"].includes(type)
    || !!(part.name && (part.arguments || part.args || part.input));
}

function isToolResultPart(part: ChatContentPart): boolean {
  const type = String(part.type || "").toLowerCase();
  return ["tool_result", "toolresult", "tool-result", "tooloutput", "tool_output"].includes(type)
    || !!(part.toolCallId || part.tool_call_id || part.callId || part.call_id);
}

function buildAssistantUiMessage(message: ChatMessage, parts: ChatContentPart[]): UiChatMessage | null {
  const attachments = getMessageAttachments(message);
  const fallbackAttachments = attachments.length > 0 ? [] : extractFallbackAttachmentsFromContent(message.content, message);
  const displayAttachments = attachments.length > 0 ? attachments : fallbackAttachments;
  const attachmentUrls = displayAttachments.map((attachment) => attachment.url).filter(Boolean);
  const compactParts = parts
    .map((part) => {
      if (displayAttachments.length === 0) return part;
      if (typeof part.text === "string" && ((part.type || "").toLowerCase() === "text" || !part.type)) {
        const sanitized = sanitizeAttachmentText(part.text, attachmentUrls);
        return sanitized ? { ...part, text: sanitized } : { ...part, text: "" };
      }
      return part;
    })
    .filter((part) => {
    if ((part.type || "").toLowerCase() === "text") {
      const text = typeof part.text === "string" ? part.text.trim() : "";
      return text.length > 0;
    }
    if (["thinking", "thought", "reasoning"].includes(String(part.type || "").toLowerCase())) {
      const text = typeof part.text === "string" ? part.text.trim() : typeof part.thinking === "string" ? part.thinking.trim() : typeof part.thought === "string" ? part.thought.trim() : "";
      return text.length > 0;
    }
    return true;
  });

  if (compactParts.length === 0 && displayAttachments.length === 0) return null;

  return {
    id: String(message.id || `assistant_${toTimestamp(message) || Date.now()}`),
    role: message.role === "user" ? "user" : "assistant",
    content: compactParts,
    text: compactParts
      .map((part) => typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "")
      .filter(Boolean)
      .join("\n")
      .trim(),
    attachments: displayAttachments,
    files: message.files,
    createdAt: message.createdAt,
    timestamp: message.timestamp,
    ts: message.ts,
    sender: message.sender,
    from: message.from,
    agentId: message.agentId,
    sourceMessage: message,
  };
}

function buildToolUiMessage(params: {
  id: string;
  sourceMessage: ChatMessage;
  name: string;
  status: "running" | "success" | "error";
  summary?: string;
  args?: unknown;
  detail?: unknown;
}): UiChatMessage {
  return {
    id: params.id,
    role: "tool",
    toolName: params.name,
    toolStatus: params.status,
    toolSummary: params.summary,
    toolArgs: params.args,
    toolDetail: params.detail,
    createdAt: params.sourceMessage.createdAt,
    timestamp: params.sourceMessage.timestamp,
    ts: params.sourceMessage.ts,
    sender: params.sourceMessage.sender,
    from: params.sourceMessage.from,
    agentId: params.sourceMessage.agentId,
    sourceMessage: params.sourceMessage,
  };
}

function appendToolDetail(message: UiChatMessage, extra: string): UiChatMessage {
  const current = typeof message.toolDetail === "string"
    ? message.toolDetail
    : message.toolDetail == null
      ? ""
      : stringifyUnknown(message.toolDetail).trim();
  const merged = current ? `${current}\n\n${extra}` : extra;
  return {
    ...message,
    toolStatus: message.toolStatus === "error" ? "error" : "success",
    toolDetail: merged,
  };
}

function settleToolMessage(message: UiChatMessage): UiChatMessage {
  if (message.role !== "tool") return message;
  if (message.toolStatus === "error") return message;
  return {
    ...message,
    toolStatus: "success",
  };
}

function splitToolNarration(detail: unknown): { detail: unknown; followupText?: string } {
  if (typeof detail !== "string") return { detail };
  const normalized = detail.trim();
  if (!normalized) return { detail };

  const blocks = normalized.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 2) return { detail: normalized };

  const assistantLike = (text: string) => {
    if (isDiagnosticText(text)) return false;
    if (/[\u4e00-\u9fff]/.test(text)) return true;
    if (/^(i |i'm |done\b|okay\b|ok\b|looks like\b|it looks\b|we're\b|we are\b|back\b)/i.test(text)) return true;
    return false;
  };

  let splitIndex = blocks.length;
  for (let index = blocks.length - 1; index >= 1; index -= 1) {
    if (!assistantLike(blocks[index])) break;
    splitIndex = index;
  }

  if (splitIndex >= blocks.length) return { detail: normalized };

  const toolDetail = blocks.slice(0, splitIndex).join("\n\n").trim();
  const followupText = blocks.slice(splitIndex).join("\n\n").trim();
  if (!toolDetail || !followupText) return { detail: normalized };

  return {
    detail: toolDetail,
    followupText,
  };
}

function buildAssistantTextUiMessage(source: ChatMessage, text: string): UiChatMessage | null {
  if (!text.trim()) return null;
  return buildAssistantUiMessage(
    { ...source, role: "assistant", content: [{ type: "text", text }], text },
    [{ type: "text", text }],
  );
}

function getDiagnosticAssistantText(parts: ChatContentPart[]): string | null {
  const textParts = parts
    .filter((part) => {
      const type = String(part.type || "").toLowerCase();
      return type === "text" || !type;
    })
    .map((part) => (typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "").trim())
    .filter(Boolean);

  if (textParts.length === 0) return null;
  if (textParts.every((text) => isDiagnosticText(text))) {
    return textParts.join("\n\n").trim();
  }
  return null;
}

function buildHistoryUiMessages(messages: ChatMessage[]): UiChatMessage[] {
  const ui: UiChatMessage[] = [];
  let activeToolIndex: number | null = null;

  for (const message of messages) {
    const messageAttachments = getMessageAttachments(message);
    const fallbackAttachments = messageAttachments.length > 0 ? [] : extractFallbackAttachmentsFromContent(message.content, message);
    const displayAttachments = messageAttachments.length > 0 ? messageAttachments : fallbackAttachments;

    if (message.role === "user") {
      const userUi = buildAssistantUiMessage({ ...message, role: "user" }, normalizeMessageParts(message.content, message));
      if (userUi) ui.push({ ...userUi, role: "user" });
      activeToolIndex = null;
      continue;
    }

    if (displayAttachments.length > 0) {
      const attachmentUi = buildAssistantUiMessage(message, normalizeMessageParts(message.content, message));
      if (attachmentUi) {
        ui.push(attachmentUi);
      }
      activeToolIndex = null;
      continue;
    }

    if (message.role === "tool") {
      const split = splitToolNarration(message.content || message.text);
      const toolUi = buildToolUiMessage({
        id: String(message.id || `tool_${toTimestamp(message) || Date.now()}`),
        sourceMessage: message,
        name: String(message.name || "tool"),
        status: "success",
        summary: typeof message.text === "string" ? message.text : undefined,
        args: message.arguments || message.args,
        detail: split.detail,
      });
      ui.push(toolUi);
      const followupUi = split.followupText ? buildAssistantTextUiMessage(message, split.followupText) : null;
      if (followupUi) {
        ui.push(followupUi);
        activeToolIndex = null;
      } else {
        activeToolIndex = ui.length - 1;
      }
      continue;
    }

    const parts = normalizeMessageParts(message.content, message);
    const diagnosticOnlyText = getDiagnosticAssistantText(parts);
    if (diagnosticOnlyText && activeToolIndex !== null && ui[activeToolIndex]?.role === "tool") {
      ui[activeToolIndex] = appendToolDetail(ui[activeToolIndex], diagnosticOnlyText);
      continue;
    }

    const assistantParts: ChatContentPart[] = [];

    const pushAssistantBuffer = () => {
      const assistantUi = buildAssistantUiMessage(message, assistantParts);
      if (assistantUi) {
        ui.push(assistantUi);
      }
      assistantParts.length = 0;
    };

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      if (isToolPart(part)) {
        pushAssistantBuffer();
        const toolUi = buildToolUiMessage({
          id: String(part.toolCallId || part.tool_call_id || makeToolUiId(message, index, "call")),
          sourceMessage: message,
          name: String(part.name || "tool"),
          status: "running",
          summary: typeof part.summary === "string" ? part.summary : undefined,
          args: part.arguments || part.args || part.input,
        });
        ui.push(toolUi);
        activeToolIndex = ui.length - 1;
        continue;
      }

      if (isToolResultPart(part)) {
        pushAssistantBuffer();
        const split = splitToolNarration(part.content || part.text || part.result);
        const resultId = String(part.toolCallId || part.tool_call_id || part.callId || part.call_id || makeToolUiId(message, index, "result"));
        const toolUi = buildToolUiMessage({
          id: resultId,
          sourceMessage: message,
          name: String(part.name || "tool"),
          status: "success",
          summary: typeof part.summary === "string" ? part.summary : undefined,
          detail: split.detail,
        });
        if (activeToolIndex !== null && ui[activeToolIndex]?.role === "tool" && ui[activeToolIndex]?.id === resultId) {
          const previousTool = ui[activeToolIndex];
          ui.splice(activeToolIndex, 1, {
            ...toolUi,
            toolArgs: toolUi.toolArgs ?? previousTool.toolArgs,
            toolSummary: toolUi.toolSummary ?? previousTool.toolSummary,
          });
        } else {
          ui.push(toolUi);
        }
        const followupUi = split.followupText ? buildAssistantTextUiMessage(message, split.followupText) : null;
        if (followupUi) {
          ui.push(followupUi);
          activeToolIndex = null;
        } else {
          activeToolIndex = ui.length - 1;
        }
        continue;
      }

      const type = String(part.type || "").toLowerCase();
      const text = typeof part.text === "string"
        ? part.text
        : typeof part.content === "string"
          ? part.content
          : "";

      if (["thinking", "thought", "reasoning"].includes(type)) {
        assistantParts.push(part);
        continue;
      }

      if ((type === "text" || !type) && text.trim()) {
        if (isDiagnosticText(text)) {
          if (activeToolIndex !== null && ui[activeToolIndex]?.role === "tool") {
            ui[activeToolIndex] = appendToolDetail(ui[activeToolIndex], text);
          } else {
            assistantParts.push({ type: "text", text });
            activeToolIndex = null;
          }
        } else {
          if (activeToolIndex !== null && ui[activeToolIndex]?.role === "tool") {
            ui[activeToolIndex] = settleToolMessage(ui[activeToolIndex]);
          }
          assistantParts.push({ type: "text", text });
          activeToolIndex = null;
        }
      }
    }

    if (assistantParts.length > 0 || displayAttachments.length > 0) {
      pushAssistantBuffer();
    }
  }
  return ui;
}

function normalizeTransientToolMessages(messages: ToolTransientMessage[]): UiChatMessage[] {
  return messages.map((message) => {
    const parts = normalizeMessageParts(message.content, message);
    const toolCall = parts.find(isToolPart);
    const toolResult = parts.find(isToolResultPart);
    if (toolCall) {
      return buildToolUiMessage({
        id: message.id,
        sourceMessage: message,
        name: String(toolCall.name || message.name || "tool"),
        status: "running",
        summary: typeof message.text === "string" ? message.text : typeof toolCall.summary === "string" ? toolCall.summary : undefined,
        args: toolCall.arguments || toolCall.args || toolCall.input,
        detail: typeof message.text === "string" && isDiagnosticText(message.text) ? message.text : undefined,
      });
    }
    if (toolResult) {
      return buildToolUiMessage({
        id: message.id,
        sourceMessage: message,
        name: String(toolResult.name || message.name || "tool"),
        status: "success",
        summary: typeof message.text === "string" ? message.text : typeof toolResult.summary === "string" ? toolResult.summary : undefined,
        detail: toolResult.content || toolResult.text || toolResult.result || message.text,
      });
    }
    return buildToolUiMessage({
      id: message.id,
      sourceMessage: message,
      name: String(message.name || "tool"),
      status: "running",
      summary: typeof message.text === "string" ? message.text : undefined,
      detail: message.content,
      args: message.arguments || message.args,
    });
  });
}

export function buildLiveRunListData(params: {
  historyMessages: ChatMessage[];
  toolMessages: ToolTransientMessage[];
  streamSegments: StreamSegment[];
  liveStreamText: string | null;
  liveStreamStartedAt: number | null;
  activeRunId: string | null;
  nowMs?: number;
}): UiChatMessage[] {
  const seen = new Set<string>();
  const dedupedHistory: ChatMessage[] = [];
  const nowMs = params.nowMs ?? Date.now();

  for (const message of params.historyMessages) {
    const key = String(message.id || `${message.role}-${toTimestamp(message) || "na"}`);
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedHistory.push(message);
  }

  const historyUi = buildHistoryUiMessages(dedupedHistory);
  const transient: UiChatMessage[] = [];

  const toolUiMessages = normalizeTransientToolMessages(params.toolMessages);
  for (const toolMessage of toolUiMessages) {
    if (!seen.has(toolMessage.id)) transient.push(toolMessage);
  }

  for (const segment of params.streamSegments) {
    if (!segment.text.trim() || isDiagnosticText(segment.text)) continue;
    if (seen.has(segment.id)) continue;
    transient.push({
      id: segment.id,
      role: "assistant",
      text: segment.text,
      content: segment.text,
      createdAt: segment.timestampMs,
      timestamp: segment.timestampMs,
      streaming: true,
    });
  }

  const trimmedStream = (params.liveStreamText || "").trim();
  const latestHistoryMessage = historyUi[historyUi.length - 1];
  const hasTerminalMessage = (
    (!!params.activeRunId && historyUi.some((message) => message.id === `final_${params.activeRunId}` || message.id === `abort_${params.activeRunId}`))
    || isTerminalAssistantMessage(latestHistoryMessage)
  );

  if (trimmedStream && !hasTerminalMessage && !isDiagnosticText(trimmedStream)) {
    transient.push({
      id: "streaming",
      role: "assistant",
      content: trimmedStream,
      text: trimmedStream,
      createdAt: params.liveStreamStartedAt ?? nowMs,
      timestamp: params.liveStreamStartedAt ?? nowMs,
      streaming: true,
    });
  }

  return dedupeAttachmentEchoes([...historyUi, ...transient]);
}
