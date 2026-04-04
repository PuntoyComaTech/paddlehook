# Changelog

## 0.1.0

### Features

- `createPaddleWebhookHandler()` — factory for Paddle webhook proxy handlers
- `verifyPaddleSignature()` — HMAC-SHA256 signature verification using Web Crypto API
- Timestamp replay protection with configurable `maxAge` (default 5 minutes)
- Response status mapping: backend 2xx/4xx/5xx mapped to appropriate Paddle retry behavior
- Graceful handling of unreachable backends (502)
- Zero runtime dependencies
- Full TypeScript support with exported types (`PaddleWorkerEnv`, `VerifyOptions`)
