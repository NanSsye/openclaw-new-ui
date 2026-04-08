"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MobileBottomSheetContent } from "@/components/ui/mobile-bottom-sheet-content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, ChevronRight, GitBranchPlus, Play, Plus, RefreshCw, Save, Sparkles, Trash2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentConsoleItem,
  type GatewayConfigResponse,
  type ModelsListResponse,
  type ToolsCatalogResponse,
  cloneConfig,
  getAgentsList,
  getCatalogProfiles,
  getCatalogToolIds,
  getConfigRoot,
  getFallbackModels,
  getPrimaryModel,
  isRecord,
  normalizeStringArray,
  setAgentsList,
  setModelValue,
  toJson,
} from "@/lib/openclaw/console-config";

type AgentFormState = {
  id: string;
  name: string;
  workspace: string;
  agentDir: string;
  emoji: string;
  vibe: string;
  defaultModel: string;
  fallbackModels: string;
  toolProfile: string;
  alsoAllow: string;
  skills: string;
  allowAgents: string;
  subagentModel: string;
  subagentThinking: string;
  maxConcurrent: string;
};

const EMPTY_FORM: AgentFormState = {
  id: "",
  name: "",
  workspace: "",
  agentDir: "",
  emoji: "",
  vibe: "",
  defaultModel: "",
  fallbackModels: "",
  toolProfile: "",
  alsoAllow: "",
  skills: "",
  allowAgents: "",
  subagentModel: "",
  subagentThinking: "",
  maxConcurrent: "",
};

type AgentMemoryFile = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
};

function createDraftAgent(existing: AgentConsoleItem[]): AgentConsoleItem {
  const ids = new Set(existing.map((item) => item.id));
  let index = existing.length + 1;
  let nextId = `agent-${index}`;
  while (ids.has(nextId)) {
    index += 1;
    nextId = `agent-${index}`;
  }
  return { id: nextId, name: `代理 ${index}` };
}

function toAgentForm(agent: AgentConsoleItem | null | undefined): AgentFormState {
  if (!agent) return EMPTY_FORM;
  return {
    id: agent.id || "",
    name: agent.name || "",
    workspace: agent.workspace || "",
    agentDir: agent.agentDir || "",
    emoji: agent.identity?.emoji || "",
    vibe: agent.identity?.vibe || "",
    defaultModel: getPrimaryModel(agent.model),
    fallbackModels: getFallbackModels(agent.model).join("\n"),
    toolProfile: agent.tools?.profile || "",
    alsoAllow: normalizeStringArray(agent.tools?.alsoAllow).join("\n"),
    skills: normalizeStringArray(agent.skills).join("\n"),
    allowAgents: normalizeStringArray(agent.subagents?.allowAgents).join("\n"),
    subagentModel: agent.subagents?.model || "",
    subagentThinking: agent.subagents?.thinking || "",
    maxConcurrent: typeof agent.subagents?.maxConcurrent === "number" ? String(agent.subagents.maxConcurrent) : "",
  };
}

