# @puntoycoma/paddlehook — Changelog

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
