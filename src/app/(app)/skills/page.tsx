"use client";
import { useEffect, useState, useMemo } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Zap, RefreshCw, Search, Box, Info, AlertTriangle,
  CheckCircle2, Download, ShieldCheck, Key, ExternalLink,
  ChevronDown, ChevronUp, Store, Star, TrendingUp, ArrowRight, Loader2, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SkillMissing {
  bins?: string[];
  env?: string[];
  config?: string[];
}

interface SkillInstallOption {
  id: string;
}

interface Skill {
  skillKey: string;
  name: string;
  description?: string;
  source?: string;
  disabled?: boolean;
  bundled?: boolean;
  eligible?: boolean;
  blockedByAllowlist?: boolean;
  missing?: SkillMissing;
  install?: SkillInstallOption[];
  primaryEnv?: string;
  homepage?: string;
  emoji?: string;
}

interface SkillGroup {
  label: string;
  items: Skill[];
}

interface SkillsStatusResponse {
  skills?: Skill[];
}

interface SkillsInstallResponse {
  message?: string;
}

// ClawHub Market API types
interface MarketSkill {
  slug: string;
  displayName: string;
  summary: string;
  version: string | null;
  updatedAt: number;
  score: number;
}

interface MarketApiResponse {
  results: MarketSkill[];
}

// Featured Plugin API types
interface FeaturedPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  github_url: string;
  icon?: string;
  status: string;
  downloads: number;
  tags: { id: number; name: string }[];
  submit_time: string;
  update_time?: string;
}

interface FeaturedApiResponse {
  success: boolean;
  plugins: FeaturedPlugin[];
  error?: string;
}

