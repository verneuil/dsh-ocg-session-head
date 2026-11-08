<div align="center">

<img src="icon.svg" width="96" height="96" alt="OCG Session Head icon" />

# OCG Session Head (@verneuil/dsh-ocg-session-head)

**Injects a per-conversation `x-opencode-session` request header for OpenCode Go routes**

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red.svg)](README.zh.md)

[![CI](https://github.com/verneuil/dsh-ocg-session-head/actions/workflows/ci.yml/badge.svg)](https://github.com/verneuil/dsh-ocg-session-head/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![version](https://img.shields.io/github/v/tag/verneuil/dsh-ocg-session-head?label=version&color=4b8bf5)](https://github.com/verneuil/dsh-ocg-session-head/releases/latest)
[![npm](https://img.shields.io/npm/v/@verneuil/dsh-ocg-session-head?label=npm&color=cb3837)](https://www.npmjs.com/package/@verneuil/dsh-ocg-session-head)
[![downloads](https://img.shields.io/npm/dw/@verneuil/dsh-ocg-session-head?label=downloads&color=cb3837)](https://www.npmjs.com/package/@verneuil/dsh-ocg-session-head)
[![provenance](https://img.shields.io/badge/provenance-GitHub%20Actions-blueviolet)](https://www.npmjs.com/package/@verneuil/dsh-ocg-session-head)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.2-4b8bf5)](https://github.com/verneuil/dsh-ocg-session-head#2-version-requirements-important)

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/verneuil/dsh-ocg-session-head)

[Changelog](CHANGELOG.md) · [Issues](https://github.com/verneuil/dsh-ocg-session-head/issues)

</div>

---

> ### ⚠️ Read this first: if either condition below does not apply, you do not need this plugin
>
> **1) Your host must be DeepSeek Harness 0.2.2 or newer**
>
> The plugin does exactly one thing: it writes a header inside the header seat the host officially provides
> (the `llm-pi-ai/request-headers` waterfall). That seat only appeared in **0.2.2-alpha.3** and became stable
> in 0.2.2-rc.1 — **older versions simply do not have this foundation**. Installing it on an older host does
> not error out, but it **never takes effect** — it looks like “installed but useless”, when in fact there is
> nowhere for it to hook into.
>
> **2) It only matters for OpenCode connected under a custom provider name**
>
> - If you added OpenCode / OpenCode Go through DSH's **official path** (using pi-ai's built-in
>   `opencode` / `opencode-go` routes), recent pi-ai already adds the session header **automatically** —
>   **you do not need this plugin**, and installing it is pure redundancy.
> - Only when you connect like this — **you really do use an OpenCode service, but the provider name is your
>   own** (a hand-written `baseURL` plus `api: openai-completions`, say you call it `ocg`) — is that automatic
>   wrapping out of reach, and this plugin is what supplies the header.
>
> In one sentence: **official path → no plugin needed; custom name → use this plugin.**

This is a **replacement** for `dsh-opencode-session` (the fetch monkey-patch): it does not replace
`globalThis.fetch` and does not use `AsyncLocalStorage` — it only writes one header inside the seat the host
reserves for exactly this purpose.

- Repository: <https://github.com/verneuil/dsh-ocg-session-head>
- Self-test: `node scripts/self-test.mjs` (zero dependencies, no host required)

---

## 1. Why it is needed

Since 2026-09-05, OpenCode Go requires every inference request to carry a stable `x-opencode-session`,
otherwise it returns:

```
400 {"type":"MissingSessionID", ...}
```

pi-ai already wraps the **built-in** `opencode` / `opencode-go` routes; but a **custom-named** route
(your own name, hand-written `baseURL` + `api: openai-completions`) never gets that wrapping, so a plugin has
to supply the header.

> Not sure which case you are? See item 2 of “Read this first” above.

## 2. Version requirements (important)

| Item | Requirement |
|---|---|
| DSH | **≥ 0.2.2** (the `llm-pi-ai/request-headers` seat arrived in 0.2.2-alpha.3; available from the 0.2.2 line) |
| Node | No extra requirement (pure ESM, zero dependencies) |

Installing on an **older** host is safe: the plugin loads and logs its ready line, but the event never
fires → behaviour equals not installing it (OCG still returns 400). **This makes “install first, upgrade
later” a valid step-by-step verification path.**

## 3. Installation

### 3.1 From npm (recommended)

Install `@verneuil/dsh-ocg-session-head` in DSH's plugin manager (or pin a version, e.g.
`@verneuil/dsh-ocg-session-head@0.1.1`), or add it to the profile's `package.json` directly:

```json
"@verneuil/dsh-ocg-session-head": "^0.1.1"
```

### 3.2 Offline / local tarball

> ⚠️ **Never point the installer at a package directory.** pnpm turns directories into `link:` (junction)
> entries, module resolution degrades to plain Node behaviour, DSH's resolution interceptor no longer applies
> and the entry fails with `failed to import`. **Only a tarball is unpacked into a real directory inside the
> profile.**

Reference it as `file:` in the profile's `dependencies`:

```json
"@verneuil/dsh-ocg-session-head": "file:<your absolute path>/dsh-ocg-session-head-<version>.tgz"
```

Then install with DSH's bundled node/pnpm (no system npm required):

```powershell
$node   = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm   = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
$target = Join-Path $env:DSH_HOME 'profiles\desktop'
& $node $pnpm install --dir $target
```

Either way, **restart DSH** afterwards (restarting kills the AI processes inside the host, so it must be done
by hand).

## 4. Configuration

`cordis.patch.yml` ships defaults; you can also override them by id in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-ocg-session-head
  config:
    providers:
      - ocg
    debug: true
```

> Overriding by id **replaces the whole config object**.

| Key | Default | Meaning |
|---|---|---|
| `providers` | `['ocg']` | Provider-key allowlist, matched exactly against `provider` in the event |
| `hostSuffixes` | `['opencode.ai']` | baseURL host-suffix allowlist; the two gates are OR-ed, the host gate is the fallback when you rename the route |
| `header` | `x-opencode-session` | Header name to inject; must be a valid HTTP header name |
| `mode` | `session-id` | `session-id`: use the host conversation id (stable across turns, compaction and restarts); `uuid`: derive an opaque uuid that is stable within the process |
| `debug` | `false` | Log one line per successful injection |
| `maxTrackedSessions` | `4096` | Session map cap in `uuid` mode; the oldest entry is evicted first |

### Config validation (errors are loud)

Following the official “misconfiguration should be loud” principle, **an invalid config fails plugin
activation and names the offending field** — it never falls back silently.

| Situation | Behaviour |
|---|---|
| Key not set (`undefined`) | Default is used |
| Unknown key (likely a typo) | ❌ Error, valid keys listed |
| `providers` / `hostSuffixes` not a string array, or containing empty/duplicate items | ❌ Error, offending index reported |
| `header` empty or not a valid HTTP header name | ❌ Error |
| `header` points at a Harness attribution header (`user-agent`, `x-deepseek-harness-*`) | ❌ Error (the host overwrites it after all contributors, so writing it would be useless) |
| `mode` is neither `session-id` nor `uuid` | ❌ Error |
| `debug` not a boolean, `maxTrackedSessions` not a positive integer | ❌ Error |
| `providers` and `hostSuffixes` **both empty** | ❌ Error (nothing could ever match) |

> Array semantics: “not set” means the default; **passing an empty array explicitly disables that gate**.
> For example `hostSuffixes: []` matches by provider key only, with no baseURL host fallback.

## 5. Behaviour guarantees

- **An existing header always wins**: static `headers` config, the official implementation and other plugins
  are never overwritten.
- **No session id, no injection**: auxiliary calls without a `sessionId` pass through untouched.
- **Fail open**: any internal error only logs a warning line and then calls `next()`; this plugin never breaks
  an inference call.
- **No global side effects**: no `globalThis` mutation, no `fetch` replacement, no file writes.
- **Disposed with the plugin**: the listener is registered via `ctx.on()` and follows the fiber lifecycle.

## 6. Verification (four checks)

1. **Ready line**: the host console shows
   `[dsh-ocg-session-head] ready (header=x-opencode-session mode=session-id providers=ocg ...)`
2. **Injection line**: with `debug` enabled, every model call shows
   `[dsh-ocg-session-head] x-opencode-session=<id> provider=ocg model=... purpose=chat`
3. **Real request 200**: normal conversations never return 400 `MissingSessionID`.
4. **Counter-proof**: disable the plugin and the 400 comes back immediately — proving the header was coming
   from it.

## 7. Uninstall and rollback

- Uninstall from the plugin manager, or remove the package from the profile's `dependencies` and reinstall.
- The older plugin `dsh-opencode-session` **can coexist** (both let existing headers win: this implementation
  writes first, the older one then no-ops). During migration, **keep the old plugin installed but disabled**,
  so you can switch back in 30 seconds.

## 8. Development and packaging

```powershell
# self-test (zero dependencies, no host required)
node scripts/self-test.mjs

# pack with DSH's bundled runtime (no system node/pnpm needed)
$node = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = Join-Path $env:DSH_HOME 'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
& $node $pnpm pack
```

Local test packages may be named `<version>-rc.<YYYYMMDD-HHmm>` (bump the version temporarily → pack →
revert immediately).

## 9. Known limitations

- Only **pi-ai routes** are covered (`@deepseek-ai/dsh-llm-pi-ai`). `deepseek-official` goes through
  `@deepseek-ai/dsh-llm-deepseek`, which sends its own `x-deepseek-harness-session-id` and is unrelated.
- **Model discovery is not covered** (the host contract explicitly says the event `excludes model discovery`).
- The event is **synchronous**: a listener must mutate `headers` in place and `return next()` immediately, and
  must not retain the object reference.
- `engines.dsh` is declared as `>=0.2.2-alpha.3`. The host evaluates compatibility with
  `includePrerelease: true`, so a plain `>=0.2.2` would reject `0.2.2-rc.1`, and `>=0.2.2-rc.1` would reject a
  future `0.2.3-rc.1`. Anchoring at the alpha that introduced the header seat accepts both the stable line and
  every later RC, while anything below `0.2.2` is correctly rejected.

## License

MIT
