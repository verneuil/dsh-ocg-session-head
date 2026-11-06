/**
 * dsh-ocg-session-head — 给 OpenCode Go 路由按会话注入 `x-opencode-session`。
 *
 * ## 它挂在哪里
 *
 * 监听宿主 dsh-llm-pi-ai 的同步瀑布事件 `llm-pi-ai/request-headers`
 * （DSH 0.2.2-alpha.3 引入、0.2.2-rc.1 确认保留）。
 *
 * 事件签名（官方源码 packages/llm/llm-pi-ai/src/types.ts、README「Request headers」节）：
 *
 *     'llm-pi-ai/request-headers'(
 *       request: PiAiRequestHeaderContext,
 *       headers: Headers,
 *       next: () => Headers,
 *     ): Headers
 *
 *     interface PiAiRequestHeaderContext
 *       extends Readonly<Pick<GenerateOptions, 'provider' | 'model' | 'sessionId' | 'purpose'>> {
 *       readonly baseURL: string
 *     }
 *
 * 官方契约要点：
 *   - 每次**推理调用**派发前触发（含起标题 / 压缩等辅助调用），**不含模型发现**；
 *   - `headers` 是该次请求独占的一份副本，监听者**就地修改**后调用 `next()`；
 *   - 宿主归因头在所有贡献者之后统一写入，监听者无法覆盖；
 *   - 监听者抛错或写入非法 HTTP 头 → 该次调用以 `REQUEST_HEADERS` 在发请求前失败；
 *   - `ctx.on()` 注册的监听器随插件卸载自动移除。
 *
 * ## 为什么不猴补丁 fetch
 *
 * 旧方案（dsh-opencode-session）在 `globalThis.fetch` 上打补丁 + AsyncLocalStorage
 * 传递会话身份。这条链依赖「宿主一定走全局 fetch」，网络栈一变就静默失效。
 * 本插件只在参数层写一个头，与传输实现无关。
 *
 * @module dsh-ocg-session-head
 */

/** Cordis 插件名。与 cordis.patch.yml 里的 row id 保持一致，便于按 id 覆盖 config。 */
export const name = 'dsh-ocg-session-head'

/**
 * 不依赖任何宿主服务：事件由适配器派发，注册本身不需要 llm 服务句柄。
 * 空数组表示「无 inject」，插件在 profile 装配时即可加载。
 */
export const inject = []

/** 配置默认值。profile 里的按 id 覆盖会**整体替换** config，缺省键在此兜底。 */
const DEFAULTS = Object.freeze({
  /** 路由键白名单（精确匹配 request.provider）。 */
  providers: ['ocg'],
  /** baseURL 主机后缀白名单（忽略大小写）。显式空数组表示不按主机匹配。 */
  hostSuffixes: ['opencode.ai'],
  /** 注入的请求头名。 */
  header: 'x-opencode-session',
  /** session-id：直接用宿主会话 id；uuid：按会话派生进程内稳定的不透明 uuid。 */
  mode: 'session-id',
  /** true 时每次成功注入打一行日志（默认关闭，避免刷屏）。 */
  debug: false,
  /** uuid 模式下最多记住多少个会话（超出按最旧淘汰，防止长跑进程无限增长）。 */
  maxTrackedSessions: 4096,
})

/** 允许出现的配置键。写错键名属于配置错误，必须响亮报错而不是被静默忽略。 */
const CONFIG_KEYS = Object.freeze(Object.keys(DEFAULTS))

/**
 * RFC 9110 `token` 文法：HTTP 请求头名必须由这些字符组成且非空。
 * @see https://www.rfc-editor.org/rfc/rfc9110#section-5.6.2
 */
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/**
 * 抛出配置错误。
 *
 * 依据官方配置指南「配置错误要响亮」：非法配置在插件激活阶段直接失败，
 * 而不是悄悄回落到默认值后带着错误设定继续跑。
 *
 * @param {string} message 面向用户的原因。
 * @returns {never} 永远抛出。
 */
