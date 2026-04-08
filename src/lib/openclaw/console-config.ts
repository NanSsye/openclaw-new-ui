export type ConsoleConfigRecord = Record<string, unknown>;

export type GatewayConfigResponse = {
  hash?: string;
  raw?: string;
  config?: ConsoleConfigRecord;
  parsed?: ConsoleConfigRecord;
  [key: string]: unknown;
};

export type ModelConfigValue = string | {
  primary?: string;
  fallbacks?: string[];
  [key: string]: unknown;
};

export type AgentConsoleItem = {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: ModelConfigValue;
  memory?: string | {
    prompt?: string;
    context?: string;
    notes?: string;
    [key: string]: unknown;
  };
  tools?: {
    profile?: string;
    alsoAllow?: string[];
    [key: string]: unknown;
  };
  skills?: string[];
  identity?: {
    name?: string;
    emoji?: string;
    vibe?: string;
    [key: string]: unknown;
  };
  subagents?: {
    allowAgents?: string[];
    model?: string;
    thinking?: string;
    maxConcurrent?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ConsoleModelItem = {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  [key: string]: unknown;
};

export type ModelsListResponse = {
  models?: ConsoleModelItem[];
};

export type ToolsCatalogResponse = {
  profiles?: Record<string, unknown>;
  groups?: Array<{ name?: string; label?: string; tools?: unknown[]; [key: string]: unknown }>;
  tools?: unknown[];
  [key: string]: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

export function getConfigRoot(response: GatewayConfigResponse | null | undefined): ConsoleConfigRecord {
  if (!response) return {};
  if (isRecord(response.config)) return response.config;
  if (isRecord(response.parsed)) return response.parsed;
  return isRecord(response) ? response : {};
}

export function getAgentsList(root: ConsoleConfigRecord): AgentConsoleItem[] {
  const agents = isRecord(root.agents) ? root.agents : {};
  return Array.isArray(agents.list) ? (agents.list as AgentConsoleItem[]) : [];
}

export function setAgentsList(root: ConsoleConfigRecord, nextList: AgentConsoleItem[]) {
  const agents = isRecord(root.agents) ? cloneConfig(root.agents) : {};
  agents.list = nextList;
  root.agents = agents;
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function getPrimaryModel(model: unknown): string {
  if (typeof model === "string") return model;
  if (isRecord(model) && typeof model.primary === "string") return model.primary;
  return "";
}

export function getFallbackModels(model: unknown): string[] {
  if (isRecord(model)) return normalizeStringArray(model.fallbacks);
  return [];
}

export function setModelValue(agent: AgentConsoleItem, primary: string, fallbacks: string[]) {
  if (!primary && fallbacks.length === 0) {
    delete agent.model;
    return;
  }
  if (fallbacks.length === 0) {
    agent.model = primary;
    return;
  }
  const current = isRecord(agent.model) ? cloneConfig(agent.model) : {};
  current.primary = primary;
  current.fallbacks = fallbacks;
  agent.model = current;
}

export function getCatalogProfiles(catalog: ToolsCatalogResponse | null): string[] {
  if (!catalog || !isRecord(catalog.profiles)) return [];
  return Object.keys(catalog.profiles).sort();
}

export function getCatalogToolIds(catalog: ToolsCatalogResponse | null): string[] {
  const seen = new Set<string>();
  const pushTool = (tool: unknown) => {
    if (typeof tool === "string" && tool.trim()) seen.add(tool.trim());
    if (isRecord(tool)) {
      const id = [tool.id, tool.name, tool.key].find((value) => typeof value === "string" && value.trim()) as string | undefined;
      if (id) seen.add(id.trim());
    }
  };

  (catalog?.groups || []).forEach((group) => {
    const tools = Array.isArray(group.tools) ? group.tools : [];
    tools.forEach(pushTool);
  });
  (Array.isArray(catalog?.tools) ? catalog.tools : []).forEach(pushTool);
  return Array.from(seen).sort();
}

export function getToolSettings(config: ConsoleConfigRecord) {
  const tools = isRecord(config.tools) ? cloneConfig(config.tools) : {};
  const web = isRecord(tools.web) ? cloneConfig(tools.web) : {};
  const media = isRecord(tools.media) ? cloneConfig(tools.media) : {};
  const exec = isRecord(tools.exec) ? cloneConfig(tools.exec) : {};

  return {
    webSearchEnabled: web.search !== false,
    webFetchEnabled: web.fetch !== false,
    linksEnabled: web.links !== false,
    mediaImageEnabled: media.image !== false,
    mediaAudioEnabled: media.audio !== false,
    mediaVideoEnabled: media.video !== false,
    execSecurity: typeof exec.security === "string" ? exec.security : "deny",
    execAsk: typeof exec.ask === "string" ? exec.ask : "on-miss",
  };
}

export function setToolSettings(config: ConsoleConfigRecord, next: {
  webSearchEnabled: boolean;
  webFetchEnabled: boolean;
  linksEnabled: boolean;
  mediaImageEnabled: boolean;
  mediaAudioEnabled: boolean;
  mediaVideoEnabled: boolean;
  execSecurity: string;
  execAsk: string;
}) {
  const tools = isRecord(config.tools) ? cloneConfig(config.tools) : {};
  const web = isRecord(tools.web) ? cloneConfig(tools.web) : {};
  const media = isRecord(tools.media) ? cloneConfig(tools.media) : {};
  const exec = isRecord(tools.exec) ? cloneConfig(tools.exec) : {};

  web.search = next.webSearchEnabled;
  web.fetch = next.webFetchEnabled;
  web.links = next.linksEnabled;
  media.image = next.mediaImageEnabled;
  media.audio = next.mediaAudioEnabled;
  media.video = next.mediaVideoEnabled;
  exec.security = next.execSecurity;
  exec.ask = next.execAsk;

  tools.web = web;
  tools.media = media;
  tools.exec = exec;
  config.tools = tools;
}

export function getRuntimeModelSettings(config: ConsoleConfigRecord) {
  const agents = isRecord(config.agents) ? config.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const modelValue = defaults.model;
  return {
    defaultModel: getPrimaryModel(modelValue),
    fallbackModels: getFallbackModels(modelValue),
    thinkingDefault: typeof defaults.thinking === "string"
      ? defaults.thinking
      : typeof defaults.reasoningLevel === "string"
        ? defaults.reasoningLevel
        : "",
    imageModel: typeof defaults.imageModel === "string" ? defaults.imageModel : "",
  };
}

export function setRuntimeModelSettings(config: ConsoleConfigRecord, next: {
  defaultModel: string;
  fallbackModels: string[];
  thinkingDefault: string;
  imageModel: string;
}) {
  const agents = isRecord(config.agents) ? cloneConfig(config.agents) : {};
  const defaults = isRecord(agents.defaults) ? cloneConfig(agents.defaults) : {};

  if (next.defaultModel || next.fallbackModels.length) {
    defaults.model = next.fallbackModels.length > 0
      ? { primary: next.defaultModel, fallbacks: next.fallbackModels }
      : next.defaultModel;
  } else {
    delete defaults.model;
  }

  if (next.thinkingDefault) defaults.thinking = next.thinkingDefault;
  else delete defaults.thinking;

  if (next.imageModel) defaults.imageModel = next.imageModel;
  else delete defaults.imageModel;

  agents.defaults = defaults;
  config.agents = agents;
}

export function toJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
