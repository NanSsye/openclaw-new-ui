"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/openclaw/gateway-client";
import type { ChatHistoryResponse, ChatSendResponse, SessionItem, SessionListResponse } from "@/lib/openclaw/chat-types";
import { buildCollabTimeline, buildCollabSessionRefs, getAgentIdFromSessionKey } from "@/lib/openclaw/collab-normalizer";
import type {
  CollabDispatchTemplate,
  CollabHistoryMap,
  CollabRoom,
  CollabWorkerState,
} from "@/lib/openclaw/collab-types";
import { generateUUID } from "@/lib/openclaw/uuid";

const HISTORY_CACHE_PREFIX = "openclaw.collab.history.";
const DISPATCH_TEMPLATES: CollabDispatchTemplate[] = [
  { id: "inspect", label: "巡检分工", description: "按日志 / 配置 / 节点拆分给 worker。" },
  { id: "research", label: "调研分工", description: "按背景 / 现状 / 风险拆分给 worker。" },
  { id: "deliver", label: "交付分工", description: "按实现 / 验证 / 汇报拆分给 worker。" },
];

function buildSpawnTask(room: CollabRoom, workerAgentId: string) {
  return [
    `你当前是协作工作台中的执行智能体：${workerAgentId}。`,
    `主控智能体：${room.ownerAgentId}。`,
    `协作任务标题：${room.title}。`,
    "请只处理分配给你的子任务，并用简洁、结构化的方式汇报结果。",
    "建议输出格式：",
    "Status: 成功 / 失败 / 阻塞",
    "Result: 你的核心结论",
    "Notes: 风险、待确认项、下一步",
    "原始总任务：",
    room.task,
  ].join("\n");
}

function buildTemplateTask(room: CollabRoom, workerAgentId: string, templateId: string, index: number) {
  const assignments: Record<string, string[]> = {
    inspect: [
      "重点检查运行日志、报错栈与最近事件，输出关键异常和时间线。",
      "重点检查配置项、模型/工具设置、权限与环境差异，输出配置风险。",
      "重点检查节点/实例/资源健康度与依赖状态，输出系统侧风险。",
      "补充检查剩余未覆盖的边角问题，并给出需要人工确认的点。",
    ],
    research: [
      "先收集背景信息与任务边界，梳理问题定义和已知条件。",
      "重点调研当前现状、关键数据点和可复现路径。",
      "重点识别风险、不确定项和相互冲突的证据。",
      "补充调研遗漏问题，并提出验证建议。",
    ],
    deliver: [
      "负责编排实现方案与核心改动建议，给出最小可落地路径。",
      "负责验证、测试思路和回归清单，指出潜在失败点。",
      "负责整理面向用户/管理者的汇报摘要和交付说明。",
      "补充剩余交付事项、上线注意点和后续优化建议。",
    ],
  };

  const templateTasks = assignments[templateId] || assignments.inspect;
  const assignment = templateTasks[index] || templateTasks[templateTasks.length - 1];

  return [
    `你当前是协作工作台中的执行智能体：${workerAgentId}。`,
    `主控智能体：${room.ownerAgentId}。`,
    `协作任务标题：${room.title}。`,
    `你的分工重点：${assignment}`,
    "请围绕你的分工输出结构化结论，不要重复其他 worker 的内容。",
    "建议输出格式：",
    "Status: 成功 / 失败 / 阻塞",
    "Result: 你的核心结论",
    "Notes: 风险、待确认项、下一步",
    "原始总任务：",
    room.task,
  ].join("\n");
}

function buildSummaryPrompt(room: CollabRoom) {
  const workerList = room.workerAgentIds.length > 0 ? room.workerAgentIds.join("、") : "无";
  return [
    `请作为主控智能体 ${room.ownerAgentId} 汇总协作任务。`,
    `任务标题：${room.title}`,
    `参与 worker：${workerList}`,
    "请结合当前会话中已收到的子任务反馈，整理成一份给用户的阶段汇报。",
    "要求：1) 先列结论；2) 再列每个 worker 的状态；3) 最后给出下一步建议。",
  ].join("\n");
}

