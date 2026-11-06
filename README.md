# OCG 会话头（@verneuil/dsh-ocg-session-head）

给 **OpenCode Go** 路由按会话注入 `x-opencode-session` 请求头。

这是 `dsh-opencode-session`（fetch 猴补丁版）的**替代实现**：不替换 `globalThis.fetch`、不使用
`AsyncLocalStorage`，只在宿主官方预留的请求头席位里写一个头。

- 仓库：<https://github.com/verneuil/dsh-ocg-session-head>
- 自测：`node scripts/self-test.mjs`（零依赖，不需要宿主）

---

## 1. 为什么需要

OpenCode Go 自 2026-09-05 起，推理请求必须携带稳定的 `x-opencode-session`，否则返回：

```
400 {"type":"MissingSessionID", ...}
```

官方对**内置** `opencode` / `opencode-go` 路由已经在 pi-ai 里做了包装；但本机的 OCG 是
**自定义路由 `ocg`**（自写 `baseURL` + `api: openai-completions`），拿不到那层包装，因此需要插件补上。

## 2. 版本要求（重要）

| 项 | 要求 |
|---|---|
| DSH | **≥ 0.2.2-rc.1**（`llm-pi-ai/request-headers` 事件自 0.2.2-alpha.3 引入，rc.1 确认保留） |
| Node | 无额外要求（纯 ESM，零依赖） |

在**低于该版本**的宿主上安装是安全的：插件能加载、会打一行 ready 日志，但事件永不触发 →
行为等价于不装（OCG 仍会 400）。**可用这一特性做「先装后升级」的分步验证。**

## 3. 安装（只走 tarball）

> ⚠️ **绝不要把「包目录」当安装 target。** pnpm 对目录使用 `link:`（junction），模块解析会
> 退化成 Node 原生解析，DSH 解析拦截层失效 → 条目 `failed to import`。
> **只有 tarball 会被解包成 profile 内的实体目录。**

正规方式二选一：

**A. 插件管理页**：设置 → 插件 → 安装本地包 → 选择 `.tgz`。

**B. profile 依赖**：在 `$DSH_HOME/profiles/desktop/package.json` 的 `dependencies` 加入

```json
"@verneuil/dsh-ocg-session-head": "file:D:/.../_pkg/dsh-ocg-session-head-0.1.0-rc.20261105-XXXX.tgz"
```

再用 DSH 自带的 node/pnpm 安装（本机不需要系统 npm）：

```powershell
& 'D:\Others\DeepSeek-Harness\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' `
  'D:\Others\DeepSeek-Harness\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs' `
  install --dir 'D:\Others\DeepSeek-Harness\profiles\desktop'
```

安装后**重启 DSH**（重启会杀掉宿主里的 AI 进程，需人工执行）。

## 4. 配置

`cordis.patch.yml` 自带一份默认 config；也可在 profile 的 `cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: dsh-ocg-session-head
  config:
    providers:
      - ocg
    debug: true
```

> 按 id 覆盖是**整体替换** config。

| 键 | 默认 | 说明 |
|---|---|---|
| `providers` | `['ocg']` | 路由键白名单，精确匹配事件里的 `provider` |
| `hostSuffixes` | `['opencode.ai']` | baseURL 主机后缀白名单；两条门是**或**关系，换路由键时兜底 |
| `header` | `x-opencode-session` | 注入的头名，必须是合法 HTTP header 名 |
| `mode` | `session-id` | `session-id`：直接用宿主会话 id（跨轮次/压缩/重启稳定）；`uuid`：按会话派生进程内稳定的不透明 uuid |
| `debug` | `false` | 每次成功注入打一行日志 |
| `maxTrackedSessions` | `4096` | `uuid` 模式下会话映射上限，超出按最旧淘汰 |

### 配置校验（错误会响亮报错）

遵循官方「配置错误要响亮」原则：**非法配置会让插件激活失败并给出字段名**，不会静默回落。

