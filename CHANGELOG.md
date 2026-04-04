# @puntoycoma/paddlehook — Changelog

## [1.1.1](https://github.com/PuntoyComaTech/paddlehook/compare/v1.1.0...v1.1.1) (2026-04-04)


### Bug Fixes

* **security:** validate hex input, guard maxAge, catch onVerified errors ([006a1e5](https://github.com/PuntoyComaTech/paddlehook/commit/006a1e5f11d7e7f7d57d31069d7e860a5b6d3e85))

## [1.1.0](https://github.com/PuntoyComaTech/paddlehook/compare/v1.0.0...v1.1.0) (2026-04-04)


### Features

* add typed Paddle events with discriminated unions ([f959b5c](https://github.com/PuntoyComaTech/paddlehook/commit/f959b5ca9b97ae2aee5b4231d51fa5647ee3a168))


### Bug Fixes

* validate event structure after JSON.parse ([a11b128](https://github.com/PuntoyComaTech/paddlehook/commit/a11b128f7fa5d348eb8f7a43326a435a33f47976))

## 1.0.0 (2026-04-04)


### Features

* add onVerified callback and split env types ([e15e7bc](https://github.com/PuntoyComaTech/paddlehook/commit/e15e7bce75d076fba94da3a1c6176c5a0887e591))


### Bug Fixes

* handle backend fetch failures and extract jsonResponse helper ([26fbff7](https://github.com/PuntoyComaTech/paddlehook/commit/26fbff72453221db204d844c209bb109247ffeba))
* resolve TypeScript 6 strict ArrayBuffer generics ([e2d1e1e](https://github.com/PuntoyComaTech/paddlehook/commit/e2d1e1e731ce62c8d87c880ed2319a0345736ace))
* **security:** use crypto.subtle.verify and add replay protection ([ef4d740](https://github.com/PuntoyComaTech/paddlehook/commit/ef4d7403fdade714691eb38e64fe131ef5935afc))
* update repository URLs to match GitHub repo name ([0780176](https://github.com/PuntoyComaTech/paddlehook/commit/0780176f0d3bf1250a5a5a9ca16caa8d8b90d241))

## 1.0.0

### Features

- `createPaddleWebhookHandler()` — webhook handler factory with proxy and custom modes
- `onVerified` callback — handle verified payloads with custom logic (queues, storage, etc.)
- `verifyPaddleSignature()` — HMAC-SHA256 signature verification using Web Crypto API
- Timestamp replay protection with configurable `maxAge` (default 5 minutes)
- Response status mapping: backend 2xx/4xx/5xx mapped to appropriate Paddle retry behavior
- Graceful handling of unreachable backends (502)
- Runtime agnostic — works on Cloudflare Workers, Deno, Bun, Vercel Edge, Node 18+
- Zero runtime dependencies
- Full TypeScript support with exported types (`PaddleBaseEnv`, `PaddleWorkerEnv`, `HandlerOptions`, `VerifyOptions`)
