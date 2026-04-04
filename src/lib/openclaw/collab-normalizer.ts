import type { ChatMessage, SessionItem } from "./chat-types";
import type {
  CollabHistoryMap,
  CollabRoom,
  CollabSessionRef,
  CollabTimelineMessage,
} from "./collab-types";

function normalizeTs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function getAgentIdFromSessionKey(sessionKey: string) {
  if (!sessionKey.startsWith("agent:")) return "main";
  return sessionKey.split(":")[1] || "main";
}

export function getSessionUpdatedAt(session: SessionItem | undefined) {
  if (!session) return 0;
  const candidates = [session.updatedAtMs, session.updatedAt, session.createdAt, session.timestamp];
  for (const candidate of candidates) {
    const ts = normalizeTs(candidate);
    if (ts > 0) return ts;
  }
  return 0;
}

export function getMessageTimestamp(message: ChatMessage, index = 0) {
  const ts = normalizeTs(message.createdAt ?? message.timestamp ?? message.ts);
  return ts > 0 ? ts : index;
}

function inferSource(room: CollabRoom, sessionKey: string, agentId: string): CollabSessionRef["source"] {
  if (sessionKey === room.rootSessionKey) return "root";
  if (room.childSessionKeys.includes(sessionKey)) return "subagent";
  if (room.workerAgentIds.includes(agentId)) return "worker";
  return "manual";
}

export function buildCollabSessionRefs(room: CollabRoom, sessions: SessionItem[], historyKeys: string[] = []) {
  const byKey = new Map(sessions.map((session) => [session.key, session]));
  const refs = new Map<string, CollabSessionRef>();
  const minUpdatedAt = room.createdAt - 60_000;

  const pushRef = (sessionKey: string) => {
    if (!sessionKey) return;
    const session = byKey.get(sessionKey);
    const agentId = session ? getAgentIdFromSessionKey(session.key) : getAgentIdFromSessionKey(sessionKey);
    refs.set(sessionKey, {
      sessionKey,
      agentId,
      label: session?.label || session?.displayName,
      source: inferSource(room, sessionKey, agentId),
      updatedAt: getSessionUpdatedAt(session),
    });
  };

  pushRef(room.rootSessionKey);
  room.childSessionKeys.forEach(pushRef);
  historyKeys.forEach((sessionKey) => {
    const agentId = getAgentIdFromSessionKey(sessionKey);
    if (
      sessionKey === room.rootSessionKey ||
      room.childSessionKeys.includes(sessionKey) ||
      room.workerAgentIds.includes(agentId)
    ) {
      pushRef(sessionKey);
    }
  });

  sessions.forEach((session) => {
    const agentId = getAgentIdFromSessionKey(session.key);
    if (!room.workerAgentIds.includes(agentId)) return;
    if (!session.key.startsWith(`agent:${agentId}:subagent:`)) return;
    if (getSessionUpdatedAt(session) < minUpdatedAt) return;
    pushRef(session.key);
  });

  if (room.autoIncludeWorkerSessions) {
    sessions.forEach((session) => {
      const agentId = getAgentIdFromSessionKey(session.key);
      if (!room.workerAgentIds.includes(agentId)) return;
      if (getSessionUpdatedAt(session) < minUpdatedAt) return;
      pushRef(session.key);
    });
  }

  return Array.from(refs.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function buildCollabTimeline({ room, sessions, histories }: { room: CollabRoom; sessions: SessionItem[]; histories: CollabHistoryMap; }) {
  const refs = buildCollabSessionRefs(room, sessions, Object.keys(histories));
  const timeline: CollabTimelineMessage[] = [];

  refs.forEach((ref) => {
    const messages = histories[ref.sessionKey] || [];
    messages.forEach((message, index) => {
      timeline.push({
        id: `${ref.sessionKey}:${message.id || index}`,
        roomId: room.id,
        sessionKey: ref.sessionKey,
        agentId: ref.agentId,
        role: message.role || "assistant",
        source: ref.source,
        createdAt: getMessageTimestamp(message, index),
        label: ref.label,
        message,
      });
    });
  });

  timeline.sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt - b.createdAt));

  return { sessionRefs: refs, timeline };
}