| 情况 | 行为 |
|---|---|
| 键未配置（`undefined`） | 使用默认值 |
| 出现未知键名（疑似拼写错误） | ❌ 报错并列出合法键 |
| `providers` / `hostSuffixes` 不是字符串数组、含空串、含重复项 | ❌ 报错并指出下标 |
| `header` 为空或不是合法 HTTP header 名 | ❌ 报错 |
| `header` 指向 Harness 归属头（`user-agent`、`x-deepseek-harness-*`） | ❌ 报错（宿主会在所有贡献者之后覆盖它，写了也无效） |
| `mode` 不是 `session-id` / `uuid` | ❌ 报错 |
| `debug` 不是布尔、`maxTrackedSessions` 不是正整数 | ❌ 报错 |
| `providers` 与 `hostSuffixes` **同时为空** | ❌ 报错（永远匹配不到任何请求） |

> 数组字段语义：「未配置」用默认值；**显式传空数组表示关闭这道门**。
> 例如 `hostSuffixes: []` 表示只按路由键匹配、不再按 baseURL 主机兜底。

## 5. 行为保证

- **已有同名头一律让路**：不覆盖静态 `headers` 配置、官方实现或其它插件写入的值。
- **无会话 id 不注入**：辅助调用若没有 `sessionId`，原样放行。
- **失败即放行**：插件内部任何异常只 `warn` 一行，然后继续 `next()`，绝不因本插件打断推理。
- **零全局副作用**：不修改 `globalThis`、不替换 `fetch`、不写文件。
- **随插件卸载自动撤销**：监听器由 `ctx.on()` 注册，归 fiber 生命周期管理。

## 6. 验证（四关）

1. **启动日志**：宿主控制台出现
   `[dsh-ocg-session-head] ready (header=x-opencode-session mode=session-id providers=ocg ...)`
2. **注入日志**：把 `debug` 打开后，每次模型调用出现
   `[dsh-ocg-session-head] x-opencode-session=<id> provider=ocg model=... purpose=chat`
3. **真请求 200**：正常对话不出现 400 `MissingSessionID`。
4. **反向证明**：禁用本插件后立刻 400 —— 证明头确实是它在发。

## 7. 卸载与回滚

- 插件管理页卸载，或从 profile `dependencies` 删除该包后重装依赖。
- 旧插件 `dsh-opencode-session` 可与之**共存**（两者都「已有不覆盖」，新实现先写入、旧的自动 no-op）。
  切换期建议：**旧插件保持安装但禁用**，出问题 30 秒切回。

## 8. 开发与打包

```powershell
# 自测（零依赖，不需要宿主）
node scripts/self-test.mjs

# 用 DSH 自带运行时打包（无需系统 node/pnpm）
$node = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
& $node $pnpm pack
```

本地测试包命名遵循工作区约定：`0.1.0-rc.<YYYYMMDD-HHmm>`（临时改版本 → 打包 → 立即还原）。

## 9. 已知限制

- 只覆盖 **pi-ai 路由**（`@deepseek-ai/dsh-llm-pi-ai`）。`deepseek-official` 走
  `@deepseek-ai/dsh-llm-deepseek`，它自己发 `x-deepseek-harness-session-id`，与本插件无关。
- **不覆盖模型发现**（宿主契约明确该事件 `excludes model discovery`）。
- 事件是**同步**的：监听器必须就地修改 `headers` 并立刻 `return next()`，不得保存该对象引用。
- 未声明 `engines.dsh`。官方推荐声明兼容范围，但 SemVer 的预发布规则会让 `>=0.2.2` 拒绝
  `0.2.2-rc.1`、让 `>=0.2.2-rc.1` 拒绝将来的 `0.2.3-rc.1`，对跟着 rc 升级的用户反而更危险；
  因此这里选择不声明（等价于不做版本门禁），运行期依赖单一公开事件，兼容面本就很窄。

## License

MIT
