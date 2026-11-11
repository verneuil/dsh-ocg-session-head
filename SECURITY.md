# Security Policy

## Supported versions

Only the latest published version of `@verneuil/dsh-ocg-session-head` is supported.

| Version | Supported |
|---|---|
| `0.1.x` (latest) | ✅ |
| anything older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private reporting: go to the repository's **Security** tab and choose **Report a vulnerability**.
The maintainer will discuss the issue privately and publish a security advisory once a fix is ready.

Please include:

- the affected plugin version and the DeepSeek Harness version you run;
- what happens (and what you expected instead);
- a minimal reproduction, if possible;
- the impact you believe the issue has.

## Scope

**In scope:** this plugin's code (`index.js`), its package manifest, and the bundled loader patch
(`cordis.patch.yml`).

The plugin is a zero-dependency, host-side listener. It writes one request header inside the host's
official `llm-pi-ai/request-headers` waterfall and nothing else: it does not replace `fetch`, touch the
filesystem or network, read environment variables, or mutate `globalThis`.

**Out of scope:** vulnerabilities in DeepSeek Harness itself, in the pi-ai provider layer, or in
OpenCode Go — please report those to the respective upstream project.

## Response

This is a single-maintainer project, maintained on a best-effort basis. Reports are acknowledged as soon
as possible, usually within a week; a fix and advisory follow once the report is confirmed.

---

## 中文说明

- **支持范围**：只支持最新发布的 `0.1.x` 版本。
- **报告方式**：请勿公开提 issue。到仓库 **Security** 页 → **Report a vulnerability** 私下提交，
  附上插件版本、DSH 版本、现象、最小复现与影响评估。
- **不在范围内**：DeepSeek Harness 本体、pi-ai 供应商层、OpenCode Go 服务的问题，请报给各自上游。
- **响应**：个人维护项目，尽力尽快回复，通常一周内确认；确认后先修复再发布安全公告。
