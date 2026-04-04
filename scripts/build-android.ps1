param(
  [switch]$Release
)

$ErrorActionPreference = 'Stop'

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

Step '校验 Node / npm'
node -v
npm -v

Step '安装依赖'
npm ci

Step '以 export 模式构建 Next.js 静态资源'
$env:NEXT_OUTPUT_MODE = 'export'
npm run build
Remove-Item Env:NEXT_OUTPUT_MODE -ErrorAction SilentlyContinue

Step '同步 Capacitor Android 资源'
npx cap sync android

Step '确认 collab 页面已进入 Android 资源目录'
$collabHtml = Join-Path $PSScriptRoot '..\android\app\src\main\assets\public\collab.html'
$collabHtml = [System.IO.Path]::GetFullPath($collabHtml)
if (-not (Test-Path $collabHtml)) {
  throw "未找到 $collabHtml ，说明最新页面还没有同步进 Android 资源目录。"
}
Write-Host "已确认：$collabHtml" -ForegroundColor Green

Step '构建 Android APK'
Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  if ($Release) {
    .\gradlew.bat assembleRelease
    $apkPath = Join-Path (Get-Location) 'app\build\outputs\apk\release\app-release.apk'
  }
  else {
    .\gradlew.bat assembleDebug
    $apkPath = Join-Path (Get-Location) 'app\build\outputs\apk\debug\app-debug.apk'
  }
}
finally {
  Pop-Location
}

$apkPath = [System.IO.Path]::GetFullPath($apkPath)
if (-not (Test-Path $apkPath)) {
  throw "APK 构建完成后未找到文件：$apkPath"
}

Step '构建完成'
Write-Host "APK 文件：$apkPath" -ForegroundColor Green
