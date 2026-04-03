"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { compareVersions } from "compare-versions";

const GITHUB_REPO = "NanSsye/openclaw-new-ui";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  body: string;
  published_at: string;
  assets?: GithubAsset[];
}

function extractSemverVersion(value: string | undefined | null): string | null {
  if (!value) return null;
  const normalized = String(value).trim();
  const match = normalized.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

export interface ReleaseInfo {
  version: string;
  tagName: string;
  body: string;
  publishedAt: string;
  apkUrl: string;
  fileSize: number;
}

export interface UpdateState {
  status: "idle" | "checking" | "available" | "no-update" | "downloading" | "ready" | "error";
  progress: number;
  release: ReleaseInfo | null;
  error: string | null;
}

export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    progress: 0,
    release: null,
    error: null,
  });
  const release = state.release;

  const getCurrentVersion = useCallback((): string => {
    // 从环境变量获取版本（在 next.config.js 中设置）
    if (typeof window !== "undefined") {
      return process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
    }
    return "0.1.0";
  }, []);

  const checkForUpdate = useCallback(async (): Promise<ReleaseInfo | null> => {
    setState(prev => ({ ...prev, status: "checking", error: null }));

    try {
      const response = await axios.get(GITHUB_API_URL, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        timeout: 10000,
      });

      const data = response.data as GithubRelease;
      const releaseVersion = extractSemverVersion(data.tag_name);

      if (!releaseVersion) {
        setState(prev => ({
          ...prev,
          status: "error",
          error: "最新 Release 的标签不是有效版本号，请使用 v主版本.次版本.修订号 格式，例如 v2026.4.3",
        }));
        return null;
      }

      // 查找 APK 资源
      const apkAsset = data.assets?.find((asset: GithubAsset) =>
        asset.name.endsWith(".apk")
      );

      if (!apkAsset) {
        setState(prev => ({
          ...prev,
          status: "no-update",
          error: "当前版本没有可用的 APK 文件",
        }));
        return null;
      }

      const releaseInfo: ReleaseInfo = {
        version: releaseVersion,
        tagName: data.tag_name || "",
        body: data.body || "暂无更新说明",
        publishedAt: data.published_at || "",
        apkUrl: apkAsset.browser_download_url || "",
        fileSize: apkAsset.size || 0,
      };

      const currentVersion = extractSemverVersion(getCurrentVersion()) || "0.0.0";
      const hasUpdate = compareVersions(releaseInfo.version, currentVersion) > 0;

      setState(prev => ({
        ...prev,
        status: hasUpdate ? "available" : "no-update",
        release: releaseInfo,
      }));

      return hasUpdate ? releaseInfo : null;
    } catch (error: unknown) {
      let errorMessage = "检查更新失败";

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          errorMessage = "API 请求次数超限，请稍后再试";
        } else if (error.response?.status === 404) {
          errorMessage = "未找到 releases";
        } else if (error.code === "ECONNABORTED") {
          errorMessage = "请求超时，请检查网络连接";
        }
      }

      setState(prev => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));

      return null;
    }
  }, [getCurrentVersion]);

  const downloadUpdate = useCallback(async () => {
    if (!release?.apkUrl) {
      setState(prev => ({ ...prev, error: "无下载链接" }));
      return;
    }

    setState(prev => ({ ...prev, status: "downloading", progress: 0 }));

    try {
      // 打开下载链接，浏览器会处理下载
      // 在 Capacitor 环境下会调用原生浏览器
      window.open(release.apkUrl, "_blank");
      setState(prev => ({ ...prev, status: "ready" }));
    } catch {
      setState(prev => ({
        ...prev,
        status: "error",
        error: "无法打开下载链接",
      }));
    }
  }, [release]);

  const reset = useCallback(() => {
    setState({
      status: "idle",
      progress: 0,
      release: null,
      error: null,
    });
  }, []);

  return {
    state,
    checkForUpdate,
    downloadUpdate,
    reset,
    getCurrentVersion,
  };
}
