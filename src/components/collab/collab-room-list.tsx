"use client";

import { ArchiveRestore, Bot, CheckCircle2, Clock3, FolderArchive, LoaderCircle, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CollabRoom } from "@/lib/openclaw/collab-types";

const STATUS_LABELS: Record<CollabRoom["status"], string> = { draft: "草稿", running: "运行中", waiting: "等待中", done: "已完成", error: "异常" };


function getRoomStatusStyles(status: CollabRoom["status"]) {
  if (status === "done") return {
    badge: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600",
    iconWrap: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    Icon: CheckCircle2,
  };
  if (status === "running") return {
    badge: "border-blue-500/20 bg-blue-500/5 text-blue-600",
    iconWrap: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    Icon: LoaderCircle,
  };
  if (status === "waiting") return {
    badge: "border-amber-500/20 bg-amber-500/5 text-amber-600",
    iconWrap: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    Icon: Clock3,
  };
  if (status === "error") return {
    badge: "border-red-500/20 bg-red-500/5 text-red-600",
    iconWrap: "border-red-500/20 bg-red-500/10 text-red-600",
    Icon: Clock3,
  };
  return {
    badge: "border-border/50 bg-background/80 text-muted-foreground",
    iconWrap: "border-border/50 bg-muted/30 text-muted-foreground",
    Icon: Bot,
  };
}

export function CollabRoomList({ rooms, activeRoomId, onSelect, onDelete, onArchive, onRestore }: { rooms: CollabRoom[]; activeRoomId: string | null; onSelect: (roomId: string) => void; onDelete: (roomId: string) => void; onArchive: (roomId: string) => void; onRestore: (roomId: string) => void; }) {
  const activeRooms = rooms.filter((room) => !room.archivedAt);
  const archivedRooms = rooms.filter((room) => Boolean(room.archivedAt));

  const renderRoom = (room: CollabRoom, archived = false) => {
    const active = room.id === activeRoomId;
    const statusStyles = getRoomStatusStyles(room.status);
    const StatusIcon = statusStyles.Icon;
    return (
      <div
        key={room.id}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(room.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(room.id);
          }
        }}
        className={cn(
          "group w-full text-left rounded-[22px] sm:rounded-[26px] border p-3.5 sm:p-4 transition-all cursor-pointer shadow-sm",
          active ? "border-primary/35 bg-primary/[0.06] shadow-md shadow-primary/5" : "border-border/50 bg-background/75 hover:bg-muted/20 hover:border-primary/20",
          archived && "opacity-80",
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("size-10 sm:size-11 shrink-0 rounded-[16px] sm:rounded-[18px] border flex items-center justify-center transition-colors shadow-sm", active ? "border-primary/30 bg-primary/10 text-primary" : statusStyles.iconWrap)}>
            <StatusIcon className={cn("size-4", room.status === "running" && "animate-spin")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{room.title}</h3>
                <div className="mt-1 hidden sm:inline-flex max-w-full rounded-full border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
                  {room.ownerAgentId} · {room.rootSessionKey}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground sm:hidden">{room.ownerAgentId}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {archived ? (
                  <Button variant="ghost" size="icon" className="size-8 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={(event) => { event.stopPropagation(); onRestore(room.id); }}>
                    <ArchiveRestore className="size-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="size-8 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={(event) => { event.stopPropagation(); onArchive(room.id); }}>
                    <FolderArchive className="size-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="size-8 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={(event) => { event.stopPropagation(); onDelete(room.id); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-2.5 rounded-[18px] sm:rounded-[20px] border border-border/40 bg-background/80 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground shadow-sm line-clamp-2 sm:line-clamp-3">
              {room.task}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2 py-1 shadow-sm"><Users className="size-3" /> {room.workerAgentIds.length}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm", statusStyles.badge)}><Clock3 className="size-3" /> {STATUS_LABELS[room.status]}</span>
              {archived && <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2 py-1 shadow-sm"><FolderArchive className="size-3" /> 已归档</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-[26px] overflow-hidden border-border/50 bg-background/85 backdrop-blur-xl shadow-sm">
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-muted/25 to-background flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black tracking-tight">协作房间</h2>
          <p className="text-xs text-muted-foreground mt-1">本地保存的任务编排视图</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border/50 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">{rooms.length} 个</span>
      </div>
      <div className="p-3 space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar">
        {rooms.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/50 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">还没有协作房间，先在上方创建一个。</div>
        ) : (
          <>
            <div className="space-y-2.5">
              <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">进行中 / 可查看</div>
              {activeRooms.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">当前没有未归档房间。</div>
              ) : activeRooms.map((room) => renderRoom(room))}
            </div>
            <div className="space-y-2.5">
              <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">历史归档</div>
              {archivedRooms.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">还没有归档任务。</div>
              ) : archivedRooms.map((room) => renderRoom(room, true))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
