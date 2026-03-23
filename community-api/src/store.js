import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_FILE = join(DATA_DIR, "forum-db.json");

function seedDb() {
  const now = new Date().toISOString();
  const seedPostId = randomUUID();
  const seedReplyId = randomUUID();
  return {
    posts: [
      {
        id: seedPostId,
        title: "欢迎来到 OpenClaw 社区",
        content: "这里可以交流插件、部署、节点、渠道和使用经验。欢迎发帖提问。",
        authorId: "system",
        authorName: "OpenClaw",
        authorAvatar: null,
        likeCount: 1,
        replyCount: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    replies: [
      {
        id: seedReplyId,
        postId: seedPostId,
        content: "这是社区的第一条回复，后续可以继续在这里交流。",
        authorId: "system",
        authorName: "OpenClaw",
        authorAvatar: null,
        likeCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    postLikes: [
      {
        id: randomUUID(),
        postId: seedPostId,
        userId: "system",
        createdAt: now,
      },
    ],
    replyLikes: [],
  };
}

function ensureDb() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify(seedDb(), null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function paginate(items, page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 20));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    },
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function enrichPost(post, db, viewerId) {
  return {
    ...post,
    isLikedByMe: viewerId
      ? db.postLikes.some((like) => like.postId === post.id && like.userId === viewerId)
      : false,
  };
}

function enrichReply(reply, db, viewerId) {
  return {
    ...reply,
    isLikedByMe: viewerId
      ? db.replyLikes.some((like) => like.replyId === reply.id && like.userId === viewerId)
      : false,
  };
}

export function listPosts({ q = "", sort = "latest", page = 1, pageSize = 20, viewerId = "" }) {
  const db = readDb();
  const query = normalizeText(q).toLowerCase();

  const filtered = db.posts.filter((post) => {
    if (!query) return true;
    return (
      post.title.toLowerCase().includes(query) ||
      post.content.toLowerCase().includes(query) ||
      post.authorName.toLowerCase().includes(query)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "hot") {
      if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
      if (b.replyCount !== a.replyCount) return b.replyCount - a.replyCount;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const paged = paginate(sorted.map((post) => enrichPost(post, db, viewerId)), page, pageSize);
  return paged;
}

export function getPost(postId, viewerId = "") {
  const db = readDb();
  const post = db.posts.find((item) => item.id === postId);
  if (!post) return null;
  return enrichPost(post, db, viewerId);
}

export function listReplies(postId, { page = 1, pageSize = 50, viewerId = "" } = {}) {
  const db = readDb();
  const replies = db.replies
    .filter((reply) => reply.postId === postId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((reply) => enrichReply(reply, db, viewerId));
  return paginate(replies, page, pageSize);
}

export function createPost({ title, content, authorId, authorName, authorAvatar = null }) {
  const safeTitle = normalizeText(title);
  const safeContent = normalizeText(content);
  const safeAuthorId = normalizeText(authorId) || "guest";
  const safeAuthorName = normalizeText(authorName) || "访客";

  if (safeTitle.length < 2 || safeTitle.length > 100) {
    throw new Error("帖子标题长度需要在 2 到 100 个字符之间");
  }
  if (safeContent.length < 5 || safeContent.length > 5000) {
    throw new Error("帖子内容长度需要在 5 到 5000 个字符之间");
  }

  const db = readDb();
  const now = new Date().toISOString();
  const post = {
    id: randomUUID(),
    title: safeTitle,
    content: safeContent,
    authorId: safeAuthorId,
    authorName: safeAuthorName,
    authorAvatar: authorAvatar || null,
    likeCount: 0,
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.posts.push(post);
  writeDb(db);
  return enrichPost(post, db, safeAuthorId);
}

export function createReply(postId, { content, authorId, authorName, authorAvatar = null }) {
  const safeContent = normalizeText(content);
  const safeAuthorId = normalizeText(authorId) || "guest";
  const safeAuthorName = normalizeText(authorName) || "访客";

  if (safeContent.length < 2 || safeContent.length > 2000) {
    throw new Error("回复内容长度需要在 2 到 2000 个字符之间");
  }

  const db = readDb();
  const post = db.posts.find((item) => item.id === postId);
  if (!post) {
    throw new Error("帖子不存在");
  }

  const now = new Date().toISOString();
  const reply = {
    id: randomUUID(),
    postId,
    content: safeContent,
    authorId: safeAuthorId,
    authorName: safeAuthorName,
    authorAvatar: authorAvatar || null,
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.replies.push(reply);
  post.replyCount += 1;
  post.updatedAt = now;
  writeDb(db);
  return enrichReply(reply, db, safeAuthorId);
}

export function togglePostLike(postId, viewerId) {
  const safeViewerId = normalizeText(viewerId);
  if (!safeViewerId) {
    throw new Error("viewerId 不能为空");
  }

  const db = readDb();
  const post = db.posts.find((item) => item.id === postId);
  if (!post) {
    throw new Error("帖子不存在");
  }

  const existingIndex = db.postLikes.findIndex(
    (like) => like.postId === postId && like.userId === safeViewerId
  );

  let liked = false;
  if (existingIndex >= 0) {
    db.postLikes.splice(existingIndex, 1);
    post.likeCount = Math.max(0, post.likeCount - 1);
    liked = false;
  } else {
    db.postLikes.push({
      id: randomUUID(),
      postId,
      userId: safeViewerId,
      createdAt: new Date().toISOString(),
    });
    post.likeCount += 1;
    liked = true;
  }

  post.updatedAt = new Date().toISOString();
  writeDb(db);
  return { liked, likeCount: post.likeCount };
}

export function toggleReplyLike(replyId, viewerId) {
  const safeViewerId = normalizeText(viewerId);
  if (!safeViewerId) {
    throw new Error("viewerId 不能为空");
  }

  const db = readDb();
  const reply = db.replies.find((item) => item.id === replyId);
  if (!reply) {
    throw new Error("回复不存在");
  }

  const existingIndex = db.replyLikes.findIndex(
    (like) => like.replyId === replyId && like.userId === safeViewerId
  );

  let liked = false;
  if (existingIndex >= 0) {
    db.replyLikes.splice(existingIndex, 1);
    reply.likeCount = Math.max(0, reply.likeCount - 1);
    liked = false;
  } else {
    db.replyLikes.push({
      id: randomUUID(),
      replyId,
      userId: safeViewerId,
      createdAt: new Date().toISOString(),
    });
    reply.likeCount += 1;
    liked = true;
  }

  writeDb(db);
  return { liked, likeCount: reply.likeCount };
}

export function deletePost(postId) {
  const db = readDb();
  const postIndex = db.posts.findIndex((item) => item.id === postId);
  if (postIndex < 0) {
    throw new Error("帖子不存在");
  }

  db.posts.splice(postIndex, 1);
  const removedReplyIds = db.replies
    .filter((reply) => reply.postId === postId)
    .map((reply) => reply.id);
  db.replies = db.replies.filter((reply) => reply.postId !== postId);
  db.postLikes = db.postLikes.filter((like) => like.postId !== postId);
  db.replyLikes = db.replyLikes.filter((like) => !removedReplyIds.includes(like.replyId));
  writeDb(db);
  return { ok: true };
}

export function deleteReply(replyId) {
  const db = readDb();
  const replyIndex = db.replies.findIndex((item) => item.id === replyId);
  if (replyIndex < 0) {
    throw new Error("回复不存在");
  }

  const [reply] = db.replies.splice(replyIndex, 1);
  db.replyLikes = db.replyLikes.filter((like) => like.replyId !== replyId);

  const post = db.posts.find((item) => item.id === reply.postId);
  if (post) {
    post.replyCount = Math.max(0, post.replyCount - 1);
    post.updatedAt = new Date().toISOString();
  }

  writeDb(db);
  return { ok: true };
}

export function resetDb() {
  const seeded = seedDb();
  writeDb(seeded);
  return {
    ok: true,
    postCount: seeded.posts.length,
    replyCount: seeded.replies.length,
  };
}
