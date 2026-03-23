import http from "node:http";
import { URL } from "node:url";
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
