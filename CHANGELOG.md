# Changelog

## 0.1.4

### 修复
- 修复请求头监听器的异常边界：下游贡献者抛错时会被本插件二次调用 `next()`，把真实错误改写成 `next() called multiple times`。现在 `next()` 只在 `try` 外调用一次，下游错误原样上浮，自身错误仍 fail-open。

---
### Fixes
- Fixed the listener's error boundary: when a downstream contributor threw, the plugin could call `next()` a second time and replace the real error with `next() called multiple times`. `next()` is now called exactly once outside `try`, downstream errors surface untouched, and the plugin's own failures still fail open.

## 0.1.3

### 修复
- 修复插件在 DeepSeek Harness 插件列表中显示默认图标、而非自带图标的问题：补声明 `package.json` 的 `icon` 字段。

---
### Fixes
- Fixed the plugin showing the default placeholder instead of its own icon in the DeepSeek Harness plugin list, by declaring the `icon` field in `package.json`.

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
