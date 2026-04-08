"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Globe, ImageIcon, Info, Link2, Mic, Play, RefreshCw, Save, Search, Shapes, Wrench } from "lucide-react";
import {
  type GatewayConfigResponse,
  type ToolsCatalogResponse,
  cloneConfig,
  getCatalogProfiles,
  getCatalogToolIds,
  getConfigRoot,
  getToolSettings,
  setToolSettings,
  toJson,
} from "@/lib/openclaw/console-config";

type ToolSettingsState = ReturnType<typeof getToolSettings>;

type ToolDetail = {
  id: string;
  groupName: string;
  label: string;
  description: string;
  raw: Record<string, unknown> | null;
};

function normalizeToolEntry(tool: unknown, fallbackGroupName: string): ToolDetail | null {
  if (typeof tool === "string") {
    return {
      id: tool,
      groupName: fallbackGroupName,
      label: tool,
      description: "未提供额外元信息的 tool id。",
      raw: null,
    };
  }
  if (!tool || typeof tool !== "object") return null;
  const record = tool as Record<string, unknown>;
  const id = [record.id, record.name, record.key].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  if (!id) return null;
  const label = [record.label, record.title, record.displayName].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const description = [record.description, record.summary, record.help].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  return {
    id,
    groupName: fallbackGroupName,
    label: label ?? id,
    description: description ?? "该工具未提供描述信息。",
    raw: record,
  };
}

