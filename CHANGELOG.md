# 更新说明

## 0.1.14 - 2026-07-21

- 补充英文 README，方便 GitHub 访客理解安装方式、能力范围和未签名 DMG 的限制。
- 明确免费账户/未签名测试版可通过 Safari 的 `Add Temporary Extension...` 手动加载 `extension/` 源码目录。

## 0.1.13 - 2026-07-21

- 修复 Safari 重启后 `storage.local` 返回空脚本列表时没有触发恢复的问题。
- 增加 native messaging 原生侧备份，将脚本列表同步保存到 Safari App Extension 的 `UserDefaults`，进一步降低 Safari Web 存储丢失导致脚本消失的概率。

## 0.1.12 - 2026-07-21

- 为已安装脚本列表增加 IndexedDB 镜像，Safari 重启后如果 `storage.local` 为空，可自动从镜像恢复脚本列表。
- 读取脚本列表时会在恢复后回写 `storage.local`，减少关闭 Safari 后脚本消失的问题。

## 0.1.11 - 2026-07-20

- 新增管理页一键导出备份，保存脚本列表、启停状态、GM 存储、资源缓存和错误日志。
- 新增备份 JSON 导入恢复，适合在未签名测试版 App 更新后恢复 Safari 扩展本地数据。
- 导入前增加确认提示，并只恢复 `usm:` 管理器数据，避免影响浏览器中其他扩展的本地存储。

## 0.1.10 - 2026-07-20

- 新增 `@sandbox` metadata 解析。
- 对声明 `@sandbox JavaScript` 的脚本改用 content-world 执行，避开 GitHub 等站点的页面 CSP `unsafe-eval` 限制。
- 为 content-world 执行路径补充常用 GM API、菜单命令、通知、打开标签页和剪贴板兼容。

## 0.1.9 - 2026-07-20

- 优化管理页布局，改为左侧脚本列表、右上安装区、右下详情工作区。
- 调整响应式布局，小屏幕下自动回到纵向结构。

## 0.1.8 - 2026-07-19

- 调整 README 安装说明结构，将 GitHub Release DMG 作为默认推荐安装方式。
- 将源码构建和手动 Xcode 安装说明降级为开发者/维护者选项。

## 0.1.7 - 2026-07-19

- 新增 `scripts/package-dmg.sh`，可构建 Release App 并生成未 Developer ID 签名、未公证的 DMG 测试安装包。
- README 增加 GitHub Release DMG 分发说明和首次打开安全提示。

## 0.1.6 - 2026-07-19

- 优化 README 和宣传页定位文案，强调 Tampermonkey Classic 停更后 Safari 用户脚本的替代路线。
- 宣传页补充最新 macOS 测试版环境的本机打包安装验证说明。

## 0.1.5 - 2026-07-19

- 新增 MIT License 授权文件。
- 新增 `promo/index.html` 项目宣传页，用于 GitHub 展示和截图分享。
- README 增加宣传页入口和许可证说明。

## 0.1.4 - 2026-07-19

- 新增 `GM_setClipboard` 兼容层，支持用户脚本把文本写入剪贴板。
- 更新 README 的 GM API 支持列表，标明已支持 `GM_setClipboard`。

## 0.1.3 - 2026-07-19

- 新增脚本详情 `存储` Tab，可查看、复制、编辑和删除每个脚本的 GM 存储值。
- 新增脚本详情 `错误日志` Tab，用户脚本运行错误会保存最近 30 条记录，支持刷新和清空。
- 增加页面运行时错误上报通道，将脚本错误从页面主环境转发到扩展存储，方便在管理页排查。
- 修复 `@resource` metadata 在对象形态下导致 `权限/API` Tab 报错的问题。
- 详情 Tab 渲染失败时改为在详情区域显示错误，避免顶部状态栏被长错误文本撑开。

## 0.1.2 - 2026-07-18

- 将管理页的已安装脚本区域改为左侧脚本列表 + 右侧详情面板，避免长脚本信息挤占列表。
- 新增脚本详情 Tab：`概览`、`匹配规则`、`权限/API`、`源码`。
- 新增源码查看器，支持行号、搜索高亮、横向/纵向滚动、复制源码和下载 `.user.js`。
- 优化窄屏布局，脚本列表和详情面板会自动改为上下排列。

## 0.1.1 - 2026-07-18

- 新增 `scripts/build-and-install.sh`，用于一键同步资源、使用 Xcode beta 构建、安装到 `/Applications/UserScriptManagerSafari.app` 并打开 App 注册 Safari 扩展。
- 安装脚本会在复制稳定 App 后清理 `/private/tmp` 中的临时 Debug App 注册，减少 Safari 出现两个同名扩展的情况。
- 优化管理页脚本列表的可读性，长脚本名、描述、`@match`、`@include`、`@exclude` 现在会自动换行，超长匹配规则会在卡片内滚动。
- README 增加稳定安装流程，说明为什么不建议长期使用 `/private/tmp` 的 Debug 构建产物。

## 0.1.0 - 2026-07-18

- 初始版本：支持安装、管理和运行 Safari 用户脚本。
- 提供基础 userscript metadata 解析、匹配规则、`@require`、`@resource` 与常用 GM API 兼容层。
