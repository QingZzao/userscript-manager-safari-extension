# 更新说明

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