function buildOwnerDispatchPrompt(room: CollabRoom, tasks: Array<{ workerAgentId: string; task: string }>) {
  const lines = tasks.map((item, index) => (
    `${index + 1}. worker=${item.workerAgentId}\n任务=${item.task}`
  ));

  return [
    `你是协作任务的主控智能体：${room.ownerAgentId}。`,
    `任务标题：${room.title}`,
    "请使用 sessions_spawn 为下面每个 worker 派发独立子任务，并等待它们回报，再继续统筹。",
    "要求：",
    "1. 每个 worker 单独 spawn 一个子会话。",
    "2. 保持子任务聚焦，不要把全部任务原样广播给所有 worker。",
    "3. 当 worker 回报后，请在当前主控会话中继续总结进展。",
    "4. 如果某个 worker 无法派发，请明确说明原因。",
    "待派发列表：",
    ...lines,
    "原始总任务：",
    room.task,
  ].join("\n");
}

export function useCollabSessions({
  client,
  connected,
  room,
  onUpdateRoom,
  toast,
}: {
  client: GatewayClient | null;
  connected: boolean;
  room: CollabRoom | null;
  onUpdateRoom: (roomId: string, updater: (room: CollabRoom) => CollabRoom) => void;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const roomId = room?.id;
  const roomWorkerAgentIdsKey = room?.workerAgentIds.join("|") ?? "";
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [histories, setHistories] = useState<CollabHistoryMap>({});
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);

  const historiesRef = useRef<CollabHistoryMap>({});
  const roomRef = useRef<CollabRoom | null>(room);

  useEffect(() => {
    historiesRef.current = histories;
  }, [histories]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!roomId) {
      setHistories({});
      setHistoryReady(true);
      return;
    }
    if (typeof window === "undefined") return;

    setHistoryReady(false);
    try {
      const raw = localStorage.getItem(`${HISTORY_CACHE_PREFIX}${roomId}`);
      const parsed = raw ? JSON.parse(raw) as CollabHistoryMap : {};
      const nextHistories = parsed && typeof parsed === "object" ? parsed : {};
      setHistories(nextHistories);

      const currentRoom = roomRef.current;
      if (currentRoom) {
        const discoveredChildSessionKeys = Object.keys(nextHistories).filter((sessionKey) => {
          const agentId = getAgentIdFromSessionKey(sessionKey);
          return currentRoom.workerAgentIds.includes(agentId) && sessionKey.includes(":subagent:");
        });
        if (discoveredChildSessionKeys.length > 0) {
          onUpdateRoom(currentRoom.id, (current) => {
            const mergedKeys = Array.from(new Set([...current.childSessionKeys, ...discoveredChildSessionKeys]));
            if (mergedKeys.length === current.childSessionKeys.length) return current;
            return {
              ...current,
              childSessionKeys: mergedKeys,
              updatedAt: current.updatedAt,
            };
          });
        }
      }
    } catch {
      setHistories({});
    } finally {
      setHistoryReady(true);
    }
  }, [onUpdateRoom, roomId, roomWorkerAgentIdsKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !roomId || !historyReady) return;
    localStorage.setItem(`${HISTORY_CACHE_PREFIX}${roomId}`, JSON.stringify(histories));
  }, [histories, historyReady, roomId]);

  const refreshSessions = useCallback(async () => {
    if (!client || !connected) return [] as SessionItem[];
    setLoadingSessions(true);
    try {
      const res = await client.request<SessionListResponse>("sessions.list", { limit: 200, includeGlobal: true, includeUnknown: true });
      const list = res.sessions || [];
      setSessions(list);
      return list;
    } catch (error) {
      console.error("Failed to refresh collab sessions", error);
      toast({ title: "读取会话失败", description: error instanceof Error ? error.message : "无法刷新会话列表", variant: "destructive" });
      return [] as SessionItem[];
    } finally {
      setLoadingSessions(false);
    }
  }, [client, connected, toast]);

  const refreshRoom = useCallback(async () => {
    if (!room || !client || !connected) return;
    setLoadingTimeline(true);
    try {
      const sessionList = await refreshSessions();
      const refs = buildCollabSessionRefs(room, sessionList, Object.keys(historiesRef.current));
      const discoveredChildSessionKeys = refs
        .filter((ref) => ref.sessionKey.startsWith(`agent:${ref.agentId}:subagent:`) || ref.source === "subagent")
        .map((ref) => ref.sessionKey)
        .filter((sessionKey) => !room.childSessionKeys.includes(sessionKey));
      if (discoveredChildSessionKeys.length > 0) {
        onUpdateRoom(room.id, (current) => {
          const mergedKeys = Array.from(new Set([...current.childSessionKeys, ...discoveredChildSessionKeys]));
          if (mergedKeys.length === current.childSessionKeys.length) return current;
          return {
            ...current,
            childSessionKeys: mergedKeys,
            updatedAt: current.updatedAt,
          };
        });
      }

      const nextHistories: CollabHistoryMap = {};
      await Promise.all(refs.map(async (ref) => {
        try {
          const res = await client.request<ChatHistoryResponse>("chat.history", { sessionKey: ref.sessionKey, limit: 100 });
          nextHistories[ref.sessionKey] = res.messages || [];
        } catch (error) {
          console.warn("Failed to load history", ref.sessionKey, error);
        }
      }));
      setHistories((prev) => {
        const merged: CollabHistoryMap = { ...prev };
        for (const [sessionKey, messages] of Object.entries(nextHistories)) {
          if (messages.length > 0 || !merged[sessionKey] || merged[sessionKey].length === 0) {
            merged[sessionKey] = messages;
          }
        }
        return merged;
      });
    } finally {
      setLoadingTimeline(false);
    }
  }, [client, connected, onUpdateRoom, refreshSessions, room]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!room || !connected || !historyReady) return;
    refreshRoom();
    const timer = setInterval(refreshRoom, 10_000);
    return () => clearInterval(timer);
  }, [connected, historyReady, refreshRoom, room]);

  const dispatchToWorkers = useCallback(async () => {
    if (!room || !client || !connected || room.workerAgentIds.length === 0) return;
    setDispatching(true);
    try {
      await client.request<ChatSendResponse>("chat.send", {
        sessionKey: room.rootSessionKey,
        message: buildOwnerDispatchPrompt(
          room,
          room.workerAgentIds.map((workerAgentId) => ({
            workerAgentId,
            task: buildSpawnTask(room, workerAgentId),
          })),
        ),
        idempotencyKey: generateUUID(),
      }, 60_000);

      onUpdateRoom(room.id, (current) => ({ ...current, status: "running", updatedAt: Date.now() }));
      toast({ title: "派发请求已发送", description: `已要求主控 ${room.ownerAgentId} 为 ${room.workerAgentIds.length} 个 worker 派发子任务。` });
      await refreshRoom();
    } catch (error) {
      toast({ title: "派发失败", description: error instanceof Error ? error.message : "无法向主控会话发送派发指令", variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  }, [client, connected, onUpdateRoom, refreshRoom, room, toast]);

  const dispatchTemplate = useCallback(async (templateId: string) => {
    if (!room || !client || !connected || room.workerAgentIds.length === 0) return;
    setDispatching(true);
    try {
      await client.request<ChatSendResponse>("chat.send", {
        sessionKey: room.rootSessionKey,
        message: buildOwnerDispatchPrompt(
          room,
          room.workerAgentIds.map((workerAgentId, index) => ({
            workerAgentId,
            task: buildTemplateTask(room, workerAgentId, templateId, index),
          })),
        ),
        idempotencyKey: generateUUID(),
      }, 60_000);

      onUpdateRoom(room.id, (current) => ({ ...current, status: "running", updatedAt: Date.now() }));
      const template = DISPATCH_TEMPLATES.find((item) => item.id === templateId);
      toast({
        title: "模板派发请求已发送",
        description: template ? `${template.label} 已交给主控智能体继续编排。` : "已将模板分工发给主控智能体。",
      });
      await refreshRoom();
    } catch (error) {
      toast({ title: "模板派发失败", description: error instanceof Error ? error.message : "无法向主控会话发送模板分工", variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  }, [client, connected, onUpdateRoom, refreshRoom, room, toast]);

  const sendToOwner = useCallback(async (message: string) => {
    if (!room || !client || !connected || !message.trim()) return false;
    try {
      await client.request<ChatSendResponse>("chat.send", {
        sessionKey: room.rootSessionKey,
        message: message.trim(),
        idempotencyKey: generateUUID(),
      }, 60_000);
      onUpdateRoom(room.id, (current) => ({ ...current, status: "running", updatedAt: Date.now() }));
      await refreshRoom();
      return true;
    } catch (error) {
      toast({ title: "发送失败", description: error instanceof Error ? error.message : "无法向主控会话发送消息", variant: "destructive" });
      return false;
    }
  }, [client, connected, onUpdateRoom, refreshRoom, room, toast]);

  const clearHistoryCache = useCallback(() => {
    if (!roomId) return;
    setHistories({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${HISTORY_CACHE_PREFIX}${roomId}`);
    }
    if (room) {
      onUpdateRoom(room.id, (current) => ({
        ...current,
        childSessionKeys: [],
        updatedAt: Date.now(),
        status: "draft",
      }));
    }
    toast({ title: "历史记录已清空", description: "当前协作房间的本地执行快照已删除。" });
  }, [onUpdateRoom, room, roomId, toast]);

  const requestSummary = useCallback(async () => {
    if (!room) return;
    setSummarizing(true);
    try {
      const ok = await sendToOwner(buildSummaryPrompt(room));
      if (ok) {
        onUpdateRoom(room.id, (current) => ({ ...current, status: "waiting", updatedAt: Date.now() }));
        toast({ title: "已请求汇总", description: `已要求 ${room.ownerAgentId} 整理当前协作结果。` });
      }
    } finally {
      setSummarizing(false);
    }
  }, [onUpdateRoom, room, sendToOwner, toast]);

  const { sessionRefs, timeline } = useMemo(() => {
    if (!room) return { sessionRefs: [], timeline: [] };
    return buildCollabTimeline({ room, sessions, histories });
  }, [histories, room, sessions]);

  const groupedSessionRefs = useMemo(() => sessionRefs.reduce<Record<string, typeof sessionRefs>>((acc, ref) => {
    const key = ref.agentId || getAgentIdFromSessionKey(ref.sessionKey);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ref);
    return acc;
  }, {}), [sessionRefs]);

  const workerStates = useMemo<CollabWorkerState[]>(() => {
    if (!room) return [];
    return room.workerAgentIds.map((agentId) => {
      const refs = groupedSessionRefs[agentId] || [];
      const ref = refs[0];
      if (!ref) {
        return { agentId, status: "pending" };
      }

      const history = histories[ref.sessionKey] || [];
      const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
      const lastUser = [...history].reverse().find((message) => message.role === "user");
      const summary = typeof lastAssistant?.content === "string"
        ? lastAssistant.content.slice(0, 120)
        : typeof lastUser?.content === "string"
          ? lastUser.content.slice(0, 120)
          : undefined;

      let status: CollabWorkerState["status"] = "queued";
      if (lastAssistant) status = "reported";
      else if (history.length > 0) status = "running";
      if (summary && /阻塞|失败|error|blocked/i.test(summary)) status = "blocked";

      return {
        agentId,
        sessionKey: ref.sessionKey,
        source: ref.source,
        status,
        lastUpdatedAt: ref.updatedAt,
        summary,
      };
    });
  }, [groupedSessionRefs, histories, room]);

  return {
    sessions,
    histories,
    sessionRefs,
    groupedSessionRefs,
    timeline,
    workerStates,
    dispatchTemplates: DISPATCH_TEMPLATES,
    loadingSessions,
    loadingTimeline,
    dispatching,
    summarizing,
    historyReady,
    refreshSessions,
    refreshRoom,
    dispatchToWorkers,
    dispatchTemplate,
    sendToOwner,
    requestSummary,
    clearHistoryCache,
  };
}
