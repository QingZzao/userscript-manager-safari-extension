# UserScript Manager Safari Extension

本项目是一个 macOS Safari 自用轻量用户脚本管理器，用来替代当前不再维护或无法正常使用的 Tampermonkey Classic。

宣传页：[promo/index.html](promo/index.html)

## 当前能力

- 从 `.user.js` 原始链接安装脚本。
- 从完整 userscript 源码安装脚本。
- 解析 `@name`、`@version`、`@description`、`@match`、`@include`、`@exclude`、`@grant`、`@run-at`、`@require`、`@resource`。
- 在管理页面启用、停用、删除脚本。
- 按脚本匹配规则在页面主环境注入执行。
- 提供轻量 `GM_*` / `GM.*` 兼容层：
  - `GM_info`
  - `GM_addStyle`
  - `GM_getValue`
  - `GM_setValue`
  - `GM_deleteValue`
  - `GM_listValues`
  - `GM_xmlhttpRequest`
  - `GM_getResourceText`
  - `GM_getResourceURL`
  - `GM_getResourceUrl`
  - `GM_registerMenuCommand`
  - `GM_unregisterMenuCommand`
  - `GM_addValueChangeListener`
  - `GM_removeValueChangeListener`
  - `GM_openInTab`
  - `GM_notification`
  - `GM_setClipboard`
- 安装时缓存 `@require` 依赖，运行时按顺序注入。
- 按需读取并缓存 `@resource` 文本资源。
- 对 AC-baidu 这类设置页提供基础跨页面 GM 值同步。

## 项目结构

- `extension/`：可读、可编辑的 Web Extension 源码。
- `UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj`：Safari Web Extension 的 Xcode 工程。
- `UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources/`：Xcode 打包时使用的扩展资源，当前与 `extension/` 内容保持一致。

## 推荐：稳定安装到 Safari

开发调试时，Xcode 的构建产物通常在 `/private/tmp` 或 DerivedData 目录里。这个位置不适合长期给 Safari 识别，重启或系统清理后可能出现“扩展暂时消失，之后又回来”的现象。

推荐使用项目脚本构建并复制到固定位置：

```bash
cd userscript-manager-safari-extension
./scripts/build-and-install.sh
```

脚本会完成这些动作：

- 同步 `extension/` 到 Xcode 打包使用的 `Resources/`。
- 使用 `/Applications/Xcode-beta.app` 构建；如果你手动设置了 `DEVELOPER_DIR`，会优先使用你的设置。
- 把构建出的 App 安装到 `/Applications/UserScriptManagerSafari.app`。
- 打开这个 App，让 Safari 重新注册扩展。

完成后，到 Safari 设置里的“扩展”中启用 `UserScript Manager Safari`。如果 Safari 仍然看不到扩展，先确认 Safari 的“开发”菜单里允许未签名扩展，然后重新运行上面的脚本。

## 手动打包

推荐使用完整 Xcode 构建。当前机器验证过的方式是使用 `/Applications/Xcode-beta.app`，并把 DerivedData 放到 `/private/tmp`，可以避开部分云盘/文件提供器目录导致的签名资源属性问题。

```bash
cd userscript-manager-safari-extension
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  xcodebuild \
  -project UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj \
  -scheme UserscriptManagerSafari \
  -configuration Debug \
  -derivedDataPath /private/tmp/userscript-manager-safari-derived \
  build
```

构建成功后，本地 App 会在：

```text
/private/tmp/userscript-manager-safari-derived/Build/Products/Debug/UserscriptManagerSafari.app
```

如果你使用正式版 Xcode，可以把 `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer` 去掉，或替换成自己的 Xcode 路径。

## 手动安装到 Safari

1. 用 Xcode 打开 `UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj`。
2. 选择 `UserscriptManagerSafari` 这个 Mac App target 运行。
3. 在 Safari 设置里的“扩展”中启用 `UserScript Manager Safari`。
4. 点击扩展按钮，进入管理页面。
5. 粘贴 `.user.js` 链接或源码安装脚本。
6. 打开目标网页验证脚本是否生效。

也可以直接打开命令行构建出的 App。不过这个路径只适合临时调试，不建议作为长期安装位置：

```bash
open /private/tmp/userscript-manager-safari-derived/Build/Products/Debug/UserscriptManagerSafari.app
```

如果 Safari 里看不到扩展，请确认：

- Safari 已开启“开发”菜单。
- Safari 允许未签名/本地开发扩展。
- 打开的 App 是最新构建产物。
- Safari 设置的“扩展”里已勾选 `UserScript Manager Safari`。

## 安装用户脚本

1. 点击 Safari 工具栏里的 `UserScript Manager Safari`。
2. 打开管理页面。
3. 粘贴 `.user.js` 原始链接，或粘贴完整源码。
4. 点击安装。
5. 如果脚本包含 `@require`，安装时会先下载并缓存依赖。
6. 刷新目标网站验证脚本是否运行。

已用作验收的脚本：

- Zhihu enhancement：验证菜单、GM 存储、URL 变化、页面主环境注入。
- AC-baidu：验证 `@require`、`@resource`、GM 值同步、配置页和搜索页联动。

## 修改源码后同步资源

`extension/` 是主要源码目录，Xcode 实际打包使用 `UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources/`。如果改了 `extension/`，要把对应文件同步到 Resources 目录后再构建。

当前项目里两边已经保持同步。后续可以考虑加一个同步脚本，减少手动维护。

## 注意

- 这是自用轻量版，不是完整 Tampermonkey 复刻。
- 初版使用 `<all_urls>` 权限，方便通用脚本管理；请只安装可信脚本。
- 初版不包含在线脚本市场、自动订阅、复杂编辑器、云同步或 App Store 上架流程。
- 如果修改 `extension/` 源码，构建前需要同步到 `UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources/`。

## 许可证

本项目基于 MIT License 开源，详见 `LICENSE`。
