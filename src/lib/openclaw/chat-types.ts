import type { ChatAttachment } from "./chat-attachments";

export type ChatContentPart = {
  type?: string;
  text?: string;
  content?: unknown;
  name?: string;
  arguments?: unknown;
  args?: unknown;
  toolCallId?: string;
  tool_call_id?: string;
  thinking?: string;
  thought?: string;
  result?: unknown;
  [key: string]: unknown;
};

export type ChatMessage = {
  id?: string;
  role?: string;
  content?: string | ChatContentPart[] | ChatContentPart | null;
  text?: string;
  attachments?: ChatAttachment[];
  files?: ChatAttachment[];
  createdAt?: string | number;
  timestamp?: string | number;
  ts?: string | number;
  sender?: string;
  from?: string;
  agentId?: string;
  name?: string;
  arguments?: unknown;
  args?: unknown;
  thinking?: string;
  thought?: string;
  toolCallId?: string;
  tool_call_id?: string;
  runId?: string;
  partIndex?: number;
  [key: string]: unknown;
};

export type UiChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content?: string | ChatContentPart[] | null;
  text?: string;
  attachments?: ChatAttachment[];
  files?: ChatAttachment[];
  createdAt?: string | number;
  timestamp?: string | number;
  ts?: string | number;
  sender?: string;
  from?: string;
  agentId?: string;
  streaming?: boolean;
  toolName?: string;
  toolStatus?: "running" | "success" | "error";
  toolSummary?: string;
  toolArgs?: unknown;
  toolDetail?: unknown;
  toolDurationMs?: number;
  sourceMessage?: ChatMessage;
};

export type ChatActivity = {
  kind: "thinking" | "writing" | "tool";
  label: string;
  detail?: string;
  toolName?: string;
  toolSummary?: string;
};

export type SessionUsage = {
  input?: number;
  output?: number;
  [key: string]: unknown;
};

export type SessionItem = {
  key: string;
  label?: string;
  displayName?: string;
  usage?: SessionUsage;
  totalTokens?: number;
  contextTokens?: number;
  [key: string]: unknown;
};

export type ModelItem = {
  id: string;
  name?: string;
  provider?: string;
  config_key?: string;
  owned_by?: string;
  contextWindow?: number;
  [key: string]: unknown;
};

export type ConfigData = {
  agents?: {
    defaults?: {
      model?: string | { primary?: string };
      contextTokens?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type AgentItem = { id: string; name?: string; [key: string]: unknown };

export type ChatEventPayload = {
  state?: string;
  message?: ChatMessage;
  sessionKey?: string;
  errorMessage?: string;
  usage?: SessionUsage;
};

export type SessionListResponse = { sessions?: SessionItem[] };
export type ModelsListResponse = { models?: ModelItem[] };
export type ConfigGetResponse = { config?: ConfigData } & ConfigData;
export type SessionsUsageResponse = { sessions?: Array<{ key: string; usage?: SessionUsage }> };
export type ChatHistoryResponse = { messages?: ChatMessage[] };
export type ChatSendResponse = { runId?: string };
