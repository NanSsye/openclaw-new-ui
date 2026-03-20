# Android APK 构建指南

本文档说明如何将 OpenClaw New UI 打包成 Android APK。

## 前置要求

- Node.js 18+
- npm 或 yarn
- Android Studio（用于编译 APK）
- Android SDK

## 构建步骤

### 1. 安装 Capacitor 依赖

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2. 初始化 Capacitor

```bash
npx cap init "OpenClaw" "com.openclaw.app" --web-dir=out
```

参数说明：
- `OpenClaw` - 应用名称
- `com.openclaw.app` - 应用包名
- `web-dir=out` - Web 构建产物目录

### 3. 修改 Next.js 配置（仅用于 Android 构建）

编辑 `next.config.ts`，将 `output` 从 `standalone` 改为 `export`：

```typescript
const nextConfig: NextConfig = {
  output: 'export',  // 改为 static export，适用于 APK
  // ...
};
```

### 4. 构建 Web 项目

```bash
npm run build
```

构建产物会在 `out/` 目录。

### 5. 添加 Android 平台

```bash
npx cap add android
```

### 6. 同步 Web 资源到 Android

```bash
npx cap sync android
```

### 7. 用 Android Studio 编译 APK

1. 用 Android Studio 打开 `android` 文件夹
2. 等待 Gradle 同步完成
3. 点击 Build → Build Bundle(s) / APK(s) → Build APK(s)

APK 输出位置：`android\app\build\outputs\apk\debug\app-debug.apk`

## 恢复为 Web 开发模式

如果需要恢复为正常的 Web 开发：

### 1. 修改回 standalone 模式

编辑 `next.config.ts`：

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // 改回 standalone
  // ...
};
```

### 2. 启动开发服务器

```bash
npm run dev
```

## 可选：卸载 Android 相关（不需要时）

```bash
# 删除 Android 项目目录
rm -rf android

# 删除 Capacitor 配置
rm capacitor.config.ts

# 卸载 Capacitor 包
npm uninstall @capacitor/core @capacitor/cli @capacitor/android
```

## 注意事项

1. **Web 开发和 Android 构建可以并存** - 只需要在构建 Android 时修改 `output: 'export'`

2. **Web 资源位置** - Capacitor 会将 `out/` 目录下的静态文件复制到 `android\app\src\main\assets\public`

3. **更新后同步** - 修改 Web 代码后需要重新 `npm run build` + `npx cap sync android`

4. **Gradle 下载问题** - 如果 Gradle 下载超时，可以：
   - 使用 VPN
   - 配置国内镜像：`gradle-wrapper.properties` 中添加 `distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-all.zip`
   - 手动下载 Gradle 放到 `~/.gradle/wrapper/dists/` 目录

## 文件变更记录

| 文件/目录 | 变更类型 | 说明 |
|---------|---------|------|
| `next.config.ts` | 修改 | output: 'export' 用于静态导出 |
| `capacitor.config.ts` | 新增 | Capacitor 配置文件 |
| `android/` | 新增 | Android 原生项目 |
| `@capacitor/*` | npm 包新增 | Capacitor 运行时依赖 |
