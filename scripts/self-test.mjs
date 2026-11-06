#!/usr/bin/env node
/**
 * 自测脚本：不依赖宿主即可运行。
 *
 *   node scripts/self-test.mjs
 *
 * 覆盖三块：
 *   1. 配置解析与「配置错误要响亮」的校验；
 *   2. 路由匹配与头值派生；
 *   3. 以假 ctx 模拟宿主 waterfall，验证注入行为、fail-open 与 next() 契约。
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const moduleUrl = pathToFileURL(join(here, '..', 'index.js')).href
const mod = await import(moduleUrl)
const { apply, resolveOptions, isOpenCodeRoute, headerValueFor } = mod

let pass = 0
let fail = 0

/**
 * @param {string} name 断言名。
 * @param {boolean} condition 断言结果。
 * @param {unknown} [detail] 失败时附带的信息。
 */
function ok(name, condition, detail) {
  if (condition) {
    pass += 1
    return
  }
  fail += 1
  console.log(`  FAIL  ${name}${detail === undefined ? '' : `  -> ${String(detail)}`}`)
}

/**
 * 断言某段配置会响亮报错。
 * @param {string} name 断言名。
 * @param {() => unknown} run 触发函数。
 * @param {RegExp} pattern 期望错误信息匹配的正则。
 */
function rejects(name, run, pattern) {
  try {
    run()
    ok(name, false, 'expected a thrown error, nothing was thrown')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ok(name, pattern.test(message), message)
  }
}

// ---------------------------------------------------------------- 导出面
ok('exposes name', mod.name === 'dsh-ocg-session-head', mod.name)
ok('exposes inject as empty array', Array.isArray(mod.inject) && mod.inject.length === 0)
ok('exposes apply', typeof apply === 'function')
ok('exposes default export', mod.default && mod.default.name === mod.name && mod.default.apply === apply)

// ---------------------------------------------------------------- 默认配置
const defaults = resolveOptions()
ok('default providers contain ocg', defaults.providers.has('ocg'))
ok('default header', defaults.header === 'x-opencode-session', defaults.header)
ok('default mode', defaults.mode === 'session-id', defaults.mode)
ok('default host suffixes', defaults.hostSuffixes.includes('opencode.ai'))
ok('default debug off', defaults.debug === false)
ok('default maxTrackedSessions', defaults.maxTrackedSessions === 4096)

const configured = resolveOptions({
  providers: [' ocg ', 'alias'],
  hostSuffixes: ['.OpenCode.ai'],
  header: 'X-Test-Session',
  mode: 'uuid',
  debug: true,
  maxTrackedSessions: 8,
})
ok('providers are trimmed', configured.providers.has('ocg') && configured.providers.has('alias'))
ok('host suffixes are normalised', configured.hostSuffixes[0] === 'opencode.ai', configured.hostSuffixes[0])
ok('header override', configured.header === 'X-Test-Session')
ok('mode override', configured.mode === 'uuid')
ok('debug override', configured.debug === true)
ok('maxTrackedSessions override', configured.maxTrackedSessions === 8)

const hostsOff = resolveOptions({ hostSuffixes: [] })
ok('explicit empty hostSuffixes disables the host gate', hostsOff.hostSuffixes.length === 0)

// ---------------------------------------------------------------- 配置错误要响亮
rejects('rejects non-object config', () => resolveOptions(null), /config must be an object/)
rejects('rejects array config', () => resolveOptions([]), /config must be an object/)
rejects('rejects unknown key', () => resolveOptions({ provider: ['ocg'] }), /unknown key "provider"/)
rejects('rejects non-array providers', () => resolveOptions({ providers: 'ocg' }), /must be an array of strings/)
rejects('rejects non-string provider entry', () => resolveOptions({ providers: [1] }), /must be a string/)
rejects('rejects empty provider entry', () => resolveOptions({ providers: ['  '] }), /must be a non-empty string/)
rejects('rejects duplicate provider', () => resolveOptions({ providers: ['ocg', 'ocg'] }), /more than once/)
rejects('rejects empty header', () => resolveOptions({ header: '   ' }), /must be a non-empty string/)
rejects('rejects invalid header name', () => resolveOptions({ header: 'bad header' }), /not a valid HTTP header name/)
rejects('rejects user-agent header', () => resolveOptions({ header: 'User-Agent' }), /Harness attribution header/)
rejects('rejects harness attribution header', () => resolveOptions({ header: 'x-deepseek-harness-session-id' }), /Harness attribution header/)
rejects('rejects unknown mode', () => resolveOptions({ mode: 'sessionid' }), /must be "session-id" or "uuid"/)
rejects('rejects non-boolean debug', () => resolveOptions({ debug: 'yes' }), /"debug" must be a boolean/)
rejects('rejects non-integer maxTrackedSessions', () => resolveOptions({ maxTrackedSessions: 1.5 }), /positive integer/)
rejects('rejects zero maxTrackedSessions', () => resolveOptions({ maxTrackedSessions: 0 }), /positive integer/)
rejects('rejects two empty gates', () => resolveOptions({ providers: [], hostSuffixes: [] }), /both empty/)