export default function SkillsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SkillsStatusResponse | null>(null);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    "built-in": true,
    "workspace": false
  });

  // Market tab state
  const [marketSkills, setMarketSkills] = useState<MarketSkill[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [activeTab, setActiveTab] = useState("installed");
  const [marketSort, setMarketSort] = useState<"updated" | "downloads" | "stars" | "installs" | "newest" | "name">("updated");

  // Featured Plugin tab state
  const [featuredPlugins, setFeaturedPlugins] = useState<FeaturedPlugin[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    author: "",
    version: "",
    github_url: "",
    tags: ""
  });
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  const fetchFeaturedPlugins = async () => {
    setFeaturedLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_PLUGIN_MARKET_API || "https://xianan.xin:1563";
      const res = await fetch(`${apiUrl}/api/plugins/?status=approved`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json() as FeaturedApiResponse;
      if (data.success && data.plugins) {
        setFeaturedPlugins(data.plugins);
      } else {
        setFeaturedPlugins([]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        console.error("Featured plugins fetch timeout");
      } else {
        console.error("Failed to fetch featured plugins:", err);
      }
      setFeaturedPlugins([]);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadForm.name || !uploadForm.description || !uploadForm.author || !uploadForm.version || !uploadForm.github_url) {
      toast({ title: "请填写所有必填项", variant: "destructive" });
      return;
    }
    setUploadSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_PLUGIN_MARKET_API || "https://xianan.xin:1563";
      const formData = new FormData();
      formData.append("name", uploadForm.name);
      formData.append("description", uploadForm.description);
      formData.append("author", uploadForm.author);
      formData.append("version", uploadForm.version);
      formData.append("github_url", uploadForm.github_url);
      formData.append("tags", uploadForm.tags);

      const res = await fetch(`${apiUrl}/api/plugin-upload/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "上传成功", description: "插件已提交，等待审核" });
        setUploadOpen(false);
        setUploadForm({ name: "", description: "", author: "", version: "", github_url: "", tags: "" });
        fetchFeaturedPlugins();
      } else {
        toast({ title: "上传失败", description: data.error || "未知错误", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "上传失败", description: "网络错误", variant: "destructive" });
    } finally {
      setUploadSubmitting(false);
    }
  };

  const fetchMarketSkills = async () => {
    setMarketLoading(true);
    try {
      const query = marketSearch || "a";
      const url = `https://clawhub.ai/api/v1/search?q=${encodeURIComponent(query)}&limit=50`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await res.json();

      interface SkillsApiResponse {
        results: Array<{
          slug: string;
          displayName: string;
          summary?: string;
          version: string | null;
          updatedAt: number;
          score: number;
        }>;
      }

      const skillsData = data as SkillsApiResponse;
      const newSkills = (skillsData.results || []).map((item) => ({
        slug: item.slug,
        displayName: item.displayName,
        summary: item.summary || "",
        version: item.version,
        updatedAt: item.updatedAt,
        score: item.score,
      }));

      setMarketSkills(newSkills);
    } catch (err) {
      console.error("Failed to fetch market skills:", err);
      setMarketSkills([]);
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "market") {
      fetchMarketSkills();
    } else if (activeTab === "featured") {
      fetchFeaturedPlugins();
    }
  }, [activeTab, marketSort]);

  const fetchData = async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const res = await client.request("skills.status", {});
      setReport(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "加载技能失败", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [client, connected]);

  const skills = useMemo(() => {
    const list: Skill[] = report?.skills || [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((item: Skill) =>
      item.name.toLowerCase().includes(s) ||
      (item.description?.toLowerCase().includes(s) ?? false) ||
      item.skillKey.toLowerCase().includes(s)
    );
  }, [report, search]);

  const groups = useMemo(() => {
    const map: Record<string, SkillGroup> = {
      "workspace": { label: "工作区技能 (Workspace)", items: [] },
      "managed": { label: "托管技能 (Managed)", items: [] },
      "built-in": { label: "内置技能 (Built-in)", items: [] },
      "other": { label: "其他技能 (Other)", items: [] }
    };

    skills.forEach((skill: Skill) => {
      const source = skill.source || "";
      if (source.startsWith("workspace")) map["workspace"].items.push(skill);
      else if (source.startsWith("openclaw-managed")) map["managed"].items.push(skill);
      else if (source.startsWith("openclaw-bundled")) map["built-in"].items.push(skill);
      else map["other"].items.push(skill);
    });

    return Object.entries(map).filter(([_, group]) => group.items.length > 0);
  }, [skills]);

  const toggleSkill = async (skillKey: string, currentDisabled: boolean) => {
    if (!client) return;
    setBusyKey(skillKey);
    try {
      await client.request("skills.update", { skillKey, enabled: currentDisabled });
      toast({ title: currentDisabled ? "已开启该技能" : "已停用该技能" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "操作失败", description: message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const saveKey = async (skillKey: string) => {
    if (!client) return;
    const apiKey = edits[skillKey];
    if (apiKey === undefined) return;
    setBusyKey(skillKey);
    try {
      await client.request("skills.update", { skillKey, apiKey });
      toast({ title: "配置已保存", description: "API Key 已成功更新。" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "保存失败", description: message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const installSkill = async (skill: Skill) => {
    if (!client) return;
    const option = skill.install?.[0];
    if (!option) return;
    setBusyKey(skill.skillKey);
    try {
      const res: SkillsInstallResponse = await client.request("skills.install", {
        name: skill.name,
        installId: option.id,
        timeoutMs: 120000
      });
      toast({ title: "安装成功", description: res.message || "技能依赖已安装。" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      toast({ title: "安装失败", description: message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="p-3 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">扩展技能</h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs md:text-sm flex items-center gap-2 mt-0.5">
            <Zap className="size-3 md:size-4 text-yellow-500 shrink-0" />
            <span className="hidden md:inline">总览并调整当前所有开启的扩展插件及三方工具</span>
            <span className="md:hidden">管理扩展插件</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 rounded-lg text-xs self-start md:self-auto">
          <RefreshCw className={cn("size-3.5 md:size-4", loading && "animate-spin")} />
          <span className="hidden sm:inline">刷新</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1 border border-border/50 rounded-xl lg:rounded-2xl h-auto">
          <TabsTrigger value="installed" className="rounded-lg lg:rounded-xl px-3 lg:px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs lg:text-sm">
            <Zap className="size-3.5 lg:size-4 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">已安装</span>
            <span className="sm:hidden">已装</span>
          </TabsTrigger>
          <TabsTrigger value="market" className="rounded-lg lg:rounded-xl px-3 lg:px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs lg:text-sm">
            <Store className="size-3.5 lg:size-4 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">技能市场</span>
            <span className="sm:hidden">市场</span>
          </TabsTrigger>
          <TabsTrigger value="featured" className="rounded-lg lg:rounded-xl px-3 lg:px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs lg:text-sm">
            <Star className="size-3.5 lg:size-4 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">精选插件</span>
            <span className="sm:hidden">精选</span>
          </TabsTrigger>
        </TabsList>

        {/* Installed Tab */}
        <TabsContent value="installed" className="mt-4 md:mt-6">
          {/* Search for installed */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索已安装的技能..."
                className="pl-9 w-full bg-background/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            {groups.length === 0 && !loading && (
              <div className="p-8 md:p-12 text-center border-2 border-dashed rounded-xl lg:rounded-2xl bg-muted/20 opacity-60">
                <Zap className="size-10 md:size-12 mx-auto mb-3 md:mb-4 stroke-1" />
                <p className="text-sm">未找到符合条件的技能</p>
              </div>
            )}

            {groups.map(([id, group]) => (
              <div key={id} className="space-y-4">
                <button
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }))}
                  className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 hover:text-foreground transition-colors group"
                >
                  {collapsedGroups[id] ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
                  {group.label}
                  <span className="ml-2 bg-muted px-1.5 py-0.5 rounded text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">
                    {group.items.length}
                  </span>
                </button>

                {!collapsedGroups[id] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {group.items.map((skill: Skill) => (
                      <Card key={skill.skillKey} className="group relative overflow-hidden bg-background/50 border-border/50 hover:border-primary/30 transition-all duration-300">
                        <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{skill.emoji || "🧩"}</span>
                                <h3 className="font-bold text-base truncate">{skill.name}</h3>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                                {skill.description}
                              </p>
                            </div>
                            <Switch
                              checked={!skill.disabled}
                              onCheckedChange={(checked) => toggleSkill(skill.skillKey, skill.disabled ?? false)}
                              disabled={busyKey === skill.skillKey}
                              className="data-[state=checked]:bg-emerald-500 scale-90"
                            />
                          </div>

                          {/* Status Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {skill.disabled ? (
                              <Badge variant="secondary" className="opacity-70">已停用</Badge>
                            ) : (
                              <Badge variant="success">已启用</Badge>
                            )}
                            {skill.bundled && <Badge variant="outline" className="text-[10px]">内置</Badge>}
                            {skill.eligible === false && <Badge variant="warning" className="text-[10px]">不可用</Badge>}
                            {skill.blockedByAllowlist && <Badge variant="destructive" className="text-[10px]">限制访问</Badge>}
                          </div>

                          {/* Requirements / Missing */}
                          {((skill.missing?.bins?.length ?? 0) > 0 || (skill.missing?.env?.length ?? 0) > 0 || (skill.missing?.config?.length ?? 0) > 0) && (
                            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-2">
                              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-500 uppercase tracking-tight">
                                <AlertTriangle className="size-3" />
                                缺失配置或环境
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {skill.missing?.bins?.map((b: string) => <Badge key={b} variant="destructive" className="text-[9px] py-0 px-1.5">Bin: {b}</Badge>)}
                                {skill.missing?.env?.map((e: string) => <Badge key={e} variant="warning" className="text-[9px] py-0 px-1.5">ENV: {e}</Badge>)}
                                {skill.missing?.config?.map((c: string) => <Badge key={c} variant="destructive" className="text-[9px] py-0 px-1.5">Config: {c}</Badge>)}
                              </div>
                              {(skill.install?.length ?? 0) > 0 && (skill.missing?.bins?.length ?? 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[10px] gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-600"
                                  onClick={() => installSkill(skill)}
                                  disabled={busyKey === skill.skillKey}
                                >
                                  <Download className="size-3" />
                                  一键安装依赖
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Config Area (API Key) */}
                          {skill.primaryEnv && (
                            <div className="space-y-2 pt-2 border-t border-border/30">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                                  {skill.primaryEnv} (API Key)
                                </label>
                                {skill.homepage && (
                                  <a href={skill.homepage} target="_blank" rel="noreferrer" className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                                    获取 <ExternalLink className="size-2" />
                                  </a>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="password"
                                  placeholder="贴入密钥..."
                                  className="h-8 text-xs bg-muted/30"
                                  value={edits[skill.skillKey] ?? ""}
                                  onChange={(e) => setEdits(prev => ({ ...prev, [skill.skillKey]: e.target.value }))}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0"
                                  onClick={() => saveKey(skill.skillKey)}
                                  disabled={busyKey === skill.skillKey || edits[skill.skillKey] === undefined}
                                >
                                  <Key className="size-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Market Tab */}
        <TabsContent value="market" className="mt-4 md:mt-6">
          {/* Market Search & Sort */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索 ClawHub 技能..."
                className="pl-9 w-full bg-background/50"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchMarketSkills()}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchMarketSkills()}
              disabled={marketLoading}
              className="rounded-lg shrink-0"
            >
              <RefreshCw className={cn("size-4", marketLoading && "animate-spin")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
                  <span className="hidden sm:inline">
                    {marketSort === "downloads" ? "下载量" : marketSort === "stars" ? "星标" : marketSort === "updated" ? "最新更新" : marketSort === "newest" ? "最新创建" : marketSort === "name" ? "名称" : "最新更新"}
                  </span>
                  <span className="sm:hidden">排序</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setMarketSort("updated"); fetchMarketSkills(); }}>
                  最新更新
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMarketSort("newest"); fetchMarketSkills(); }}>
                  最新创建
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMarketSort("downloads"); fetchMarketSkills(); }}>
                  下载量
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMarketSort("stars"); fetchMarketSkills(); }}>
                  星标
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Market Skills Grid */}
          {marketLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : marketSkills.length === 0 ? (
            <div className="p-8 md:p-12 text-center border-2 border-dashed rounded-xl lg:rounded-2xl bg-muted/20 opacity-60">
              <Store className="size-10 md:size-12 mx-auto mb-3 md:mb-4 stroke-1" />
              <p className="text-sm">未找到技能，试试其他关键词</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {marketSkills.map((skill) => (
                <Card key={skill.slug} className="group relative overflow-hidden bg-background/50 border-border/50 hover:border-primary/30 transition-all duration-300">
                  <div className="p-3 md:p-4 lg:p-5 space-y-2 md:space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm md:text-base truncate mb-1">
                          {skill.displayName}
                        </h3>
                        <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate">
                          {skill.slug}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] md:text-[10px] shrink-0">
                        <Star className="size-2.5 mr-0.5" />
                        {skill.score.toFixed(1)}
                      </Badge>
                    </div>

                    {/* Summary */}
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 min-h-[32px] md:min-h-[40px]">
                      {skill.summary}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                        更新于 {new Date(skill.updatedAt).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 md:h-7 text-[10px] md:text-xs gap-1"
                        onClick={() => window.open(`https://clawhub.ai/skills/${skill.slug}`, "_blank")}
                      >
                        查看详情
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            )}
        </TabsContent>

        {/* Featured Tab */}
        <TabsContent value="featured" className="mt-4 md:mt-6">
          {/* Featured Search */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索精选插件..."
                className="pl-9 w-full bg-background/50"
                value={featuredSearch}
                onChange={(e) => setFeaturedSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchFeaturedPlugins()}
              disabled={featuredLoading}
              className="rounded-lg shrink-0"
            >
              <RefreshCw className={cn("size-4", featuredLoading && "animate-spin")} />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setUploadOpen(true)}
              className="gap-1.5 rounded-lg shrink-0"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">上传插件</span>
            </Button>
          </div>

          {/* Featured Plugins Grid */}
          {featuredLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : featuredPlugins.length === 0 ? (
            <div className="p-8 md:p-12 text-center border-2 border-dashed rounded-xl lg:rounded-2xl bg-muted/20 opacity-60">
              <Star className="size-10 md:size-12 mx-auto mb-3 md:mb-4 stroke-1" />
              <p className="text-sm">暂无精选插件</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {featuredPlugins
                .filter(p => !featuredSearch || p.name.toLowerCase().includes(featuredSearch.toLowerCase()))
                .map((plugin) => (
                <Card key={plugin.id} className="group relative overflow-hidden bg-background/50 border-border/50 hover:border-primary/30 transition-all duration-300">
                  <div className="p-3 md:p-4 lg:p-5 space-y-2 md:space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm md:text-base truncate mb-1">
                          {plugin.name}
                        </h3>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                          by {plugin.author}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] md:text-[10px] shrink-0">
                        v{plugin.version}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 min-h-[32px] md:min-h-[40px]">
                      {plugin.description}
                    </p>

                    {/* Tags */}
                    {plugin.tags && plugin.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {plugin.tags.slice(0, 3).map(tag => (
                          <Badge key={tag.id} variant="secondary" className="text-[8px] md:text-[9px] px-1.5 py-0">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground flex items-center gap-1">
                        <Download className="size-3" />
                        {plugin.downloads}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 md:h-7 text-[10px] md:text-xs gap-1"
                        onClick={() => window.open(plugin.github_url, "_blank")}
                      >
                        获取插件
                        <ExternalLink className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>上传插件</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium">插件名称 *</label>
                <Input
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入插件名称"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">插件描述 *</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="输入插件功能描述"
                  className="mt-1 w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">作者 *</label>
                <Input
                  value={uploadForm.author}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="输入插件作者"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">版本 *</label>
                <Input
                  value={uploadForm.version}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="例如: 1.0.0"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">GitHub URL *</label>
                <Input
                  value={uploadForm.github_url}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, github_url: e.target.value }))}
                  placeholder="例如: https://github.com/username/repo"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">标签 (用逗号分隔)</label>
                <Input
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="例如: 工具,聊天,AI"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadSubmitting}>
                取消
              </Button>
              <Button onClick={handleUploadSubmit} disabled={uploadSubmitting}>
                {uploadSubmitting ? "提交中..." : "提交"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
}
