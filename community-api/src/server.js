import http from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { randomUUID } from "node:crypto";
import Busboy from "busboy";
import {
  createPost,
  createReply,
  deletePost,
  deleteReply,
  getPost,
  listPosts,
  listReplies,
  resetDb,
  togglePostLike,
  toggleReplyLike,
} from "./store.js";

const PORT = Number(process.env.PORT || 1598);
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, "..", "data", "attachments");
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "audio/", "video/"];
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

function sanitizeSegment(value, fallback = "main") {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized || fallback;
}

function sanitizeFileName(fileName) {
  return basename(String(fileName || "attachment")).replace(/[^a-zA-Z0-9._\u4e00-\u9fa5-]/g, "_");
}

function detectKind(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function isAllowedMimeType(mimeType) {
  if (!mimeType) return false;
  if (ALLOWED_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true;
  return ALLOWED_EXACT_TYPES.has(mimeType);
}

function ensureUploadDir(targetDir) {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
}

function sendFile(res, filePath, mimeType) {
  res.writeHead(200, {
    "Content-Type": mimeType || "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(res);
}

async function readMultipart(req) {
  return await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE, files: 1 } });
    const fields = {};
    let upload = null;
    let writePromise = null;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, file, info) => {
      if (name !== "file") {
        file.resume();
        return;
      }

      const safeName = sanitizeFileName(info.filename);
      const mimeType = info.mimeType || "application/octet-stream";
      if (!isAllowedMimeType(mimeType)) {
        file.resume();
        reject(new Error(`暂不支持该文件类型：${mimeType}`));
        return;
      }

      const sessionSegment = sanitizeSegment(fields.sessionKey, "main");
      const attachmentId = randomUUID();
      const extension = extname(safeName);
      const targetDir = join(UPLOAD_DIR, sessionSegment);
      ensureUploadDir(targetDir);
      const targetName = `${attachmentId}${extension}`;
      const targetPath = join(targetDir, targetName);
      const writer = createWriteStream(targetPath);
      let size = 0;
      let limitExceeded = false;

      file.on("data", (chunk) => {
        size += chunk.length;
      });

      file.on("limit", () => {
        limitExceeded = true;
        writer.destroy();
        void rm(targetPath, { force: true }).catch(() => {});
        reject(new Error("附件超过 20MB 限制"));
      });

      writePromise = new Promise((resolveWrite, rejectWrite) => {
        writer.on("finish", resolveWrite);
        writer.on("error", rejectWrite);
      });

      file.pipe(writer);
      upload = {
        id: attachmentId,
        kind: detectKind(mimeType),
        name: safeName,
        mimeType,
        size,
        url: `/api/chat/attachments/${encodeURIComponent(sessionSegment)}/${encodeURIComponent(targetName)}`,
        targetPath,
        sessionSegment,
        get limitExceeded() {
          return limitExceeded;
        },
      };
    });

    busboy.on("error", reject);
    busboy.on("finish", async () => {
      try {
        if (!upload) {
          reject(new Error("缺少附件文件"));
          return;
        }
        if (writePromise) {
          await writePromise;
        }
        const fileStat = await stat(upload.targetPath);
        upload.size = fileStat.size;
        resolve({ fields, upload });
      } catch (error) {
        reject(error);
      }
    });

    req.pipe(busboy);
  });
}

