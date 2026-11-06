#!/usr/bin/env node
/**
 * 仓库自检：不依赖任何第三方包，可在本地与 CI 中运行。
 *
 *   node scripts/ci-check.mjs
 *
 * 覆盖：清单字段、files 白名单、patch 结构、row id 与导出名一致、
 * locale 元数据、CHANGELOG 首节与版本号一致、模块可导入。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(join(root, relative), 'utf8')

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

// ---------------------------------------------------------------- package.json
const pkg = JSON.parse(read('package.json'))
ok('package name is scoped', /^@[^/]+\/[^/]+$/.test(pkg.name), pkg.name)
ok('package name does not use the reserved @deepseek-ai scope', !pkg.name.startsWith('@deepseek-ai/'), pkg.name)
ok('version is a plain semver', /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version)
ok('type is module', pkg.type === 'module')
ok('main points at index.js', pkg.main === 'index.js')
ok('license declared', typeof pkg.license === 'string' && pkg.license.length > 0)
ok('repository points at this repo', String(pkg.repository?.url ?? '').includes('verneuil/dsh-ocg-session-head'))
ok('dsh.manifestVersion is 1', pkg.dsh?.manifestVersion === 1)
ok('dsh.bundle.patch declared', typeof pkg.dsh?.bundle?.patch === 'string')
ok('exports maps "." to index.js', pkg.exports?.['.'] === './index.js')
ok('exports exposes locale json', pkg.exports?.['./locale/*.json'] === './locale/*.json')

const patchPath = pkg.dsh?.bundle?.patch
ok('bundle patch file exists', typeof patchPath === 'string' && existsSync(join(root, patchPath)), patchPath)

const missing = (pkg.files ?? []).filter((entry) => !existsSync(join(root, entry)))
ok('every files entry exists on disk', missing.length === 0, missing.join(', '))
ok('files whitelist covers index.js and the patch', (pkg.files ?? []).includes('index.js') && (pkg.files ?? []).includes('cordis.patch.yml'))

// ---------------------------------------------------------------- cordis.patch.yml
const patch = read(patchPath)
ok('patch is a top-level YAML array', /^\s*-\s/m.test(patch))
ok('patch inserts a loader row', /^\s*-\s*insert:\s*$/m.test(patch))
ok('patch row references the installed package name', patch.includes(`name: '${pkg.name}'`) || patch.includes(`name: "${pkg.name}"`))

// ---------------------------------------------------------------- index.js
const indexSource = read('index.js')
const exported = indexSource.match(/export const name = '([^']+)'/)
ok('index exports a plugin name', Boolean(exported), exported?.[0])
ok('index exports an inject array', /export const inject = \[/.test(indexSource))
ok('index exports apply', /export function apply\(/.test(indexSource))
if (exported) {
  ok('patch row id matches the exported plugin name', new RegExp(`-\\s*id:\\s*${exported[1]}\\b`).test(patch), exported[1])
}
ok('index listens on the official waterfall event', indexSource.includes("ctx.on('llm-pi-ai/request-headers'"))

// ---------------------------------------------------------------- locale
for (const locale of ['locale/zh.json', 'locale/en.json']) {
  const exists = existsSync(join(root, locale))
  ok(`${locale} exists`, exists)
  if (!exists) continue
  let parsed
  try {
    parsed = JSON.parse(read(locale))
  } catch (error) {
    ok(`${locale} is valid JSON`, false, error instanceof Error ? error.message : String(error))
    continue
  }
  ok(`${locale} has meta.title`, typeof parsed.meta?.title === 'string' && parsed.meta.title.length > 0)
  ok(`${locale} has meta.description`, typeof parsed.meta?.description === 'string' && parsed.meta.description.length > 0)
}

// ---------------------------------------------------------------- CHANGELOG
const changelogExists = existsSync(join(root, 'CHANGELOG.md'))
ok('CHANGELOG.md exists', changelogExists)
if (changelogExists) {
  const firstSection = read('CHANGELOG.md').match(/^##\s+(\S+)\s*$/m)
  ok('CHANGELOG first section matches package version', firstSection?.[1] === pkg.version, `${firstSection?.[1]} vs ${pkg.version}`)
}

// ---------------------------------------------------------------- 语法/可导入
try {
  const mod = await import(pathToFileURL(join(root, 'index.js')).href)
  ok('index.js imports cleanly', typeof mod.apply === 'function' && typeof mod.name === 'string')
  ok('default export mirrors the named exports', mod.default?.name === mod.name && mod.default?.apply === mod.apply)
} catch (error) {
  ok('index.js imports cleanly', false, error instanceof Error ? error.message : String(error))
}

console.log('')
console.log(`ci-check: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
