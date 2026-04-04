# Android APK 构建与发布指南

本文档说明当前项目如何构建 Android APK，以及 Web / APK 两种输出模式如何共存。

---

## 一、当前构建策略

项目现在采用以下统一策略：

- `package.json` 的 `version` 是**单一版本源**
- `next.config.ts` 通过环境变量切换输出模式
  - 默认：`standalone`，用于 Web / Docker
  - APK 构建：`export`，用于 Capacitor
- Android `versionName` 自动读取 `package.json` 中的版本号
- GitHub Actions 在打 tag 时自动构建 APK

也就是说：

- **Web 本地开发 / Docker** 不需要改 `next.config.ts`
- **APK 构建** 也不需要手工改 `next.config.ts`

---

## 二、前置要求

- Node.js 20+
- npm
- Android Studio
- Android SDK

---

## 三、本地构建 APK

### 1. 安装依赖

```bash
npm install
```

### 2. 以静态导出模式构建 Web 资源

```bash
NEXT_OUTPUT_MODE=export npm run build
```

Windows PowerShell:

```powershell
$env:NEXT_OUTPUT_MODE='export'
npm run build
Remove-Item Env:NEXT_OUTPUT_MODE
```

构建完成后会生成：

```text
out/
```

### 3. 同步到 Android 工程

```bash
npx cap sync android
```

### 4. 构建 APK

```bash
cd android
./gradlew assembleDebug
```

Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
```

### 5. APK 输出位置

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 四、Web / Docker 构建方式

项目默认输出模式就是 Web 所需的 `standalone`，因此直接构建即可：

```bash
npm run build
```

或使用 Docker：

```bash
docker build -t openclaw-new-ui .
docker run -d --name openclaw-new-ui -p 3000:3000 openclaw-new-ui
```

---

## 五、自动构建 APK（GitHub Actions）

仓库已配置自动工作流：

- 工作流文件：`.github/workflows/release.yml`
- 触发方式：
  - push tag
  - 手动 `workflow_dispatch`

GitHub Actions 在构建 APK 时会自动设置：

```text
NEXT_OUTPUT_MODE=export
```

因此不需要人工切换 Next.js 输出模式。

---

## 六、版本策略

当前统一规则如下：

### 1. 单一版本源

版本号以 `package.json` 为准，例如：

```json
"version": "2026.4.3"
```

### 2. Android 版本

`android/app/build.gradle` 中的 `versionName` 自动读取 `package.json`，不再手工维护。

### 3. Release Tag 规则

发布 tag 必须与 `package.json` 版本一致，格式如下：

```text
v2026.4.3
```

也就是：

```text
tag = v + package.json.version
```

### 4. App 更新检测

客户端更新检测会从 GitHub Release 的 tag 中提取版本号，因此 Release tag 必须使用标准三段版本格式：

```text
v主版本.次版本.修订号
```

例如：

```text
v2026.4.3
```

---

## 七、推荐发版流程

### 1. 修改版本号

先更新 `package.json` 的版本，例如：

```json
"version": "2026.4.4"
```

### 2. 提交代码

```bash
git add -A
git commit -m "chore: release 2026.4.4"
git push origin master
```

### 3. 打 tag 触发 APK 构建

```bash
git tag v2026.4.4
git push origin v2026.4.4
```

构建成功后，GitHub Release 会自动附带 APK 文件。

---

## 八、常见问题

### 1. 为什么不能手工改 `next.config.ts` 了？

可以改，但不推荐。  
现在已经支持通过环境变量切换：

- `NEXT_OUTPUT_MODE=standalone`
- `NEXT_OUTPUT_MODE=export`

直接改文件容易造成 Web / APK 构建互相影响。

### 2. 为什么要统一版本源？

因为此前存在：

- Web 版本号
- Android 版本号
- Git tag

三者不一致的问题，会导致：

- 更新判断错误
- UI 显示版本不一致
- 发布记录混乱

现在统一后：

- 页面显示版本
- Android 版本名
- GitHub Release tag

都应保持一致。

### 3. Gradle 下载很慢怎么办？

可以：

- 使用代理
- 配置镜像
- 预先下载 Gradle 依赖

---

## 九、当前结论

当前项目已经支持：

- **Web / Docker：默认 `standalone`**
- **APK 构建：`NEXT_OUTPUT_MODE=export`**
- **GitHub Actions：自动打包 APK**
- **版本号：以 `package.json` 为准**

以后不要再通过手工来回修改 `next.config.ts` 进行切换。

## 本地一键构建 APK

新增脚本：`scripts/build-android.ps1`

### Debug APK
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1
```

### Release APK
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android.ps1 -Release
```

### 脚本会自动完成
1. `npm ci`
2. `NEXT_OUTPUT_MODE=export npm run build`
3. `npx cap sync android`
4. 检查 `android/app/src/main/assets/public/collab.html` 是否存在
5. 构建 APK

### 输出路径
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`