function buildAbsoluteUrl(req, relativePath) {
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  return `${protocol}://${host}${relativePath}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("请求体不是有效的 JSON");
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendError(res, 400, "无效请求");
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;

  try {
    const attachmentFileMatch = pathname.match(/^\/api\/chat\/attachments\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && attachmentFileMatch) {
      const sessionSegment = sanitizeSegment(decodeURIComponent(attachmentFileMatch[1]));
      const fileName = sanitizeFileName(decodeURIComponent(attachmentFileMatch[2]));
      const targetPath = join(UPLOAD_DIR, sessionSegment, fileName);
      try {
        await stat(targetPath);
      } catch {
        sendError(res, 404, "附件不存在");
        return;
      }
      const mimeType = extname(fileName).toLowerCase() === ".pdf" ? "application/pdf" : undefined;
      sendFile(res, targetPath, mimeType);
      return;
    }

    if (req.method === "POST" && pathname === "/api/chat/attachments") {
      const contentType = String(req.headers["content-type"] || "");
      if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
        sendError(res, 415, "附件上传必须使用 multipart/form-data");
        return;
      }
      const { fields, upload } = await readMultipart(req);
      const durationMs = fields.durationMs ? Number(fields.durationMs) : undefined;
      sendJson(res, 201, {
        attachment: {
          id: upload.id,
          kind: upload.kind,
          name: upload.name,
          mimeType: upload.mimeType,
          size: upload.size,
          url: buildAbsoluteUrl(req, upload.url),
          durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
        },
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/forum/posts") {
      const data = listPosts({
        q: searchParams.get("q") || "",
        sort: searchParams.get("sort") || "latest",
        page: searchParams.get("page") || 1,
        pageSize: searchParams.get("pageSize") || 20,
        viewerId: searchParams.get("viewerId") || "",
      });
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && pathname === "/api/forum/posts") {
      const body = await readBody(req);
      const post = createPost(body);
      sendJson(res, 201, post);
      return;
    }

    const postMatch = pathname.match(/^\/api\/forum\/posts\/([^/]+)$/);
    if (req.method === "GET" && postMatch) {
      const postId = decodeURIComponent(postMatch[1]);
      const post = getPost(postId, searchParams.get("viewerId") || "");
      if (!post) {
        sendError(res, 404, "帖子不存在");
        return;
      }
      sendJson(res, 200, post);
      return;
    }

    const repliesMatch = pathname.match(/^\/api\/forum\/posts\/([^/]+)\/replies$/);
    if (req.method === "GET" && repliesMatch) {
      const postId = decodeURIComponent(repliesMatch[1]);
      const data = listReplies(postId, {
        page: searchParams.get("page") || 1,
        pageSize: searchParams.get("pageSize") || 50,
        viewerId: searchParams.get("viewerId") || "",
      });
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && repliesMatch) {
      const postId = decodeURIComponent(repliesMatch[1]);
      const body = await readBody(req);
      const reply = createReply(postId, body);
      sendJson(res, 201, reply);
      return;
    }

    const postLikeMatch = pathname.match(/^\/api\/forum\/posts\/([^/]+)\/like-toggle$/);
    if (req.method === "POST" && postLikeMatch) {
      const postId = decodeURIComponent(postLikeMatch[1]);
      const body = await readBody(req);
      const result = togglePostLike(postId, body.viewerId);
      sendJson(res, 200, result);
      return;
    }

    const replyLikeMatch = pathname.match(/^\/api\/forum\/replies\/([^/]+)\/like-toggle$/);
    if (req.method === "POST" && replyLikeMatch) {
      const replyId = decodeURIComponent(replyLikeMatch[1]);
      const body = await readBody(req);
      const result = toggleReplyLike(replyId, body.viewerId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "DELETE" && postMatch) {
      const postId = decodeURIComponent(postMatch[1]);
      const authHeader = req.headers["authorization"] || "";
      if (authHeader !== "Bearer openclaw-admin") {
        sendError(res, 403, "无权限执行此操作");
        return;
      }
      try {
        const result = deletePost(postId);
        sendJson(res, 200, result);
      } catch (err) {
        sendError(res, 400, err instanceof Error ? err.message : "删除失败");
      }
      return;
    }

    const replyDeleteMatch = pathname.match(/^\/api\/forum\/replies\/([^/]+)$/);
    if (req.method === "DELETE" && replyDeleteMatch) {
      const replyId = decodeURIComponent(replyDeleteMatch[1]);
      const authHeader = req.headers["authorization"] || "";
      if (authHeader !== "Bearer openclaw-admin") {
        sendError(res, 403, "无权限执行此操作");
        return;
      }
      try {
        const result = deleteReply(replyId);
        sendJson(res, 200, result);
      } catch (err) {
        sendError(res, 400, err instanceof Error ? err.message : "删除失败");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/forum/admin/reset") {
      const authHeader = req.headers["authorization"] || "";
      if (authHeader !== "Bearer openclaw-admin") {
        sendError(res, 403, "无权限执行此操作");
        return;
      }
      try {
        const result = resetDb();
        sendJson(res, 200, result);
      } catch {
        sendError(res, 500, "重置失败");
      }
      return;
    }

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "community-api" });
      return;
    }

    sendError(res, 404, "接口不存在");
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "请求失败");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[community-api] listening on http://${HOST}:${PORT}`);
});