export default function ToolsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [configRoot, setConfigRoot] = useState<Record<string, unknown>>({});
  const [catalog, setCatalog] = useState<ToolsCatalogResponse | null>(null);
  const [settings, setSettings] = useState<ToolSettingsState>(() => getToolSettings({}));
  const [initialJson, setInitialJson] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [configRes, toolsRes] = await Promise.all([
        client.request<GatewayConfigResponse>("config.get", {}),
        client.request<ToolsCatalogResponse>("tools.catalog", {}).catch(() => ({ profiles: {}, groups: [], tools: [] })),
      ]);
      const root = cloneConfig(getConfigRoot(configRes));
      const nextSettings = getToolSettings(root);
      setConfigRoot(root);
      setHash(configRes.hash ?? null);
      setCatalog(toolsRes);
      setSettings(nextSettings);
      setInitialJson(JSON.stringify(nextSettings, null, 2));
    } catch (error) {
      toast({ title: "加载工具控制台失败", description: error instanceof Error ? error.message : "无法读取 tools.catalog 或工具设置", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const preview = useMemo(() => JSON.stringify(settings, null, 2), [settings]);
  const isDirty = preview !== initialJson;
  const profiles = useMemo(() => getCatalogProfiles(catalog), [catalog]);
  const allTools = useMemo(() => getCatalogToolIds(catalog), [catalog]);
  const groupedTools = useMemo(() => {
    const groupMap = new Map<string, Map<string, ToolDetail>>();

    const addDetail = (detail: ToolDetail) => {
      const groupName = detail.groupName.trim() || "Ungrouped";
      if (!groupMap.has(groupName)) groupMap.set(groupName, new Map());
      const group = groupMap.get(groupName)!;
      if (!group.has(detail.id)) group.set(detail.id, detail);
    };

    (catalog?.groups || []).forEach((group) => {
      const groupName = typeof group.label === "string" && group.label.trim()
        ? group.label.trim()
        : typeof group.name === "string" && group.name.trim()
          ? group.name.trim()
          : "Ungrouped";
      const tools = Array.isArray(group.tools) ? group.tools : [];
      tools.forEach((tool) => {
        const detail = normalizeToolEntry(tool, groupName);
        if (detail) addDetail(detail);
      });
    });

    (Array.isArray(catalog?.tools) ? catalog.tools : []).forEach((tool) => {
      const detail = normalizeToolEntry(tool, "Ungrouped");
      if (detail) addDetail(detail);
    });

    allTools.forEach((toolId) => {
      const exists = Array.from(groupMap.values()).some((tools) => tools.has(toolId));
      if (!exists) {
        addDetail({
          id: toolId,
          groupName: "Ungrouped",
          label: toolId,
          description: "未提供额外元信息的 tool id。",
          raw: null,
        });
      }
    });

    const query = toolSearch.trim().toLowerCase();
    return Array.from(groupMap.entries())
      .map(([groupName, tools]) => ({
        groupName,
        tools: Array.from(tools.values())
          .sort((a, b) => a.id.localeCompare(b.id))
          .filter((tool) => {
            if (!query) return true;
            return [tool.id, tool.label, tool.description].some((value) => value.toLowerCase().includes(query));
          }),
      }))
      .filter((group) => group.tools.length > 0)
      .sort((a, b) => {
        if (a.groupName === "Ungrouped") return 1;
        if (b.groupName === "Ungrouped") return -1;
        return a.groupName.localeCompare(b.groupName);
      });
  }, [allTools, catalog, toolSearch]);

  const filteredToolCount = useMemo(
    () => groupedTools.reduce((sum, group) => sum + group.tools.length, 0),
    [groupedTools],
  );

  const visibleGroups = useMemo(
    () => [
      { name: "all", count: filteredToolCount, description: "显示当前搜索条件下的全部工具。" },
      ...groupedTools.map((group) => ({
        name: group.groupName,
        count: group.tools.length,
        description: `${group.groupName} 分组下的工具集合。`,
      })),
    ],
    [filteredToolCount, groupedTools],
  );

  const visibleTools = useMemo(() => {
    if (selectedGroup === "all") return groupedTools.flatMap((group) => group.tools);
    return groupedTools.find((group) => group.groupName === selectedGroup)?.tools ?? [];
  }, [groupedTools, selectedGroup]);

  const selectedTool = useMemo(
    () => visibleTools.find((tool) => tool.id === selectedToolId) ?? visibleTools[0] ?? null,
    [selectedToolId, visibleTools],
  );

  useEffect(() => {
    if (!visibleGroups.some((group) => group.name === selectedGroup)) {
      setSelectedGroup("all");
    }
  }, [selectedGroup, visibleGroups]);

  useEffect(() => {
    if (!selectedTool) {
      setSelectedToolId(null);
      return;
    }
    if (selectedTool.id !== selectedToolId) {
      setSelectedToolId(selectedTool.id);
    }
  }, [selectedTool, selectedToolId]);

  const persist = useCallback(
    async (apply = false) => {
      if (!client || !connected) return;
      const nextRoot = cloneConfig(configRoot);
      setToolSettings(nextRoot, settings);
      if (apply) setApplying(true);
      else setSaving(true);
      try {
        await client.request(apply ? "config.apply" : "config.set", {
          raw: toJson(nextRoot),
          baseHash: hash ?? "",
          ...(apply ? { sessionKey: "tools-console" } : {}),
        });
        toast({ title: apply ? "工具设置已应用" : "工具设置已保存", description: apply ? "Gateway 已重新加载工具权限。" : "工具基础设置已写入配置。" });
        await fetchData();
      } catch (error) {
        toast({ title: apply ? "应用失败" : "保存失败", description: error instanceof Error ? error.message : "工具配置更新失败", variant: "destructive" });
      } finally {
        setApplying(false);
        setSaving(false);
      }
    },
    [client, configRoot, connected, fetchData, hash, settings, toast],
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/5 p-3 sm:p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 pb-8 sm:space-y-6 sm:pb-12">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
              <Wrench className="size-3.5" /> Tools Console
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">工具控制台</h1>
              <p className="text-sm text-muted-foreground">把参考项目里最常用的工具基础开关和完整 catalog 拆开：一边是可编辑设置，一边是全量工具目录。</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> 刷新</Button>
            <Button variant="outline" onClick={() => persist(false)} disabled={!isDirty || saving} className="w-full border-orange-500/20 text-orange-600 hover:bg-orange-500/5 sm:w-auto"><Save className="size-4" /> 保存</Button>
            <Button onClick={() => persist(true)} disabled={!isDirty || applying} className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"><Play className="size-4" /> 应用</Button>
          </div>
        </div>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1">
            <TabsTrigger value="settings" className="rounded-xl">基础设置</TabsTrigger>
            <TabsTrigger value="catalog" className="rounded-xl">全部工具</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
            <Card className="border-border/50 bg-background/80">
              <CardHeader>
                <CardTitle>Basics</CardTitle>
                <CardDescription>优先暴露 web / media / exec 这些参考项目里最常调的 gateway tool settings。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleCard icon={Globe} title="Web Search" description="允许工具直接做联网搜索。" checked={settings.webSearchEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, webSearchEnabled: value }))} />
                  <ToggleCard icon={Link2} title="Web Fetch" description="允许直接抓取页面内容与链接。" checked={settings.webFetchEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, webFetchEnabled: value }))} />
                  <ToggleCard icon={Link2} title="Links" description="控制链接解析与附带元信息提取。" checked={settings.linksEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, linksEnabled: value }))} />
                  <ToggleCard icon={ImageIcon} title="Image" description="允许图片理解、图片生成或图片输出。" checked={settings.mediaImageEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, mediaImageEnabled: value }))} />
                  <ToggleCard icon={Mic} title="Audio" description="允许音频转写、音频分析及相关能力。" checked={settings.mediaAudioEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, mediaAudioEnabled: value }))} />
                  <ToggleCard icon={ImageIcon} title="Video" description="允许视频理解或视频相关媒体管线。" checked={settings.mediaVideoEnabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, mediaVideoEnabled: value }))} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label="Exec Security" value={settings.execSecurity} onChange={(value) => setSettings((prev) => ({ ...prev, execSecurity: value }))} options={["deny", "allow", "workspace-write"]} />
                  <SelectField label="Exec Ask" value={settings.execAsk} onChange={(value) => setSettings((prev) => ({ ...prev, execAsk: value }))} options={["never", "on-miss", "always"]} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/50 bg-background/80">
                <CardHeader>
                  <CardTitle className="text-lg">配置档 Profiles</CardTitle>
                  <CardDescription>从 tools.catalog 中读到的 profile 名称，方便和 Agent Console 里的 profile 字段对应。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {profiles.length === 0 ? <Badge variant="outline">暂无 profiles</Badge> : profiles.map((profile) => <Badge key={profile} variant="outline">{profile}</Badge>)}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-background/80">
                <CardHeader>
                  <CardTitle className="text-lg">Raw Preview</CardTitle>
                  <CardDescription>保存前确认基础设置会如何写入 config.tools。</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-[420px] overflow-auto rounded-3xl border border-border/50 bg-muted/10 p-4 font-mono text-xs leading-relaxed text-muted-foreground">{preview}</pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="catalog">
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-6">
                <Card className="border-border/50 bg-background/80">
                  <CardHeader>
                    <CardTitle>Catalog Overview</CardTitle>
                    <CardDescription>按 group 和 tool id 把 gateway 返回的目录整理成更清晰的总览。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <MetricCard label="Tools" value={String(allTools.length)} description="catalog 去重后的 tool id 数量" />
                      <MetricCard label="Groups" value={String(groupedTools.length)} description="当前可识别的 group 数量" />
                      <MetricCard label="Profiles" value={String(profiles.length)} description="可供 Agent 引用的 tool profiles" />
                      <MetricCard label="Filtered" value={String(filteredToolCount)} description="当前搜索条件下显示的工具数量" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">搜索工具</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={toolSearch}
                          onChange={(event) => setToolSearch(event.target.value)}
                          placeholder="按 tool id 搜索，如 read / web / image / exec"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-background/80">
                  <CardHeader>
                    <CardTitle className="text-lg">Groups</CardTitle>
                    <CardDescription>左侧按 group 选择，右侧显示对应 tool grid 与 detail。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {visibleGroups.map((group) => (
                      <button
                        key={group.name}
                        type="button"
                        onClick={() => setSelectedGroup(group.name)}
                        className={`flex w-full flex-col gap-3 rounded-2xl border px-3 py-3 text-left transition-all sm:flex-row sm:items-center sm:justify-between ${
                          selectedGroup === group.name
                            ? "border-primary/30 bg-primary/5 shadow-sm"
                            : "border-border/50 bg-muted/10 hover:bg-muted/20"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Shapes className="size-4 text-primary" />
                            <span className="truncate text-sm font-semibold">{group.name === "all" ? "All groups" : group.name}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{group.count}</Badge>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-background/80">
                  <CardHeader>
                    <CardTitle className="text-lg">Profiles</CardTitle>
                    <CardDescription>展示 tools.catalog 里的 profile 名称，便于在 Agent Console 中引用。</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {profiles.length === 0 ? <Badge variant="outline">暂无 profiles</Badge> : profiles.map((profile) => <Badge key={profile} variant="outline">{profile}</Badge>)}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-border/50 bg-background/80">
                  <CardHeader>
                    <CardTitle>{selectedGroup === "all" ? "All Tools" : `${selectedGroup} Tools`}</CardTitle>
                    <CardDescription>
                      {selectedGroup === "all"
                        ? "展示当前搜索条件下的全部工具，并支持选择查看详细信息。"
                        : `当前只展示 ${selectedGroup} 分组内的工具。`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {visibleTools.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                        当前分组或搜索条件下没有匹配的工具。
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {visibleTools.map((tool) => (
                          <button
                            key={`${tool.groupName}:${tool.id}`}
                            type="button"
                            onClick={() => setSelectedToolId(tool.id)}
                            className={`rounded-2xl border p-4 text-left transition-all ${
                              selectedTool?.id === tool.id
                                ? "border-primary/30 bg-primary/5 shadow-sm"
                                : "border-border/50 bg-muted/10 hover:bg-muted/20"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-bold break-all">{tool.label}</div>
                                <div className="mt-1 text-xs text-muted-foreground break-all">{tool.id}</div>
                              </div>
                              <Badge variant="outline">{tool.groupName}</Badge>
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-background/80">
                  <CardHeader>
                    <CardTitle>Tool Detail</CardTitle>
                    <CardDescription>参考项目的控制台思路：右侧 detail 面板优先展示当前选中工具的可读信息和原始数据。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedTool ? (
                      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                        尚未选中工具。
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Wrench className="size-4 text-primary" />
                                <h3 className="text-base font-black tracking-tight">{selectedTool.label}</h3>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground break-all">{selectedTool.id}</p>
                            </div>
                            <Badge variant="outline">{selectedTool.groupName}</Badge>
                          </div>
                          <div className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 text-sm leading-relaxed text-muted-foreground">
                            {selectedTool.description}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <MetricCard label="Group" value={selectedTool.groupName} description="当前工具所属分组" />
                          <MetricCard label="Profile refs" value={String(profiles.length)} description="可在 Agent Console 中选择的工具 profiles" />
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                            <Info className="size-4 text-primary" />
                            Raw metadata
                          </div>
                          <pre className="max-h-[420px] overflow-auto rounded-2xl border border-border/50 bg-background/80 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                            {selectedTool.raw ? JSON.stringify(selectedTool.raw, null, 2) : JSON.stringify({ id: selectedTool.id }, null, 2)}
                          </pre>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function ToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Globe;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <Icon className="size-4 text-primary" /> {title}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{label}</label>
      <Input list={`options-${label}`} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={`options-${label}`}>{options.map((item) => <option key={item} value={item} />)}</datalist>
    </div>
  );
}
