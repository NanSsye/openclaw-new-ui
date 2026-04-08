"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, ImageIcon, Play, RefreshCw, Save, Sparkles } from "lucide-react";
import {
  type GatewayConfigResponse,
  type ModelsListResponse,
  cloneConfig,
  getConfigRoot,
  getRuntimeModelSettings,
  setRuntimeModelSettings,
  toJson,
} from "@/lib/openclaw/console-config";

export default function ModelsPage() {
  const { client, connected } = useGateway();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [configRoot, setConfigRoot] = useState<Record<string, unknown>>({});
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [fallbackModels, setFallbackModels] = useState("");
  const [thinkingDefault, setThinkingDefault] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [initialJson, setInitialJson] = useState("");

  const fetchData = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    try {
      const [configRes, modelsRes] = await Promise.all([
        client.request<GatewayConfigResponse>("config.get", {}),
        client.request<ModelsListResponse>("models.list", {}),
      ]);
      const root = cloneConfig(getConfigRoot(configRes));
      const runtime = getRuntimeModelSettings(root);
      setConfigRoot(root);
      setHash(configRes.hash ?? null);
      setDefaultModel(runtime.defaultModel);
      setFallbackModels(runtime.fallbackModels.join("\n"));
      setThinkingDefault(runtime.thinkingDefault);
      setImageModel(runtime.imageModel);
      setModels((modelsRes.models || []).map((item) => item.id).filter(Boolean));
      setInitialJson(
        JSON.stringify(
          {
            defaultModel: runtime.defaultModel,
            fallbackModels: runtime.fallbackModels,
            thinkingDefault: runtime.thinkingDefault,
            imageModel: runtime.imageModel,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      toast({ title: "加载模型设置失败", description: error instanceof Error ? error.message : "无法读取模型配置", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client, connected, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const preview = useMemo(
    () =>
      JSON.stringify(
        {
          defaultModel,
          fallbackModels: fallbackModels.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
          thinkingDefault,
          imageModel,
        },
        null,
        2,
      ),
    [defaultModel, fallbackModels, thinkingDefault, imageModel],
  );

  const isDirty = preview !== initialJson;

  const persist = useCallback(
    async (apply = false) => {
      if (!client || !connected) return;
      const nextRoot = cloneConfig(configRoot);
      setRuntimeModelSettings(nextRoot, {
        defaultModel: defaultModel.trim(),
        fallbackModels: fallbackModels.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        thinkingDefault: thinkingDefault.trim(),
        imageModel: imageModel.trim(),
      });

      if (apply) setApplying(true);
      else setSaving(true);
      try {
        await client.request(apply ? "config.apply" : "config.set", {
          raw: toJson(nextRoot),
          baseHash: hash ?? "",
          ...(apply ? { sessionKey: "models-console" } : {}),
        });
        toast({ title: apply ? "模型设置已应用" : "模型设置已保存", description: apply ? "Gateway 已重新加载默认模型与思考策略。" : "默认模型配置已写入网关。" });
        await fetchData();
      } catch (error) {
        toast({ title: apply ? "应用失败" : "保存失败", description: error instanceof Error ? error.message : "模型配置更新失败", variant: "destructive" });
      } finally {
        setApplying(false);
        setSaving(false);
      }
    },
    [client, configRoot, connected, defaultModel, fallbackModels, fetchData, hash, imageModel, thinkingDefault, toast],
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/5 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
              <BrainCircuit className="size-3.5" /> Models Console
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">模型控制台</h1>
              <p className="text-sm text-muted-foreground">集中管理默认模型、Fallback 列表、思考等级与图片模型，让常用 runtime 设置不必再埋在 config JSON 里。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> 刷新</Button>
            <Button variant="outline" onClick={() => persist(false)} disabled={!isDirty || saving} className="border-orange-500/20 text-orange-600 hover:bg-orange-500/5"><Save className="size-4" /> 保存</Button>
            <Button onClick={() => persist(true)} disabled={!isDirty || applying} className="bg-emerald-600 text-white hover:bg-emerald-700"><Play className="size-4" /> 应用</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
          <Card className="border-border/50 bg-background/80">
            <CardHeader>
              <CardTitle>Runtime 模型设置</CardTitle>
              <CardDescription>优先处理参考项目里最常编辑的四个字段：默认模型、Fallback、Thinking 和图片模型。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Default Model">
                <Input list="model-console-options" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder="例如 openai/gpt-5.4" />
              </Field>
              <Field label="Fallback Models (每行一个)">
                <textarea value={fallbackModels} onChange={(event) => setFallbackModels(event.target.value)} className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder={"例如\nopenai/gpt-5.4-mini\nanthropic/claude-3.7-sonnet"} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Thinking Default">
                  <Input value={thinkingDefault} onChange={(event) => setThinkingDefault(event.target.value)} placeholder="例如 low / medium / high" />
                </Field>
                <Field label="Image Model">
                  <Input list="model-console-options" value={imageModel} onChange={(event) => setImageModel(event.target.value)} placeholder="例如 google/gemini-2.0-flash-exp" />
                </Field>
              </div>

              <datalist id="model-console-options">
                {models.map((item) => <option key={item} value={item} />)}
              </datalist>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/50 bg-background/80">
              <CardHeader>
                <CardTitle className="text-lg">可用模型</CardTitle>
                <CardDescription>点击下方 chip 可以快速填入默认模型或图片模型。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {models.length === 0 ? <Badge variant="outline">尚未读取到 models.list</Badge> : models.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDefaultModel(item)}
                    className="transition-transform hover:scale-[1.02]"
                  >
                    <Badge variant="outline" className="cursor-pointer">{item}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-background/80">
              <CardHeader>
                <CardTitle className="text-lg">当前预览</CardTitle>
                <CardDescription>保存前先看一下最终会写入什么，避免和高级配置互相覆盖。</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-3xl border border-border/50 bg-muted/10 p-4 font-mono text-xs leading-relaxed text-muted-foreground">{preview}</pre>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric icon={Sparkles} label="Fallback 数量" value={String(fallbackModels.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).length)} />
              <SmallMetric icon={ImageIcon} label="Image Model" value={imageModel || "未配置"} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function SmallMetric({ icon: Icon, label, value }: { icon: typeof BrainCircuit; label: string; value: string }) {
  return (
    <Card className="border-border/50 bg-background/80">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon className="size-4" /></div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
