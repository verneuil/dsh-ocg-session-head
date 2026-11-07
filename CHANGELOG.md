# Changelog

## 0.1.2

### 改进
- 声明 `engines.dsh` 为 `>=0.2.2-alpha.3`：宿主按 `includePrerelease` 判定，该范围同时接受 0.2.2 正式线与各预发布版，低于 0.2.2 的宿主会被正确拒绝。
- 新增仓库图标 `icon.svg`，并用于 README 头部。
- README 改为双语：默认英文（`README.md`）与简体中文（`README.zh.md`），顶部提供徽章式语言切换，并补齐 CI、版本、npm、下载量、provenance、DSH 版本要求与 dsh-plugin.org 收录徽章。

---
### Improvements
- Declared `engines.dsh` as `>=0.2.2-alpha.3`: the host evaluates compatibility with `includePrerelease`, so the range accepts the 0.2.2 stable line and every prerelease, while hosts below 0.2.2 are correctly rejected.
- Added the repository icon `icon.svg` and used it in the README header.
- README is now bilingual: English by default (`README.md`) and Simplified Chinese (`README.zh.md`), with badge-based language switches plus CI, version, npm, downloads, provenance, DSH-requirement and dsh-plugin.org listing badges.

## 0.1.1

### 改进
- README 新增开篇《先读这段》：明确本插件仅适用于 DeepSeek Harness 0.2.2 及以上，且仅用于「自定义供应商名称」的 OpenCode 接入；官方路径接入无需本插件。
- README 安装说明更新为 npm 优先，并修正已失效的 DSH_HOME 路径示例。

---
### Improvements
- README now opens with a "Read this first" section: the plugin requires DeepSeek Harness 0.2.2 or newer, and is only needed for OpenCode connected under a custom provider name — the official path needs no plugin.
- Install instructions now prefer npm, and the outdated DSH_HOME path samples are corrected.

## 0.1.0

### 新功能
- 首个版本：通过宿主官方 `llm-pi-ai/request-headers` 瀑布，为 OpenCode Go 路由按会话注入 `x-opencode-session` 请求头，解决 400 MissingSessionID，并保留按会话的路由与提示词缓存亲和。
- 支持自定义路由：`providers` 路由键白名单与 `hostSuffixes` 主机后缀两条匹配门，默认适配 `ocg`。
- 支持 `session-id` 与 `uuid` 两种头值模式；`uuid` 模式可隐藏真实会话 ID。
- 配置错误会在插件激活阶段直接报错并指出字段，不会静默回落。
- 自带零依赖自测：`node scripts/self-test.mjs`。

*需要 DeepSeek Harness 0.2.2 或更高版本。*

---
### New Features
- First release: injects the `x-opencode-session` header per conversation for OpenCode Go routes through the host's official `llm-pi-ai/request-headers` waterfall, fixing 400 MissingSessionID while preserving per-conversation routing and prompt-cache affinity.
- Custom routes supported: a provider-key allowlist plus a baseURL host-suffix gate, tailored to `ocg` by default.
- Two header-value modes, `session-id` and `uuid`; `uuid` hides the real session id.
- Invalid configuration fails loudly at activation and names the offending field.
- Ships a zero-dependency self-test: `node scripts/self-test.mjs`.

*Requires DeepSeek Harness 0.2.2 or newer.*
