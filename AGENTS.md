# 项目规则

- 本项目只做本机自用，不发布到 App Store、GitHub 或其它公开渠道，除非用户明确改变目标。
- 默认使用中文沟通和注释；代码标识、API、文件名、报错原文可以保留英文。
- 这是轻量 userscript 管理器，不是完整 Tampermonkey 复刻；优先保证安装、启停、匹配、注入和常用 GM API 可用。
- 初版接受 `<all_urls>` 权限，因为通用脚本管理器需要覆盖未知站点；UI 和文档必须明确提醒用户只安装可信脚本。
- 不提交、不输出任何私人账号信息、浏览历史、Cookie、Token 或其它隐私数据。
- `extension/` 是主要源码目录；Xcode 打包资源位于 `UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources/`，修改后要保持两边同步。
- 现有 AC-baidu 和 Zhihu 单脚本扩展只能作为验收样本，不要把它们直接合并进本项目。
