import { NextRequest, NextResponse } from "next/server";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "audio/"];
const ALLOWED_EXACT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function sanitizeFileName(fileName: string) {
  const base = path.basename(fileName || "attachment");
  return base.replace(/[^a-zA-Z0-9._-\u4e00-\u9fa5]/g, "_");
}

function detectKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

function isAllowedMimeType(mimeType: string) {
  if (!mimeType) return false;
  if (ALLOWED_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true;
  return ALLOWED_EXACT_TYPES.has(mimeType);
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function fileExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const uploaded = formData.get("file");
    const sessionKey = String(formData.get("sessionKey") || "main");
    const durationRaw = formData.get("durationMs");

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: "缺少附件文件" }, { status: 400 });
    }

    if (uploaded.size <= 0) {
      return NextResponse.json({ error: "附件内容为空" }, { status: 400 });
    }

    if (uploaded.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "附件超过 20MB 限制" }, { status: 413 });
    }

    const mimeType = uploaded.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ error: `暂不支持该文件类型：${mimeType}` }, { status: 415 });
    }

    const attachmentId = randomUUID();
    const safeName = sanitizeFileName(uploaded.name || "attachment");
    const ext = path.extname(safeName);
    const sessionSegment = sessionKey.replace(/[^a-zA-Z0-9._-]/g, "_") || "main";
    const targetDir = path.join(process.cwd(), "public", "chat-attachments", sessionSegment);
    const fileName = `${attachmentId}${ext}`;
    const targetPath = path.join(targetDir, fileName);

    await ensureDir(targetDir);
    if (await fileExists(targetPath)) {
      return NextResponse.json({ error: "附件 ID 冲突，请重试" }, { status: 409 });
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer());
    await writeFile(targetPath, buffer);

    const durationMs = durationRaw ? Number(durationRaw) : undefined;
    const kind = detectKind(mimeType);
    const attachment = {
      id: attachmentId,
      kind,
      name: safeName,
      mimeType,
      size: uploaded.size,
      url: `/chat-attachments/${encodeURIComponent(sessionSegment)}/${encodeURIComponent(fileName)}`,
      durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
    };

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "附件上传失败" },
      { status: 500 },
    );
  }
}
