#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODE_PROJECT="$PROJECT_ROOT/UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj"
EXTENSION_SOURCE="$PROJECT_ROOT/extension"
EXTENSION_RESOURCES="$PROJECT_ROOT/UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/private/tmp/userscript-manager-safari-release-derived}"
DIST_DIR="$PROJECT_ROOT/dist"
STAGING_DIR="$DIST_DIR/dmg-staging"
APP_SOURCE="$DERIVED_DATA_PATH/Build/Products/Release/UserscriptManagerSafari.app"
APP_NAME="UserScriptManagerSafari.app"
APP_VERSION="${VERSION:-$(awk -F '"' '/"version"/ { print $4; exit }' "$EXTENSION_SOURCE/manifest.json")}"
DMG_NAME="UserScriptManagerSafari-$APP_VERSION.dmg"
DMG_PATH="$DIST_DIR/$DMG_NAME"

if [[ -d /Applications/Xcode-beta.app/Contents/Developer ]]; then
  export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-beta.app/Contents/Developer}"
fi

echo "同步 Web Extension 资源..."
rsync -a --delete "$EXTENSION_SOURCE/" "$EXTENSION_RESOURCES/"

echo "使用 Xcode Release 配置构建 Safari Extension App..."
xcodebuild \
  -project "$XCODE_PROJECT" \
  -scheme UserscriptManagerSafari \
  -configuration Release \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

if [[ ! -d "$APP_SOURCE" ]]; then
  echo "构建完成，但没有找到 App：$APP_SOURCE" >&2
  exit 1
fi

echo "准备 DMG 暂存目录..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
ditto "$APP_SOURCE" "$STAGING_DIR/$APP_NAME"
ln -s /Applications "$STAGING_DIR/Applications"

echo "生成未 Developer ID 签名、未公证 DMG：$DMG_PATH"
mkdir -p "$DIST_DIR"
rm -f "$DMG_PATH"
hdiutil create \
  -volname "UserScript Manager Safari" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "清理临时 Release App 注册，避免 Safari 出现临时构建扩展..."
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -u "$APP_SOURCE" >/dev/null 2>&1 || true
fi

echo "完成：$DMG_PATH"
echo "注意：这是未 Developer ID 签名、未公证的测试安装包，首次打开可能需要右键打开或在系统设置中允许。"
