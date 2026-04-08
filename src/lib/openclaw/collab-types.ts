import type { ChatMessage, SessionItem } from "./chat-types";

export type CollabRoomStatus = "draft" | "running" | "waiting" | "done" | "error";
export type CollabMessageSource = "root" | "worker" | "subagent" | "summary" | "manual";

export type CollabAgentOption = {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  subagents?: {
    allowAgents?: string[];
    model?: string;
    thinking?: string;
    maxConcurrent?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CollabConfigResponse = {
  config?: {
    agents?: {
      defaults?: {
        subagents?: {
          allowAgents?: string[];
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      list?: CollabAgentOption[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  parsed?: {
    agents?: {
      defaults?: {
        subagents?: {
          allowAgents?: string[];
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      list?: CollabAgentOption[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  agents?: {
    defaults?: {
      subagents?: {
        allowAgents?: string[];
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    list?: CollabAgentOption[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CollabSessionRef = {
  sessionKey: string;
  agentId: string;
  label?: string;
  source: CollabMessageSource;
  updatedAt?: number;
};

export type CollabRoom = {
  id: string;
  title: string;
  task: string;
  ownerAgentId: string;
  workerAgentIds: string[];
  rootSessionKey: string;
  childSessionKeys: string[];
  createdAt: number;
  updatedAt: number;
  status: CollabRoomStatus;
  archivedAt?: number | null;
  notes?: string;
  autoIncludeWorkerSessions: boolean;
  historyCache?: CollabHistoryMap;
};

export type CreateCollabRoomInput = {
  title?: string;
  task: string;
  ownerAgentId: string;
  workerAgentIds: string[];
  rootSessionKey: string;
  notes?: string;
  autoIncludeWorkerSessions?: boolean;
};

export type CollabTimelineMessage = {
  id: string;
  roomId: string;
  sessionKey: string;
  agentId: string;
  role: string;
  source: CollabMessageSource;
  createdAt: number;
  label?: string;
  message: ChatMessage;
};

export type CollabHistoryMap = Record<string, ChatMessage[]>;
export type CollabSessionMap = Record<string, SessionItem>;

export type CollabWorkerStatus =
  | "pending"
  | "queued"
  | "running"
  | "reported"
  | "blocked";

export type CollabWorkerState = {
  agentId: string;
  sessionKey?: string;
  status: CollabWorkerStatus;
  source?: CollabMessageSource;
  lastUpdatedAt?: number;
  summary?: string;
};

export type CollabDispatchTemplate = {
  id: string;
  label: string;
  description: string;
};

export type SessionsSpawnResponse = {
  status?: string;
  runId?: string;
  childSessionKey?: string;
  error?: string;
  warning?: string;
  [key: string]: unknown;
};

export type SessionsSendResponse = {
  status?: string;
  runId?: string;
  reply?: unknown;
  error?: string;
  [key: string]: unknown;
};