// ---------------------------------------------------------------- 路由匹配
ok('matches by provider key', isOpenCodeRoute(defaults, { provider: 'ocg', baseURL: 'https://opencode.ai/zen/go/v1' }))
ok('matches by host suffix', isOpenCodeRoute(defaults, { provider: 'alias', baseURL: 'https://opencode.ai/zen/go/v1' }))
ok('ignores unrelated routes', !isOpenCodeRoute(defaults, { provider: 'xy-api', baseURL: 'http://192.168.9.138:3000/v1' }))
ok('does not match lookalike domains', !isOpenCodeRoute(defaults, { provider: 'x', baseURL: 'https://notopencode.ai/v1' }))
ok('falls back to provider when baseURL is unparsable', isOpenCodeRoute(defaults, { provider: 'ocg', baseURL: 'not a url' }))
ok('host gate can be disabled', !isOpenCodeRoute(hostsOff, { provider: 'x', baseURL: 'https://opencode.ai/v1' }))

// ---------------------------------------------------------------- 头值
ok('session-id mode passes the id through', headerValueFor(defaults, new Map(), 'session-abc') === 'session-abc')
ok('missing session id yields undefined', headerValueFor(defaults, new Map(), '') === undefined)

const uuidOptions = resolveOptions({ mode: 'uuid' })
const uuidTable = new Map()
const uuidA1 = headerValueFor(uuidOptions, uuidTable, 'session-a')
const uuidA2 = headerValueFor(uuidOptions, uuidTable, 'session-a')
const uuidB = headerValueFor(uuidOptions, uuidTable, 'session-b')
ok('uuid mode is stable per session', uuidA1 === uuidA2)
ok('uuid mode differs across sessions', uuidA1 !== uuidB)
ok('uuid mode does not leak the session id', uuidA1 !== 'session-a')

// ---------------------------------------------------------------- 宿主行为模拟
/**
 * 造一个最小的假 ctx：记录注册的事件与日志。
 * @returns {object} 假 ctx 与其观测盒。
 */
function makeHost() {
  const box = { event: undefined, handler: undefined, infos: [], warns: [] }
  box.ctx = {
    on: (event, handler) => {
      box.event = event
      box.handler = handler
    },
    logger: {
      info: (...args) => box.infos.push(args.join(' ')),
      warn: (...args) => box.warns.push(args.join(' ')),
    },
  }
  return box
}

/**
 * 驱动一次 waterfall。
 * @param {object} box 假 ctx 观测盒。
 * @param {unknown} request 路由元数据。
 * @param {unknown} headers 请求头副本。
 * @returns {{ret: unknown, calls: number, sentinel: symbol}} 结果与 next 调用次数。
 */
function dispatch(box, request, headers) {
  let calls = 0
  const sentinel = Symbol('downstream')
  const ret = box.handler(request, headers, () => {
    calls += 1
    return sentinel
  })
  return { ret, calls, sentinel }
}

const host = makeHost()
apply(host.ctx, { debug: true })
ok('registers the official waterfall event', host.event === 'llm-pi-ai/request-headers', host.event)
ok('logs a ready line', host.infos.length >= 1)
ok('ready line has no %s placeholder left', !host.infos.join('|').includes('%s'), host.infos[0])

const target = { provider: 'ocg', model: 'deepseek-v4.1-flash', baseURL: 'https://opencode.ai/zen/go/v1' }

let headers = new Headers()
let result = dispatch(host, { ...target, sessionId: 'session-abc' }, headers)
ok('injects the header on a matching route', headers.get('x-opencode-session') === 'session-abc', headers.get('x-opencode-session'))
ok('calls next exactly once', result.calls === 1)
ok('returns the downstream value', result.ret === result.sentinel)
ok('writes a debug line', host.infos.some((line) => line.includes('x-opencode-session=session-abc')))

headers = new Headers()
result = dispatch(host, { ...target, sessionId: 'session-abc' }, headers)
ok('keeps a stable value within a session', headers.get('x-opencode-session') === 'session-abc')

headers = new Headers()
dispatch(host, { provider: 'xy-api', baseURL: 'http://192.168.9.138:3000/v1', sessionId: 's' }, headers)
ok('leaves unrelated routes untouched', headers.get('x-opencode-session') === null)

headers = new Headers({ 'x-opencode-session': 'preset' })
dispatch(host, { ...target, sessionId: 'session-abc' }, headers)
ok('never overwrites an existing header', headers.get('x-opencode-session') === 'preset')

headers = new Headers()
result = dispatch(host, target, headers)
ok('skips calls without a session id', headers.get('x-opencode-session') === null)
ok('still calls next without a session id', result.calls === 1)

result = dispatch(host, { ...target, sessionId: 's' }, null)
ok('survives a null headers argument', result.calls === 1)

result = dispatch(host, null, new Headers())
ok('survives a null request argument', result.calls === 1)

headers = new Headers()
dispatch(host, { ...target, sessionId: 's2', purpose: 'session-title' }, headers)
ok('covers auxiliary calls (purpose)', headers.get('x-opencode-session') === 's2', headers.get('x-opencode-session'))

const uuidHost = makeHost()
apply(uuidHost.ctx, { mode: 'uuid' })
headers = new Headers()
dispatch(uuidHost, { ...target, sessionId: 'session-abc' }, headers)
const derived = headers.get('x-opencode-session')
ok('uuid mode injects a derived value', derived !== null && derived !== 'session-abc', derived)

// 配置错误必须让插件激活失败（而不是带着错配置继续跑）
const badHost = makeHost()
let activationError
try {
  apply(badHost.ctx, { mode: 'sessionid' })
} catch (error) {
  activationError = error
}
ok('invalid config fails activation loudly', activationError instanceof Error && /invalid config/.test(activationError.message), activationError && activationError.message)
ok('failed activation registers nothing', badHost.event === undefined)

console.log('')
console.log(`self-test: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
