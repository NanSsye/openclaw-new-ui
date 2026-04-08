export function normalizeToolPayload(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clip(text: string, max = 64): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function firstString(args: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function formatToolDisplayName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, "_");
  const lower = normalized.toLowerCase();
  if (lower === "exec" || lower === "bash") return "Command";
  if (lower === "read") return "Read file";
  if (lower === "write" || lower === "edit") return "Write file";
  if (lower === "process" || lower === "process_poll") return "Process status";
  if (lower === "web_search") return "Web Search";
  if (lower === "web_fetch") return "Web Fetch";
  if (lower === "browser") return "Browse";
  if (lower === "message") return "Message";
  if (lower === "read_file_output") return "File content";
  if (lower === "command_output") return "Command output";
  if (lower === "search_result") return "Search result";
  return normalized.replace(/[_-]+/g, " ");
}

export function formatToolOneLiner(name: string, rawArgs?: unknown): string {
  const base = formatToolDisplayName(name);
  if (!rawArgs || typeof rawArgs !== "object") return base;
  const args = rawArgs as Record<string, unknown>;
  const lower = name.trim().replace(/\s+/g, "_").toLowerCase();
  let detail: string | undefined;

  if (lower === "exec" || lower === "bash") detail = firstString(args, ["command"]);
  else if (lower === "read" || lower === "write" || lower === "edit") detail = firstString(args, ["path", "file_path", "file"]);
  else if (lower === "process" || lower === "process_poll") detail = firstString(args, ["pid", "name", "process", "query"]);
  else if (lower === "web_search") detail = firstString(args, ["query", "q"]);
  else if (lower === "web_fetch") detail = firstString(args, ["url"]);
  else detail = firstString(args, ["path", "file_path", "command", "query", "url", "action", "name"]);

  return detail ? `${base} ${clip(detail)}` : base;
}

export function formatToolDuration(ms?: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(/\.0$/, "")}s`;
  const m = Math.floor(s / 60);
  const remainS = Math.round(s % 60);
  return `${m}m${remainS}s`;
}

export function formatToolActivityLabel(name: string): string {
  const lower = name.trim().replace(/\s+/g, "_").toLowerCase();
  if (lower === "read" || lower === "read_file" || lower === "read_file_output") return "正在读取文件";
  if (lower === "write" || lower === "edit") return "正在写入文件";
  if (lower === "exec" || lower === "bash" || lower === "command_output") return "正在执行命令";
  if (lower === "process" || lower === "process_poll") return "正在等待进程结果";
  if (lower === "web_search" || lower === "search_result") return "正在搜索网页";
  if (lower === "web_fetch" || lower === "browser") return "正在抓取页面";
  if (lower.includes("image")) return "正在处理图片";
  if (lower.includes("audio")) return "正在处理音频";
  return "正在调用工具";
}