function applyAgentForm(source: AgentConsoleItem | null | undefined, form: AgentFormState): AgentConsoleItem {
  const next = cloneConfig(source ?? {}) as AgentConsoleItem;
  next.id = form.id.trim();

  if (form.name.trim()) next.name = form.name.trim();
  else delete next.name;
  if (form.workspace.trim()) next.workspace = form.workspace.trim();
  else delete next.workspace;
  if (form.agentDir.trim()) next.agentDir = form.agentDir.trim();
  else delete next.agentDir;

  const identity = isRecord(next.identity) ? cloneConfig(next.identity) : {};
  if (form.name.trim()) identity.name = form.name.trim();
  else delete identity.name;
  if (form.emoji.trim()) identity.emoji = form.emoji.trim();
  else delete identity.emoji;
  if (form.vibe.trim()) identity.vibe = form.vibe.trim();
  else delete identity.vibe;
  if (Object.keys(identity).length > 0) next.identity = identity;
  else delete next.identity;

  setModelValue(
    next,
    form.defaultModel.trim(),
    form.fallbackModels.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
  );

  const tools = isRecord(next.tools) ? cloneConfig(next.tools) : {};
  if (form.toolProfile.trim()) tools.profile = form.toolProfile.trim();
  else delete tools.profile;
  const alsoAllow = form.alsoAllow.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (alsoAllow.length > 0) tools.alsoAllow = alsoAllow;
  else delete tools.alsoAllow;
  if (Object.keys(tools).length > 0) next.tools = tools;
  else delete next.tools;

  const skills = form.skills.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (skills.length > 0) next.skills = skills;
  else delete next.skills;

  const subagents = isRecord(next.subagents) ? cloneConfig(next.subagents) : {};
  const allowAgents = form.allowAgents.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (allowAgents.length > 0) subagents.allowAgents = allowAgents;
  else delete subagents.allowAgents;
  if (form.subagentModel.trim()) subagents.model = form.subagentModel.trim();
  else delete subagents.model;
  if (form.subagentThinking.trim()) subagents.thinking = form.subagentThinking.trim();
  else delete subagents.thinking;
  if (form.maxConcurrent.trim()) {
    const parsed = Number(form.maxConcurrent);
    if (Number.isFinite(parsed) && parsed > 0) subagents.maxConcurrent = parsed;
    else delete subagents.maxConcurrent;
  } else {
    delete subagents.maxConcurrent;
  }
  if (Object.keys(subagents).length > 0) next.subagents = subagents;
  else delete next.subagents;

  return next;
}

