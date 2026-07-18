#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODE_PROJECT="$PROJECT_ROOT/UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj"
EXTENSION_SOURCE="$PROJECT_ROOT/extension"
EXTENSION_RESOURCES="$PROJECT_ROOT/UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/private/tmp/userscript-manager-safari-derived}"
APP_SOURCE="$DERIVED_DATA_PATH/Build/Products/Debug/UserscriptManagerSafari.app"
APP_DEST="${APP_DEST:-/Applications/UserScriptManagerSafari.app}"

if [[ -d /Applications/Xcode-beta.app/Contents/Developer ]]; then
  export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"
fi

echo "同步 Web Extension 资源..."
rsync -a --delete "$EXTENSION_SOURCE/" "$EXTENSION_RESOURCES/"

echo "使用 Xcode 构建 Safari Extension App..."
xcodebuild \
  -project "$XCODE_PROJECT" \
  -scheme UserscriptManagerSafari \
  -configuration Debug \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

if [[ ! -d "$APP_SOURCE" ]]; then
  echo "构建完成，但没有找到 App：$APP_SOURCE" >&2
  exit 1
fi

echo "安装到固定位置：$APP_DEST"
ditto "$APP_SOURCE" "$APP_DEST"

echo "清理临时 Debug App 注册，避免 Safari 出现两个同名扩展..."
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -u "$APP_SOURCE" >/dev/null 2>&1 || true
fi
rm -rf "$APP_SOURCE"

echo "打开 App，让 Safari 重新注册扩展..."
open "$APP_DEST"

echo "完成。现在到 Safari 设置 > 扩展中启用 UserScript Manager Safari。"
