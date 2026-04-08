"use client";

import type { ComponentType } from "react";
import {
  BarChart2,
  Bot,
  Brain,
  Check,
  ChevronDown,
  MessagesSquare,
  Monitor,
  Plus,
  SquareTerminal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelItem, SessionItem } from "@/lib/openclaw/chat-types";

type ToolbarSlashCommand = {
  name: string;
  label: string;
  description: string;
  args?: string;
  category: "session" | "model" | "tools" | "agents";
  icon: ComponentType<{ className?: string }>;
};

type ToolbarSessionSummary = {
  displayName?: string;
  label?: string;
  usage?: {
    input?: number;
    output?: number;
  };
};

function getProviderColor(provider: string) {
  const hash = provider.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function getAgentColor(agentId: string) {
  if (agentId === "main") return "hsl(199, 89%, 48%)";
  const hash = agentId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function formatContext(num: number): string {
  if (!num) return "0";
  if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toString();
}

export function ChatToolbar({
  models,
  selectedModel,
  onSelectModel,
  activeSession,
  activeSessionData,
  sessions,
  onNewSession,
  onSwitchSession,
  commands,
  onCommandClick,
  onUsageDropdownOpenChange,
  usageLoading,
  showDetails,
  onToggleDetails,
}: {
  models: ModelItem[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  activeSession: string;
  activeSessionData: ToolbarSessionSummary;
  sessions: SessionItem[];
  onNewSession: () => void;
  onSwitchSession: (sessionKey: string) => void;
  commands: ToolbarSlashCommand[];
  onCommandClick: (cmd: ToolbarSlashCommand) => void;
  onUsageDropdownOpenChange: (open: boolean) => void;
  usageLoading: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
}) {
  const groupedModels = models.reduce<Record<string, ModelItem[]>>((acc, model) => {
    const provider = model.provider || model.config_key || model.owned_by || "unknown";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {});

  const groupedSessions = sessions.reduce<Record<string, SessionItem[]>>((acc, session) => {
    const agentPrefix = session.key?.startsWith("agent:") ? session.key.split(":")[1] : "main";
    if (!acc[agentPrefix]) acc[agentPrefix] = [];
    acc[agentPrefix].push(session);
    return acc;
  }, {});

  return (
    <div className="w-full space-y-2 mb-2 sm:mb-4">
      <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex w-max items-center gap-1 px-1 pb-1">
        <div className="relative shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[9px] font-medium px-2 hover:scale-105 transition-all shrink-0 focus-visible:ring-0 gap-1"
              >
                <Brain className="size-3 text-muted-foreground" />
                <span className="max-w-[80px] truncate">{selectedModel || "Model"}</span>
                <ChevronDown className="size-2.5 opacity-40 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-64 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
              <div className="p-2.5 border-b border-border/40 text-[9px] font-medium uppercase opacity-40 tracking-widest pl-3 flex items-center gap-2 mb-1">
                <Monitor className="size-3" /> 模型列表
              </div>
              <div className="max-h-60 overflow-y-auto p-1 py-1.5 custom-scrollbar">
                {Object.entries(groupedModels).map(([provider, providerModels]) => {
                  const color = getProviderColor(provider);
                  return (
                    <div key={provider}>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 mt-1 first:mt-0">
                        <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[9px] font-medium uppercase tracking-widest opacity-40">{provider}</span>
                      </div>
                      {providerModels.map((model, index) => (
                        <DropdownMenuItem
                          key={`${model.id}-${index}`}
                          onClick={() => onSelectModel(model.id)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl transition-all group flex items-start gap-3 cursor-pointer outline-none focus:bg-muted",
                            selectedModel === model.id ? "border" : "border-transparent",
                          )}
                          style={selectedModel === model.id ? { backgroundColor: `${color}15`, borderColor: `${color}30` } : {}}
                        >
                          <div className="size-2 rounded-full mt-1.5" style={{ backgroundColor: color, opacity: 0.6 }} />
                          <div className="flex flex-col min-w-0">
                            <p className="text-[11px] truncate" style={selectedModel === model.id ? { color } : {}}>
                              {model.name || model.id}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 text-[9px] font-medium px-2 hover:scale-105 transition-all shrink-0 focus-visible:ring-0 gap-1"
              >
                <MessagesSquare className="size-3 text-muted-foreground" />
                <span className="max-w-[60px] truncate">{activeSessionData.displayName || activeSessionData.label || activeSession.split(":").pop()}</span>
                <ChevronDown className="size-2.5 opacity-40 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
              <div className="p-3 border-b border-border/40 flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-50 pl-1">会话列表</span>
                <Button variant="ghost" size="icon" className="size-6 rounded-lg text-primary hover:bg-primary/5" onClick={onNewSession}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 p-1 custom-scrollbar">
                {Object.entries(groupedSessions).map(([agentId, agentSessions]) => {
                  const color = getAgentColor(agentId);
                  return (
                    <div key={agentId}>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 mt-1 first:mt-0">
                        <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[9px] font-medium uppercase tracking-widest opacity-40">{agentId}</span>
                      </div>
                      {agentSessions.map((session) => (
                        <DropdownMenuItem
                          key={session.key}
                          onClick={() => onSwitchSession(session.key)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer outline-none focus:bg-muted",
                            activeSession === session.key ? "border" : "border-transparent",
                          )}
                          style={activeSession === session.key ? { backgroundColor: `${color}15`, borderColor: `${color}30` } : {}}
                        >
                          <Bot className="size-3.5 shrink-0" style={{ color, opacity: 0.6 }} />
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-[11px] truncate" style={activeSession === session.key ? { color } : {}}>
                              {session.displayName || session.label || session.key.split(":").pop()}
                            </p>
                            <p className="text-[9px] opacity-30 font-mono truncate">{session.key}</p>
                          </div>
                          {activeSession === session.key && <Check className="size-3" style={{ color }} />}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />

        <div className="relative shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-0 hover:scale-105 transition-all shrink-0 focus-visible:ring-0"
              >
                <SquareTerminal className="size-3.5 text-orange-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-2 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 max-h-[60vh] overflow-y-auto">
              <div className="p-2.5 border-b border-border/40 text-[9px] font-medium uppercase opacity-40 tracking-widest pl-3 flex items-center gap-2 mb-1">
                <SquareTerminal className="size-3 text-orange-500" /> 命令控制台
              </div>
              <div className="space-y-0.5">
                {commands.map((cmd) => (
                  <DropdownMenuItem
                    key={cmd.name}
                    onClick={() => onCommandClick(cmd)}
                    className="w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer outline-none focus:bg-muted hover:bg-muted"
                  >
                    <div className="size-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <cmd.icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px]">/{cmd.name}</p>
                        {cmd.args && <span className="text-[8px] text-orange-500 font-mono">{cmd.args}</span>}
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative shrink-0">
          <DropdownMenu onOpenChange={onUsageDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-7 rounded-full bg-background/80 backdrop-blur-sm border-border/50 px-0 hover:scale-105 transition-all shrink-0 focus-visible:ring-0"
              >
                <BarChart2 className="size-3.5 text-green-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-72 p-3 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
              {usageLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6">
                  <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-[10px] font-medium uppercase tracking-widest opacity-40">加载中...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="size-4 text-green-500" />
                    <span className="text-[10px] font-medium uppercase tracking-widest">用量统计</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <span className="text-[10px] flex items-center gap-2 opacity-60">
                        <div className="size-2 rounded-full bg-blue-500" /> 输入 Token
                      </span>
                      <span className="font-mono text-xs font-medium">{formatContext(activeSessionData.usage?.input || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <span className="text-[10px] flex items-center gap-2 opacity-60">
                        <div className="size-2 rounded-full bg-green-500" /> 输出 Token
                      </span>
                      <span className="font-mono text-xs font-medium">{formatContext(activeSessionData.usage?.output || 0)}</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <span className="text-[9px] font-medium uppercase tracking-widest text-primary/60">累计总计</span>
                    <span className="font-mono text-lg font-bold text-primary">
                      {formatContext((activeSessionData.usage?.input || 0) + (activeSessionData.usage?.output || 0))}
                    </span>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleDetails}
          className={cn(
            "size-7 rounded-full border-border/50 px-0 shadow-sm backdrop-blur-sm hover:scale-105 transition-all shrink-0",
            showDetails ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-background/80 text-muted-foreground/40 grayscale",
          )}
        >
          <Zap className="size-3.5" />
        </Button>
      </div>
      </div>
    </div>
  );
}
