"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateUUID } from "@/lib/openclaw/uuid";
import type { CollabRoom, CreateCollabRoomInput } from "@/lib/openclaw/collab-types";

const STORAGE_KEY = "openclaw.collab.rooms.v1";
const HISTORY_CACHE_PREFIX = "openclaw.collab.history.";

type StoredState = {
  activeRoomId: string | null;
  rooms: CollabRoom[];
};

function normalizeRoom(rawRoom: CollabRoom): CollabRoom {
  return {
    ...rawRoom,
    archivedAt: typeof rawRoom.archivedAt === "number" ? rawRoom.archivedAt : null,
    autoIncludeWorkerSessions: rawRoom.autoIncludeWorkerSessions ?? false,
    historyCache:
      rawRoom.historyCache && typeof rawRoom.historyCache === "object"
        ? rawRoom.historyCache
        : {},
  };
}

function readStoredState(): StoredState {
  if (typeof window === "undefined") {
    return { rooms: [], activeRoomId: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rooms: [], activeRoomId: null };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms.map((room) => normalizeRoom(room)) : [],
      activeRoomId: typeof parsed.activeRoomId === "string" || parsed.activeRoomId === null ? parsed.activeRoomId ?? null : null,
    };
  } catch {
    return { rooms: [], activeRoomId: null };
  }
}

export function useCollabRoom() {
  const [storedState, setStoredState] = useState<StoredState>({ rooms: [], activeRoomId: null });
  const { rooms, activeRoomId } = storedState;

  useEffect(() => {
    const timer = setTimeout(() => {
      setStoredState(readStoredState());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  }, [storedState]);

  const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId) ?? null, [activeRoomId, rooms]);

  const setActiveRoomId = useCallback((roomId: string | null) => {
    setStoredState((prev) => ({ ...prev, activeRoomId: roomId }));
  }, []);

  const createRoom = useCallback((input: CreateCollabRoomInput) => {
    const now = Date.now();
    const room: CollabRoom = {
      id: generateUUID(),
      title: input.title?.trim() || input.task.trim().slice(0, 24) || `协作任务 ${new Date(now).toLocaleTimeString("zh-CN", { hour12: false })}`,
      task: input.task.trim(),
      ownerAgentId: input.ownerAgentId,
      workerAgentIds: [...new Set(input.workerAgentIds.filter(Boolean))],
      rootSessionKey: input.rootSessionKey,
      childSessionKeys: [],
      createdAt: now,
      updatedAt: now,
      status: "draft",
      archivedAt: null,
      notes: input.notes?.trim() || "",
      autoIncludeWorkerSessions: input.autoIncludeWorkerSessions ?? false,
      historyCache: {},
    };
    setStoredState((prev) => ({ rooms: [room, ...prev.rooms], activeRoomId: room.id }));
    return room;
  }, []);

  const updateRoom = useCallback((roomId: string, updater: (room: CollabRoom) => CollabRoom) => {
    setStoredState((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => (room.id === roomId ? updater(room) : room)),
    }));
  }, []);

  const addChildSession = useCallback((roomId: string, sessionKey: string) => {
    if (!sessionKey) return;
    updateRoom(roomId, (room) => ({
      ...room,
      childSessionKeys: room.childSessionKeys.includes(sessionKey) ? room.childSessionKeys : [...room.childSessionKeys, sessionKey],
      updatedAt: Date.now(),
      status: "running",
    }));
  }, [updateRoom]);


  const archiveRoom = useCallback((roomId: string) => {
    updateRoom(roomId, (room) => ({
      ...room,
      archivedAt: Date.now(),
      status: room.status === "draft" ? "done" : room.status,
      updatedAt: Date.now(),
    }));
  }, [updateRoom]);

  const restoreRoom = useCallback((roomId: string) => {
    updateRoom(roomId, (room) => ({
      ...room,
      archivedAt: null,
      updatedAt: Date.now(),
    }));
    setStoredState((prev) => ({
      ...prev,
      activeRoomId: roomId,
    }));
  }, [updateRoom]);

  const deleteRoom = useCallback((roomId: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${HISTORY_CACHE_PREFIX}${roomId}`);
    }
    setStoredState((prev) => ({
      rooms: prev.rooms.filter((room) => room.id !== roomId),
      activeRoomId: prev.activeRoomId === roomId ? null : prev.activeRoomId,
    }));
  }, []);

  const setRoomHistoryCache = useCallback((roomId: string, historyCache: NonNullable<CollabRoom["historyCache"]>) => {
    setStoredState((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => (
        room.id === roomId
          ? {
              ...room,
              historyCache,
            }
          : room
      )),
    }));
  }, []);

  return {
    rooms,
    activeRoomId,
    activeRoom,
    setActiveRoomId,
    createRoom,
    updateRoom,
    addChildSession,
    archiveRoom,
    restoreRoom,
    deleteRoom,
    setRoomHistoryCache,
  };
}
