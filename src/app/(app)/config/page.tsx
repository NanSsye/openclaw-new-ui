"use client";
import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings, Save, Play, RefreshCw,
  Code, Layout, FileJson, AlertCircle,
  Globe, Zap, Cpu,
  Terminal, Box, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";

type ConfigJson = Record<string, unknown>;

type ConfigSnapshot = {
  hash?: string;
  raw?: string;
  config?: ConfigJson;
  [key: string]: unknown;
};

type ConfigResponse = ConfigSnapshot;

type ApplyWindow = Window & {
  _applySessionKey?: string;
};

function toInputValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

const SECTIONS = [
  { id: "overview", label: "使用说明", icon: Settings, desc: "哪些项适合在这里改，哪些项应该去专门控制台页面" },
  { id: "agents", label: "代理默认项", icon: Cpu, desc: "仅保留 agents.defaults 下已确认有效的常用项" },
  { id: "gateway", label: "网关设置", icon: Globe, desc: "端口、隧道及网关级基础配置" },
  { id: "logging", label: "日志系统", icon: Terminal, desc: "日志等级与输出方式" },
  { id: "skills", label: "技能设置", icon: Zap, desc: "技能与插件目录等网关级配置" },
];

export default function ConfigPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"form" | "raw">("form");
  const [activeSection, setActiveSection] = useState("agents");
  const [rawConfig, setRawConfig] = useState("");
  const [originalRaw, setOriginalRaw] = useState("");
  const [configObj, setConfigObj] = useState<ConfigJson>({});
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const res = await client.request<ConfigResponse>("config.get", {});
      setSnapshot(res);
      const raw = res.raw || JSON.stringify(res.config || {}, null, 2);
      setRawConfig(raw);
      setOriginalRaw(raw);
      setConfigObj(res.config || {});
    } catch (err: unknown) {
      toast({ title: "加载配置失败", description: err instanceof Error ? err.message : "加载配置失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isDirty = rawConfig !== originalRaw;

  const handleSave = async () => {
    console.log("[Config] handleSave called", { client: !!client, snapshot: !!snapshot, isDirty, rawConfigLength: rawConfig.length });
    if (!client || !connected) {
      toast({ title: "保存失败", description: "网关未连接，请检查连接状态", variant: "destructive" });
      return;
    }
    if (!snapshot) {
      toast({ title: "保存失败", description: "配置数据未加载，请先刷新页面", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const baseHash = snapshot.hash ?? "";
      console.log("[Config] Sending config.set request");
      await client.request("config.set", {
        raw: rawConfig,
        baseHash,
      });
      toast({ title: "保存成功", description: "配置已保存到磁盘" });
      fetchData();
    } catch (err: unknown) {
      toast({ title: "保存失败", description: err instanceof Error ? err.message : "保存配置失败", variant: "destructive" });
      console.error("[Config] Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!client || !connected) {
      toast({ title: "应用失败", description: "网关未连接，请检查连接状态", variant: "destructive" });
      return;
    }
    if (!snapshot) {
      toast({ title: "应用失败", description: "配置数据未加载，请先刷新页面", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      const baseHash = snapshot.hash ?? "";
      await client.request("config.apply", {
        raw: rawConfig,
        baseHash,
        sessionKey: (window as ApplyWindow)._applySessionKey || "default-session"
      });
      toast({ title: "应用成功", description: "配置已应用，系统已重新加载" });
      fetchData();
    } catch (err: unknown) {
      toast({ title: "应用失败", description: err instanceof Error ? err.message : "应用配置失败", variant: "destructive" });
      console.error("[Config] Apply failed:", err);
    } finally {
      setApplying(false);
    }
  };

  const handleFormUpdate = (path: string, value: string | number | boolean) => {
    const next: ConfigJson = { ...configObj };
    const parts = path.split(".");
    let current: ConfigJson = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const existing = current[key];
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        current[key] = {};
      }
      current = current[key] as ConfigJson;
    }
    current[parts[parts.length - 1]] = value;
    setConfigObj(next);
    setRawConfig(JSON.stringify(next, null, 2));
  };

  const renderField = (label: string, path: string, type: "string" | "number" | "boolean", description?: string) => {
    const value = path.split(".").reduce<unknown>((acc, key) => {
      if (typeof acc === "object" && acc !== null && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, configObj);
    return (
      <div className="group space-y-2 p-3 rounded-xl border border-transparent hover:border-border/50 hover:bg-muted/30 transition-all">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">{label}</label>
          {type === "boolean" ? (
            <Switch 
              checked={!!value} 
              onCheckedChange={(v) => handleFormUpdate(path, v)}
              className="scale-90"
            />
          ) : null}
        </div>
        {description && <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>}
        {type !== "boolean" && (
          <Input 
            value={toInputValue(value)} 
            type={type === "number" ? "number" : "text"}
            onChange={(e) => handleFormUpdate(path, type === "number" ? Number(e.target.value) : e.target.value)}
            className="h-9 bg-background/50 border-border/50 focus:border-primary/30"
          />
        )}
      </div>
    );
  };

  const renderInfoCard = (title: string, description: string, hint?: string, tone: "amber" | "blue" = "amber") => (
    <div className={cn(
      "md:col-span-2 rounded-2xl p-4 space-y-2",
      tone === "amber"
        ? "border border-amber-500/20 bg-amber-500/5"
        : "border border-primary/20 bg-primary/5",
    )}>
      <div className={cn("flex items-center gap-2 text-sm font-semibold", tone === "amber" ? "text-amber-600" : "text-primary")}>
        <AlertCircle className="size-4" /> {title}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="px-4 md:px-8 py-3 md:py-4 border-b bg-background/50 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold">全局配置 (Config)</h1>
            <p className="text-xs text-muted-foreground">管理 OpenClaw 核心运行参数及多维度元数据。</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted/40 p-1 rounded-xl border mr-0 md:mr-4">
            <button 
              onClick={() => setMode("form")}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2", mode === "form" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Layout className="size-3.5" /> 可视化
            </button>
            <button 
              onClick={() => setMode("raw")}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2", mode === "raw" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Code className="size-3.5" /> 源码
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="rounded-xl border-border/50">
            <RefreshCw className={cn("size-3.5 mr-2", loading && "animate-spin")} /> 重载
          </Button>
          <Button 
            size="sm" 
            disabled={!isDirty || saving} 
            onClick={handleSave}
            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Save className="size-3.5 mr-2" /> 保存
          </Button>
          <Button 
            size="sm" 
            disabled={!isDirty || applying} 
            onClick={handleApply}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="size-3.5 mr-2" /> 应用并启动
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden flex-col sm:flex-row">
        {/* Left Sidebar - Hidden on mobile, shown on tablet+ */}
        <div className="hidden sm:block w-56 md:w-72 border-r bg-muted/10 overflow-y-auto p-3 md:p-4 space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-2xl transition-all group relative overflow-hidden",
                activeSection === s.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "hover:bg-muted/50 border border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <s.icon className={cn("size-5 mt-0.5", activeSection === s.id ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground")} />
              <div className="text-left">
                <p className="text-sm font-bold">{s.label}</p>
                <p className="text-[10px] opacity-70 leading-tight mt-0.5 line-clamp-1">{s.desc}</p>
              </div>
              {activeSection === s.id && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-full" />}
            </button>
          ))}
          <div className="pt-8 px-4">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase">
                <AlertCircle className="size-3" /> 注意事项
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                部分配置更改（如监听端口）可能需要系统完全重启。建议优先使用“应用并启动”进行热更新。
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Section Selector - Styled Dropdown */}
        <div className="sm:hidden w-full border-b bg-muted/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-9 rounded-xl bg-background/80 border-border/50 justify-between font-medium text-sm">
                <span className="flex items-center gap-2">
                  {(() => {
                    const Icon = SECTIONS.find(s => s.id === activeSection)?.icon || Box;
                    return <Icon className="size-4" />;
                  })()}
                  {SECTIONS.find(s => s.id === activeSection)?.label || "选择配置"}
                </span>
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[calc(100vw-32px)] max-h-[60vh] overflow-y-auto">
              {SECTIONS.map(s => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn("cursor-pointer", activeSection === s.id && "bg-primary/10")}
                >
                  <s.icon className="size-4 mr-2 opacity-60" />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-hidden bg-background">
          {mode === "raw" ? (
            <div className="h-full relative font-mono text-sm group">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={rawConfig}
                theme="vs-dark"
                onChange={(v: string | undefined) => setRawConfig(v || "")}
                options={{
                    fontSize: 14,
                    fontFamily: "'Fira Code', 'Monaco', monospace",
                    padding: { top: 32 },
                    lineNumbers: "on",
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    cursorStyle: "line",
                    automaticLayout: true,
                    minimap: { enabled: true },
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    renderLineHighlight: "all",
                }}
              />
              <div className="absolute top-4 right-10 flex items-center gap-2 z-10">
                <Badge variant="outline" className="bg-background/80 backdrop-blur border-primary/20 text-primary">JSON EDITOR</Badge>
                {isDirty && <Badge variant="warning">未保存更改</Badge>}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 md:p-8 lg:p-12 space-y-6 md:space-y-8 lg:space-y-12 max-w-4xl">
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8">
                  <div className="p-2 md:p-3 bg-primary/10 rounded-2xl">
                    {(() => {
                      const Icon = SECTIONS.find(s => s.id === activeSection)?.icon || Box;
                      return <Icon className="size-6 text-primary" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{SECTIONS.find(s => s.id === activeSection)?.label}</h2>
                    <p className="text-muted-foreground">{SECTIONS.find(s => s.id === activeSection)?.desc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-6">
                  {activeSection === "overview" && (
                    <>
                      {renderInfoCard(
                        "这个页面现在只保留真实可写配置",
                        "过去这里混入了不少并不存在于 gateway schema 的字段，保存后会报 INVALID_REQUEST。现在已收口为高级配置中心，只保留确认可写的少量字段。",
                        "日常使用请优先去 Agents / Models / Tools / Channels 等专门页面；这里更适合少量默认项和源码模式。",
                        "blue",
                      )}
                      {renderInfoCard(
                        "建议去专门控制台页修改的内容",
                        "Agents：代理身份、subagents、skills、tools profile；Models：默认模型 / fallback / thinking；Tools：web / media / exec 开关；Channels：微信/Discord/Telegram 等通道。",
                        "如果你不确定一个键是否合法，优先不要在这里新增，直接在源码模式确认当前 config.get 返回结构。",
                      )}
                    </>
                  )}
                  {activeSection === "agents" && (
                    <>
                      {renderField("默认模型", "agents.defaults.model", "string", "系统全局默认使用的 AI 模型 ID")}
                      {renderField("上下文窗口", "agents.defaults.contextTokens", "number", "单次对话允许注入的最大 Token 数")}
                      {renderField("推理等级", "agents.defaults.reasoningLevel", "string", "模型思考活跃度 (low/medium/high)")}
                      {renderField("图片模型", "agents.defaults.imageModel", "string", "用于图片理解/生成的默认模型")}
                      {renderInfoCard("多智能体模式已移除", "agents.multiAgent 不是当前 gateway 认可的配置键，协作能力由 agents.list / subagents / sessions 工具链决定。", "如果要控制多 Agent 行为，请到 Agents Console 配置 subagents.allowAgents、model 和 maxConcurrent。")}
                    </>
                  )}
                  {activeSection === "gateway" && (
                    <>
                      {renderField("监听端口", "gateway.port", "number", "网关服务运行的 TCP 端口 (1-65535)")}
                      {renderField("启用穿透", "gateway.tunnel.enabled", "boolean", "是否开启 Built-in 域名穿透服务")}
                      {renderField("穿透前缀", "gateway.tunnel.subdomain", "string", "分配的二级域名子域")}
                      {renderInfoCard("鉴权和通道已移出这里", "gateway.auth.* 与 channels.* 结构在不同部署中差异较大，不再放在这个表单页里，避免误写导致 config.apply 失败。", "需要调整时请使用专门页面，或切到源码模式手动编辑。")}
                    </>
                  )}
                  {activeSection === "logging" && (
                    <>
                      {renderField("日志等级", "logging.level", "string", "系统输出等级 (trace/debug/info/warn/error)")}
                      {renderField("保存到文件", "logging.toFile", "boolean", "是否在 data/logs 中持久化存储")}
                      {renderField("染色输出", "logging.colors", "boolean", "控制台日志是否显示 ANSI 颜色")}
                    </>
                  )}
                  {activeSection === "skills" && (
                    <>
                      {renderField("工作区路径", "skills.workspaceDir", "string", "自定义扩展插件的扫描根目录")}
                      {renderField("核心隔离自启", "skills.isolated", "boolean", "是否将关键技能运行在沙箱容器中")}
                      {renderInfoCard("UI 偏好和动画不在这里配置", "ui.darkMode / ui.compact / ui.animations 这类前端偏好不会被 gateway 识别，因此已完全从表单页移除。", "如果后面要做主题/动画设置，应该落到本地设置或账户设置，而不是写入 gateway config。")}
                    </>
                  )}
                </div>

                <div className="mt-12 p-8 rounded-3xl border border-dashed border-border/50 flex flex-col items-center text-center space-y-4 opacity-40 hover:opacity-100 transition-opacity">
                  <FileJson className="size-8 text-muted-foreground stroke-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">需要配置更深层的参数？</p>
                    <p className="text-xs text-muted-foreground italic">表单仅展示常用项，您可以切换到“源码模式”解锁 100% 的配置权限。</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setMode("raw")} className="rounded-xl">
                    进入源码编辑
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