function fail(message) {
  throw new Error(`[${name}] invalid config: ${message}`)
}

/**
 * 读取字符串数组配置。
 *
 * 语义刻意区分「未配置」与「配置错误」：
 *   - 未配置（`undefined`）→ 使用默认值；
 *   - 已配置但不是数组、含非字符串、含空串或重复项 → 响亮报错；
 *   - 显式空数组 → 采信为空数组（表示关闭该匹配门）。
 *
 * @param {Record<string, unknown>} config 原始配置。
 * @param {string} key 字段名。
 * @param {readonly string[]} fallback 默认值。
 * @returns {string[]} 规范化后的数组。
 */
function readStringList(config, key, fallback) {
  const raw = config[key]
  if (raw === undefined) return [...fallback]
  if (!Array.isArray(raw)) fail(`"${key}" must be an array of strings`)
  const seen = new Set()
  return raw.map((item, index) => {
    if (typeof item !== 'string') fail(`"${key}[${index}]" must be a string`)
    const value = item.trim()
    if (value.length === 0) fail(`"${key}[${index}]" must be a non-empty string`)
    if (seen.has(value)) fail(`"${key}" lists ${JSON.stringify(value)} more than once`)
    seen.add(value)
    return value
  })
}

/**
 * 把原始 config 解析成运行时选项。
 *
 * 任何非法配置都会抛出带字段名的错误（官方「配置错误要响亮」）。运行时注入失败则走
 * fail-open（见 `apply`），两者互不影响：配置错了直接拒绝启用，运行中偶发异常则放行请求。
 *
 * @param {Record<string, unknown>} [config] loader row 传入的 config。
 * @returns {object} 运行时选项。
 */
export function resolveOptions(config = {}) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    fail('config must be an object')
  }
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.includes(key)) {
      fail(`unknown key ${JSON.stringify(key)}; valid keys are ${CONFIG_KEYS.join(', ')}`)
    }
  }

  const providers = readStringList(config, 'providers', DEFAULTS.providers)
  const hostSuffixes = readStringList(config, 'hostSuffixes', DEFAULTS.hostSuffixes)
    .map((suffix) => suffix.toLowerCase().replace(/^\./, ''))

  const rawHeader = config.header === undefined ? DEFAULTS.header : config.header
  if (typeof rawHeader !== 'string' || rawHeader.trim().length === 0) {
    fail('"header" must be a non-empty string')
  }
  const header = rawHeader.trim()
  if (!HTTP_TOKEN.test(header)) {
    fail(`"header" is not a valid HTTP header name: ${JSON.stringify(header)}`)
  }
  const headerLower = header.toLowerCase()
  if (headerLower === 'user-agent' || headerLower.startsWith('x-deepseek-harness-')) {
    fail(`"header" must not target a Harness attribution header (${header}); the Harness applies its own value after every contributor`)
  }

  const mode = config.mode === undefined ? DEFAULTS.mode : config.mode
  if (mode !== 'session-id' && mode !== 'uuid') {
    fail(`"mode" must be "session-id" or "uuid"; got ${JSON.stringify(mode)}`)
  }

  const debug = config.debug === undefined ? DEFAULTS.debug : config.debug
  if (typeof debug !== 'boolean') fail('"debug" must be a boolean')

  const maxTrackedSessions = config.maxTrackedSessions === undefined
    ? DEFAULTS.maxTrackedSessions
    : config.maxTrackedSessions
  if (!Number.isSafeInteger(maxTrackedSessions) || maxTrackedSessions <= 0) {
    fail('"maxTrackedSessions" must be a positive integer')
  }

  if (providers.length === 0 && hostSuffixes.length === 0) {
    fail('"providers" and "hostSuffixes" are both empty, so no request could ever match')
  }

  return {
    providers: new Set(providers),
    hostSuffixes,
    header,
    mode,
    debug,
    maxTrackedSessions,
  }
}

/**
 * 取 baseURL 的主机名（小写）；无法解析时返回空串，绝不抛错。
 * @param {unknown} baseURL 模型解析后的端点。
 * @returns {string} 主机名或空串。
 */
