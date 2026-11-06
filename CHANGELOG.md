# Changelog

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