function formatFileSize(size?: number) {
  if (!size || size <= 0) return "-";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatFileTime(updatedAtMs?: number) {
  if (!updatedAtMs) return "未知";
  const diff = Math.max(0, Date.now() - updatedAtMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

function sortMemoryFiles(files: AgentMemoryFile[]) {
  const priority = ["SOUL.md", "MEMORY.md", "AGENTS.md", "HEARTBEAT.md", "IDENTITY.md", "TOOLS.md", "USER.md"];
  return [...files].sort((a, b) => {
    const ai = priority.indexOf(a.name);
    const bi = priority.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.name.localeCompare(b.name);
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function StatsStrip({ items }: { items: Array<{ icon: typeof Bot; label: string; value: string }> }) {
  return (
    <Card className="border-border/50 bg-background/80 shadow-sm">
      <CardContent className="grid grid-cols-4 divide-x divide-border/50 p-0">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-w-0 items-center gap-2 px-2 py-3 sm:px-3 sm:py-4">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-primary sm:size-8">
              <Icon className="size-3 sm:size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium leading-none text-muted-foreground sm:text-[10px]">{label}</p>
              <p className="mt-1 truncate text-lg font-black leading-none tracking-tight sm:text-xl">{value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AgentEditorPanel({
  isMobile,
  form,
  previewAgent,
  models,
  profiles,
  toolIds,
  isDirty,
  memoryFiles,
  memoryLoading,
  memorySaving,
  memorySearch,
  selectedMemoryName,
  memoryContent,
  memoryDirty,
  memoryEditorOpen,
  updateForm,
  setMemorySearch,
  onSelectMemoryFile,
  onChangeMemoryContent,
  onSaveMemoryFile,
  onOpenMemoryFile,
  onCloseMemoryEditor,
  onDelete,
}: {
  isMobile: boolean;
  form: AgentFormState;
  previewAgent: AgentConsoleItem | null;
  models: string[];
  profiles: string[];
  toolIds: string[];
  isDirty: boolean;
  memoryFiles: AgentMemoryFile[];
  memoryLoading: boolean;
  memorySaving: boolean;
  memorySearch: string;
  selectedMemoryName: string | null;
  memoryContent: string;
  memoryDirty: boolean;
  memoryEditorOpen: boolean;
  updateForm: <K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) => void;
  setMemorySearch: (value: string) => void;
  onSelectMemoryFile: (name: string) => void;
  onChangeMemoryContent: (value: string) => void;
  onSaveMemoryFile: () => void;
  onOpenMemoryFile: (name: string) => void;
  onCloseMemoryEditor: () => void;
  onDelete: () => void;
}) {
  const selectedAlsoAllow = useMemo(() => new Set(normalizeStringArray(form.alsoAllow)), [form.alsoAllow]);
  const allToolsSelected = toolIds.length > 0 && toolIds.every((tool) => selectedAlsoAllow.has(tool));

  const toggleTool = (toolId: string, checked: boolean) => {
    const next = new Set(normalizeStringArray(form.alsoAllow));
    if (checked) next.add(toolId);
    else next.delete(toolId);
    updateForm("alsoAllow", Array.from(next).join("\n"));
  };

  const toggleAllTools = (checked: boolean) => {
    updateForm("alsoAllow", checked ? toolIds.join("\n") : "");
  };

  return (
    <Card className="border-border/50 bg-background/80">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-3xl font-black tracking-tight">{form.name || form.id || "未命名代理"}</CardTitle>
            <CardDescription className="mt-1">{form.id || "先填写代理 ID。"}</CardDescription>
          </div>
          <Button variant="outline" size="icon" className="rounded-2xl border-red-500/20 text-red-600 hover:bg-red-500/5" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.defaultModel ? <Badge variant="outline">模型：{form.defaultModel}</Badge> : null}
          {form.toolProfile ? <Badge variant="outline">工具档位：{form.toolProfile}</Badge> : null}
          {memoryFiles.length > 0 ? <Badge variant="outline">记忆文件：{memoryFiles.length}</Badge> : null}
          {isDirty ? <Badge className="bg-orange-500 text-white hover:bg-orange-500">未保存</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1">
            <TabsTrigger value="overview" className="rounded-xl">概览</TabsTrigger>
            <TabsTrigger value="model" className="rounded-xl">模型</TabsTrigger>
            <TabsTrigger value="tools" className="rounded-xl">工具</TabsTrigger>
            <TabsTrigger value="skills" className="rounded-xl">技能</TabsTrigger>
            <TabsTrigger value="memory" className="rounded-xl">记忆</TabsTrigger>
            <TabsTrigger value="raw" className="rounded-xl">原始配置</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="代理 ID">
                <Input value={form.id} onChange={(event) => updateForm("id", event.target.value)} placeholder="main" />
              </Field>
              <Field label="显示名称">
                <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="主代理" />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="表情">
                <Input value={form.emoji} onChange={(event) => updateForm("emoji", event.target.value)} placeholder="🤖" />
              </Field>
              <Field label="气质">
                <Input value={form.vibe} onChange={(event) => updateForm("vibe", event.target.value)} placeholder="冷静、敏锐、支持型" />
              </Field>
            </div>
            <Field label="工作区">
              <Input value={form.workspace} onChange={(event) => updateForm("workspace", event.target.value)} placeholder="/root/.openclaw/workspace-main" />
            </Field>
            <Field label="代理目录">
              <Input value={form.agentDir} onChange={(event) => updateForm("agentDir", event.target.value)} placeholder="/root/.openclaw/agents/main/agent" />
            </Field>
          </TabsContent>

          <TabsContent value="model" className="space-y-5">
            <Field label="主模型">
              <Input list="agent-model-options" value={form.defaultModel} onChange={(event) => updateForm("defaultModel", event.target.value)} placeholder="openai/gpt-5.4" />
            </Field>
            <Field label="Fallback 模型（每行一个）">
              <textarea
                value={form.fallbackModels}
                onChange={(event) => updateForm("fallbackModels", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"openai/gpt-5.4-mini\nanthropic/claude-3.7-sonnet"}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="子代理模型">
                <Input list="agent-model-options" value={form.subagentModel} onChange={(event) => updateForm("subagentModel", event.target.value)} placeholder="继承或指定更轻的模型" />
              </Field>
              <Field label="子代理思考强度">
                <Input value={form.subagentThinking} onChange={(event) => updateForm("subagentThinking", event.target.value)} placeholder="low / medium / high" />
              </Field>
            </div>
            <Field label="最大并发子代理数">
              <Input value={form.maxConcurrent} onChange={(event) => updateForm("maxConcurrent", event.target.value)} placeholder="2" inputMode="numeric" />
            </Field>
            <datalist id="agent-model-options">
              {models.map((item) => <option key={item} value={item} />)}
            </datalist>
          </TabsContent>

          <TabsContent value="tools" className="space-y-5">
            <Field label="工具档位">
              <Input list="agent-tool-profiles" value={form.toolProfile} onChange={(event) => updateForm("toolProfile", event.target.value)} placeholder="full" />
            </Field>
            <datalist id="agent-tool-profiles">
              {profiles.map((profile) => <option key={profile} value={profile} />)}
            </datalist>

            <div className="rounded-3xl border border-border/50 bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">额外允许</p>
                  <p className="text-xs text-muted-foreground">可以直接勾选下面的工具，也可以在文本框里一行填一个。</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={allToolsSelected} onCheckedChange={(checked) => toggleAllTools(Boolean(checked))} />
                  全选
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {toolIds.map((toolId) => (
                  <label key={toolId} className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background px-3 py-2 text-sm">
                    <Checkbox checked={selectedAlsoAllow.has(toolId)} onCheckedChange={(checked) => toggleTool(toolId, Boolean(checked))} />
                    <span className="truncate">{toolId}</span>
                  </label>
                ))}
              </div>
            </div>

            <Field label="额外允许（每行一个）">
              <textarea
                value={form.alsoAllow}
                onChange={(event) => updateForm("alsoAllow", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"exec\nimage_gen"}
              />
            </Field>
          </TabsContent>

          <TabsContent value="skills" className="space-y-5">
            <Field label="技能（每行一个）">
              <textarea
                value={form.skills}
                onChange={(event) => updateForm("skills", event.target.value)}
                className="min-h-32 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"coding\nreview\nimagegen"}
              />
            </Field>
            <Field label="允许调度的子代理">
              <textarea
                value={form.allowAgents}
                onChange={(event) => updateForm("allowAgents", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"main\nreviewer\nexecutor"}
              />
            </Field>
          </TabsContent>

          <TabsContent value="memory" className="space-y-5">
            <div className={cn("grid gap-5", isMobile ? "" : "xl:grid-cols-[320px_minmax(0,1fr)]")}>
              <div className="space-y-4">
                <Field label="搜索记忆">
                  <Input value={memorySearch} onChange={(event) => setMemorySearch(event.target.value)} placeholder="搜索记忆文件..." />
                </Field>
                <div className="space-y-3">
                  {memoryLoading ? (
                    <div className="rounded-3xl border border-border/50 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">正在读取记忆文件...</div>
                  ) : memoryFiles.length === 0 ? (
                    <div className="rounded-3xl border border-border/50 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">未找到可用记忆文件。</div>
                  ) : (
                    memoryFiles.map((file) => (
                      <button
                        key={file.name}
                        type="button"
                        onClick={() => (isMobile ? onOpenMemoryFile(file.name) : onSelectMemoryFile(file.name))}
                        className={cn(
                          "w-full rounded-3xl border px-4 py-4 text-left shadow-sm transition",
                          selectedMemoryName === file.name ? "border-primary/40 bg-primary/[0.04]" : "border-border/60 bg-background",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl leading-none">{file.name === "SOUL.md" ? "🧬" : file.name === "MEMORY.md" ? "🧠" : file.name === "AGENTS.md" ? "🤖" : file.name === "HEARTBEAT.md" ? "💗" : file.name === "IDENTITY.md" ? "🪪" : file.name === "TOOLS.md" ? "🔧" : file.name === "USER.md" ? "👤" : "📄"}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-black tracking-tight">{file.name}</p>
                            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)} · {formatFileTime(file.updatedAtMs)}</p>
                          </div>
                          {isMobile ? <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/60" /> : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {!isMobile ? <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black tracking-tight">{selectedMemoryName || "请选择文件"}</p>
                    <p className="text-sm text-muted-foreground">读取后直接编辑，保存会写回代理工作区文件。</p>
                  </div>
                  <Button onClick={onSaveMemoryFile} disabled={!selectedMemoryName || memorySaving || !memoryDirty} className="rounded-2xl">
                    <Save className="size-4" /> 保存文件
                  </Button>
                </div>
                <textarea
                  value={memoryContent}
                  onChange={(event) => onChangeMemoryContent(event.target.value)}
                  disabled={!selectedMemoryName}
                  className="min-h-[420px] w-full rounded-3xl border border-input bg-background px-4 py-4 font-mono text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="先从左侧选择一个记忆文件。"
                />
              </div> : null}
            </div>
            {isMobile ? (
              <Dialog open={memoryEditorOpen && !!selectedMemoryName} onOpenChange={(open) => !open && onCloseMemoryEditor()}>
                <DialogContent className="top-auto bottom-0 left-0 right-0 z-50 flex max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-t-[2rem] rounded-b-none border-border/50 p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]">
                  <DialogHeader className="border-b border-border/40 px-5 pb-4 pt-5 text-left">
                    <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
                    <DialogTitle>{selectedMemoryName || "记忆文件"}</DialogTitle>
                    <DialogDescription>先读取文件，再在这里直接修改并保存回代理工作区。</DialogDescription>
                  </DialogHeader>
                  <MobileBottomSheetContent className="px-5 py-5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black tracking-tight">{selectedMemoryName || "请选择文件"}</p>
                          <p className="text-sm text-muted-foreground">读取后可直接编辑，保存会写回代理工作区文件。</p>
                        </div>
                        <Button onClick={onSaveMemoryFile} disabled={!selectedMemoryName || memorySaving || !memoryDirty} className="rounded-2xl">
                          <Save className="size-4" /> 保存文件
                        </Button>
                      </div>
                      <textarea
                        value={memoryContent}
                        onChange={(event) => onChangeMemoryContent(event.target.value)}
                        disabled={!selectedMemoryName}
                        className="min-h-[52vh] w-full rounded-3xl border border-input bg-background px-4 py-4 font-mono text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="先从列表里点选一个记忆文件。"
                      />
                    </div>
                  </MobileBottomSheetContent>
                </DialogContent>
              </Dialog>
            ) : null}
          </TabsContent>

          <TabsContent value="raw">
            <pre className="max-h-[520px] overflow-auto rounded-3xl border border-border/50 bg-muted/10 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {previewAgent ? toJson(previewAgent) : "{}"}
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [configRoot, setConfigRoot] = useState<Record<string, unknown>>({});
  const [agents, setAgents] = useState<AgentConsoleItem[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);
  const [initialFormJson, setInitialFormJson] = useState(JSON.stringify(EMPTY_FORM));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryFiles, setMemoryFiles] = useState<AgentMemoryFile[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  const [selectedMemoryName, setSelectedMemoryName] = useState<string | null>(null);
  const [memoryContent, setMemoryContent] = useState("");
  const [initialMemoryContent, setInitialMemoryContent] = useState("");

  const fetchData = useCallback(async (preferredId?: string | null) => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [configRes, modelsRes, toolsRes] = await Promise.all([
        client.request<GatewayConfigResponse>("config.get", {}),
        client.request<ModelsListResponse>("models.list", {}),
        client.request<ToolsCatalogResponse>("tools.catalog", {}).catch(() => ({ profiles: {}, groups: [], tools: [] })),
      ]);

      const root = cloneConfig(getConfigRoot(configRes));
      const nextAgents = getAgentsList(root);
      const nextSelectedId = preferredId && nextAgents.some((agent) => agent.id === preferredId)
        ? preferredId
        : nextAgents[0]?.id ?? null;

      setConfigRoot(root);
      setHash(configRes.hash ?? null);
      setAgents(nextAgents);
      setModels((modelsRes.models || []).map((item) => item.id).filter(Boolean));
      setProfiles(getCatalogProfiles(toolsRes));
      setToolIds(getCatalogToolIds(toolsRes));
      setSelectedId(nextSelectedId);
    } catch (error) {
      toast({
        title: "加载代理失败",
        description: error instanceof Error ? error.message : "无法从配置中读取 agents.list。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId],
  );

  useEffect(() => {
    const nextForm = toAgentForm(selectedAgent);
    setForm(nextForm);
    setInitialFormJson(JSON.stringify(nextForm));
  }, [selectedAgent]);

  const loadMemoryFiles = useCallback(async (agentId: string, preferredName?: string | null) => {
    if (!client || !connected) return;
    setMemoryLoading(true);
    try {
      const res = await client.request<{ files?: AgentMemoryFile[] }>("agents.files.list", { agentId });
      const files = sortMemoryFiles((res.files || []).filter((file) => /\.md$/i.test(file.name)));
      const nextSelected = preferredName && files.some((file) => file.name === preferredName)
        ? preferredName
        : files[0]?.name ?? null;
      setMemoryFiles(files);
      setSelectedMemoryName(nextSelected);
    } catch (error) {
      setMemoryFiles([]);
      setSelectedMemoryName(null);
      toast({
        title: "读取记忆文件失败",
        description: error instanceof Error ? error.message : "无法读取代理工作区文件。",
        variant: "destructive",
      });
    } finally {
      setMemoryLoading(false);
    }
  }, [client, connected, toast]);

  const loadMemoryContent = useCallback(async (agentId: string, fileName: string) => {
    if (!client || !connected) return;
    try {
      const res = await client.request<{ file?: { content?: string } }>("agents.files.get", { agentId, name: fileName });
      const content = res.file?.content ?? "";
      setMemoryContent(content);
      setInitialMemoryContent(content);
    } catch (error) {
      setMemoryContent("");
      setInitialMemoryContent("");
      toast({
        title: "读取文件失败",
        description: error instanceof Error ? error.message : "无法读取所选记忆文件。",
        variant: "destructive",
      });
    }
  }, [client, connected, toast]);

  useEffect(() => {
    setMemorySearch("");
    setMemoryContent("");
    setInitialMemoryContent("");
    setMemoryEditorOpen(false);
    if (!selectedAgent?.id) {
      setMemoryFiles([]);
      setSelectedMemoryName(null);
      return;
    }
    loadMemoryFiles(selectedAgent.id);
  }, [loadMemoryFiles, selectedAgent?.id]);

  useEffect(() => {
    if (!selectedAgent?.id || !selectedMemoryName) {
      setMemoryContent("");
      setInitialMemoryContent("");
      return;
    }
    loadMemoryContent(selectedAgent.id, selectedMemoryName);
  }, [loadMemoryContent, selectedAgent?.id, selectedMemoryName]);

  const previewAgent = useMemo(() => {
    if (!selectedAgent) return null;
    return applyAgentForm(selectedAgent, form);
  }, [form, selectedAgent]);

  const visibleMemoryFiles = useMemo(() => {
    const query = memorySearch.trim().toLowerCase();
    if (!query) return memoryFiles;
    return memoryFiles.filter((file) => file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query));
  }, [memoryFiles, memorySearch]);

  const memoryDirty = memoryContent !== initialMemoryContent;

  const handleOpenMemoryFile = useCallback((name: string) => {
    setSelectedMemoryName(name);
    setMemoryEditorOpen(true);
  }, []);

  const handleCloseMemoryEditor = useCallback(() => {
    setMemoryEditorOpen(false);
  }, []);

  const isDirty = JSON.stringify(form) !== initialFormJson;
  const agentCount = agents.length;
  const profileCount = agents.filter((agent) => agent.tools?.profile).length;
  const skillCount = agents.reduce((sum, agent) => sum + normalizeStringArray(agent.skills).length, 0);
  const subagentCount = agents.filter((agent) => normalizeStringArray(agent.subagents?.allowAgents).length > 0).length;

  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedId(agentId);
    if (isMobile) setMobileDetailOpen(true);
  }, [isMobile]);

  const updateForm = useCallback(<K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCreateAgent = useCallback(() => {
    const draft = createDraftAgent(agents);
    setAgents((prev) => [...prev, draft]);
    setSelectedId(draft.id);
    if (isMobile) setMobileDetailOpen(true);
  }, [agents, isMobile]);

  const persist = useCallback(async (apply = false) => {
    if (!client || !connected || !selectedAgent) return;
    const nextId = form.id.trim();
    if (!nextId) {
      toast({ title: "代理 ID 不能为空", description: "请先填写代理 ID 再保存。", variant: "destructive" });
      return;
    }
    const duplicate = agents.some((agent) => agent.id === nextId && agent.id !== selectedAgent.id);
    if (duplicate) {
      toast({ title: "代理 ID 已存在", description: "请换一个新的 ID。", variant: "destructive" });
      return;
    }

    const nextAgent = applyAgentForm(selectedAgent, form);
    const nextAgents = agents.map((agent) => (agent.id === selectedAgent.id ? nextAgent : agent));
    const nextRoot = cloneConfig(configRoot);
    setAgentsList(nextRoot, nextAgents);

    if (apply) setApplying(true);
    else setSaving(true);
    try {
      await client.request(apply ? "config.apply" : "config.set", {
        raw: toJson(nextRoot),
        baseHash: hash ?? "",
        ...(apply ? { sessionKey: "agents-console" } : {}),
      });
      toast({
        title: apply ? "代理配置已应用" : "代理配置已保存",
        description: apply ? "Gateway 已重新加载最新的 agents.list。" : "变更已写入配置。",
      });
      await fetchData(nextAgent.id);
    } catch (error) {
      toast({
        title: apply ? "应用失败" : "保存失败",
        description: error instanceof Error ? error.message : "代理配置更新失败。",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
      setSaving(false);
    }
  }, [agents, client, configRoot, connected, fetchData, form, hash, selectedAgent, toast]);

  const handleDelete = useCallback(async () => {
    if (!client || !connected || !selectedAgent) return;
    const nextAgents = agents.filter((agent) => agent.id !== selectedAgent.id);
    const nextRoot = cloneConfig(configRoot);
    setAgentsList(nextRoot, nextAgents);
    setSaving(true);
    try {
      await client.request("config.set", {
        raw: toJson(nextRoot),
        baseHash: hash ?? "",
      });
      setDeleteOpen(false);
      toast({ title: "代理已删除", description: `${selectedAgent.id} 已从 agents.list 中移除。` });
      await fetchData(nextAgents[0]?.id ?? null);
      if (isMobile) setMobileDetailOpen(false);
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "无法删除当前代理。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [agents, client, configRoot, connected, fetchData, hash, isMobile, selectedAgent, toast]);

  const handleSaveMemoryFile = useCallback(async () => {
    if (!client || !connected || !selectedAgent?.id || !selectedMemoryName) return;
    setMemorySaving(true);
    try {
      const result = await client.request<{ ok?: boolean }>("agents.files.set", {
        agentId: selectedAgent.id,
        name: selectedMemoryName,
        content: memoryContent,
      });
      if (!result.ok) {
        throw new Error("Gateway rejected save request.");
      }
      setInitialMemoryContent(memoryContent);
      await loadMemoryFiles(selectedAgent.id, selectedMemoryName);
      toast({ title: "记忆文件已保存", description: `${selectedMemoryName} 已写回代理工作区。` });
    } catch (error) {
      toast({
        title: "保存记忆文件失败",
        description: error instanceof Error ? error.message : "无法写入所选记忆文件。",
        variant: "destructive",
      });
    } finally {
      setMemorySaving(false);
    }
  }, [client, connected, loadMemoryFiles, memoryContent, selectedAgent?.id, selectedMemoryName, toast]);

  const detailContent = selectedAgent ? (
    <AgentEditorPanel
      isMobile={isMobile}
      form={form}
      previewAgent={previewAgent}
      models={models}
      profiles={profiles}
      toolIds={toolIds}
      isDirty={isDirty}
      memoryFiles={visibleMemoryFiles}
      memoryLoading={memoryLoading}
      memorySaving={memorySaving}
      memorySearch={memorySearch}
      selectedMemoryName={selectedMemoryName}
      memoryContent={memoryContent}
      memoryDirty={memoryDirty}
      memoryEditorOpen={memoryEditorOpen}
      updateForm={updateForm}
      setMemorySearch={setMemorySearch}
      onSelectMemoryFile={setSelectedMemoryName}
      onChangeMemoryContent={setMemoryContent}
      onSaveMemoryFile={handleSaveMemoryFile}
      onOpenMemoryFile={handleOpenMemoryFile}
      onCloseMemoryEditor={handleCloseMemoryEditor}
      onDelete={() => setDeleteOpen(true)}
    />
  ) : (
    <Card className="border-border/50 bg-background/80">
      <CardContent className="flex min-h-[320px] items-center justify-center p-10 text-center">
        <div className="space-y-3 text-muted-foreground">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
            <Bot className="size-8" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-foreground">先选择一个代理</h2>
          <p className="max-w-md text-sm leading-relaxed">从左侧列表选择代理后，就可以编辑它的人设、记忆、模型策略、工具档位和子代理规则。</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-muted/5 p-3 sm:p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden pb-8 sm:space-y-6 sm:pb-12">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
              <GitBranchPlus className="size-3.5" /> 代理控制台
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">代理控制台</h1>
              <p className="text-sm text-muted-foreground">统一管理代理的人设、记忆、模型策略、工具档位和子代理权限。</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => fetchData(selectedId)} disabled={loading} className="h-11 rounded-2xl">
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
              <span className="hidden sm:inline">刷新</span>
            </Button>
            <Button variant="outline" onClick={() => persist(false)} disabled={!isDirty || saving || !selectedAgent} className="h-11 rounded-2xl border-orange-500/20 text-orange-600 hover:bg-orange-500/5">
              <Save className="size-4" />
              <span className="hidden sm:inline">保存</span>
            </Button>
            <Button onClick={() => persist(true)} disabled={!isDirty || applying || !selectedAgent} className="h-11 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">
              <Play className="size-4" />
              <span className="hidden sm:inline">应用</span>
            </Button>
          </div>

        <StatsStrip
          items={[
            { icon: Bot, label: "代理数", value: String(agentCount) },
            { icon: Wrench, label: "档位数", value: String(profileCount) },
            { icon: Sparkles, label: "技能数", value: String(skillCount) },
            { icon: GitBranchPlus, label: "子代理", value: String(subagentCount) },
          ]}
        />
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="max-w-full overflow-hidden border-border/50 bg-background/80">
            <CardHeader className="space-y-3 pb-4">
              <div className="space-y-1">
                <CardTitle>代理列表</CardTitle>
                <CardDescription>手机端点选代理卡片后，会从底部弹出编辑面板；桌面端仍然在右侧编辑。</CardDescription>
              </div>
              <Button onClick={handleCreateAgent} className="h-10 rounded-2xl">
                <Plus className="size-4" /> 新建
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 overflow-hidden">
              <div className="max-w-full">
                <div className="flex min-w-0 flex-col gap-3">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => handleSelectAgent(agent.id)}
                      className={cn(
                        "w-full min-w-0 rounded-[1.25rem] border px-3.5 py-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md",
                        selectedId === agent.id ? "border-primary/40 bg-primary/[0.04]" : "border-border/60 bg-background",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.06] text-primary">
                          <Bot className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-black tracking-tight">{agent.identity?.name || agent.name || agent.id}</p>
                              <p className="truncate text-xs text-muted-foreground">{agent.id}</p>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {agent.tools?.profile ? (
                              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                                {agent.tools.profile}
                              </Badge>
                            ) : null}
                            {normalizeStringArray(agent.subagents?.allowAgents).length > 0 ? (
                              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                                子代理
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden xl:block">{detailContent}</div>
        </div>
      </div>

      <Dialog open={mobileDetailOpen && !!selectedAgent} onOpenChange={setMobileDetailOpen}>
        <DialogContent className="top-auto bottom-0 left-0 right-0 z-50 flex max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-t-[2rem] rounded-b-none border-border/50 p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] xl:hidden">
          <DialogHeader className="border-b border-border/40 px-5 pb-4 pt-5 text-left">
            <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            <DialogTitle>代理详情</DialogTitle>
            <DialogDescription>在手机上点选代理卡片后，会从底部弹出详情，不需要离开当前列表。</DialogDescription>
          </DialogHeader>
          <MobileBottomSheetContent className="px-5 py-5">
            {detailContent}
          </MobileBottomSheetContent>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除代理</DialogTitle>
            <DialogDescription>这会把当前代理从 <code>agents.list</code> 中移除。若想先检查变更，也可以先保存再删除。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