function hostOf(baseURL) {
  if (typeof baseURL !== 'string' || baseURL.length === 0) return ''
  try {
    return new URL(baseURL).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * 判断这次调用是否属于本插件负责的 OpenCode 路由。
 *
 * 两条门是「或」关系：
 *   1. 路由键在 providers 白名单里（最精确，本机就是 `ocg`）；
 *   2. baseURL 主机命中 hostSuffixes（换路由键、或别名路由时兜底）。
 *
 * @param {ReturnType<typeof resolveOptions>} options 运行时选项。
 * @param {Record<string, unknown>} request 事件携带的路由元数据。
 * @returns {boolean} 是否由本插件接管。
 */
export function isOpenCodeRoute(options, request) {
  const provider = typeof request.provider === 'string' ? request.provider : ''
  if (provider.length > 0 && options.providers.has(provider)) return true
  if (options.hostSuffixes.length === 0) return false
  const host = hostOf(request.baseURL)
  if (host.length === 0) return false
  return options.hostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/**
 * 计算某次会话要写入的头值。
 * @param {ReturnType<typeof resolveOptions>} options 运行时选项。
 * @param {Map<string, string>} table uuid 模式下会话 → uuid 的映射。
 * @param {unknown} sessionId 宿主会话 id。
 * @returns {string | undefined} 头值；无法产生时返回 undefined。
 */
export function headerValueFor(options, table, sessionId) {
  const raw = String(sessionId ?? '')
  if (raw.length === 0) return undefined
  if (options.mode !== 'uuid') return raw
  const cached = table.get(raw)
  if (cached !== undefined) return cached
  const value = globalThis.crypto?.randomUUID?.()
  if (value === undefined) return raw
  if (table.size >= options.maxTrackedSessions) {
    const oldest = table.keys().next()
    if (oldest.done !== true) table.delete(oldest.value)
  }
  table.set(raw, value)
  return value
}

/**
 * 安装插件。
 * @param {import('cordis').Context} ctx 宿主上下文。
 * @param {Record<string, unknown>} [config] loader row 的 config。
 */
export function apply(ctx, config) {
  const options = resolveOptions(config)
  /** @type {Map<string, string>} */
  const uuidBySession = new Map()

  ctx.on('llm-pi-ai/request-headers', (request, headers, next) => {
    // 宿主契约要求监听者必须调用 next()；任何异常都不允许把整次推理打断，
    // 因此在本地逻辑上失败即「放弃注入、原样放行」。
    try {
      if (typeof next !== 'function') return headers
      if (request === null || typeof request !== 'object') return next()
      if (headers === null || typeof headers !== 'object' || typeof headers.set !== 'function') return next()
      if (!isOpenCodeRoute(options, request)) return next()
      // 已有同名头一律让路：与官方实现、其它插件、静态 headers 配置共存。
      if (typeof headers.has === 'function' && headers.has(options.header)) return next()
      const value = headerValueFor(options, uuidBySession, request.sessionId)
      if (value === undefined) return next()
      headers.set(options.header, value)
      if (options.debug) {
        ctx.logger.info(
          `[dsh-ocg-session-head] ${options.header}=${value} `
            + `provider=${String(request.provider)} model=${String(request.model)} `
            + `purpose=${String(request.purpose ?? 'chat')}`,
        )
      }
    } catch (error) {
      ctx.logger.warn(
        `[dsh-ocg-session-head] header preparation skipped: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    return next()
  })

  ctx.logger.info(
    `[dsh-ocg-session-head] ready (header=${options.header} mode=${options.mode} `
      + `providers=${[...options.providers].join(',') || '(none)'} `
      + `hostSuffixes=${options.hostSuffixes.join(',') || '(none)'} debug=${String(options.debug)}`
      + '）—— 需要宿主提供 llm-pi-ai/request-headers 事件（DSH >= 0.2.2-rc.1）',
  )
}

export default { name, inject, apply }
