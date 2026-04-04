# @puntoycoma/paddlehook

[![npm version](https://img.shields.io/npm/v/@puntoycoma/paddlehook)](https://www.npmjs.com/package/@puntoycoma/paddlehook)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@puntoycoma/paddlehook)](https://bundlephobia.com/package/@puntoycoma/paddlehook)
[![CI](https://github.com/PuntoyComaTech/paddlehook/actions/workflows/ci.yml/badge.svg)](https://github.com/PuntoyComaTech/paddlehook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Lightweight Paddle webhook verification and proxy for any edge runtime. Verify HMAC-SHA256 signatures, prevent replay attacks, and forward verified payloads to your backend or custom handler — in under 3 KB with zero dependencies.

## Why paddlehook?

- **Secure** — HMAC-SHA256 verification via `crypto.subtle.verify()` with replay protection
- **Tiny** — Under 3 KB minified, zero runtime dependencies
- **Universal** — Works on Cloudflare Workers, Deno, Bun, Vercel Edge, Hono, Node 18+
- **Flexible** — Proxy mode for quick setup, `onVerified` callback for custom logic (queues, databases, etc.)
- **Type-safe** — Full TypeScript support with exported types

## Install

```bash
npm install @puntoycoma/paddlehook
# or
bun add @puntoycoma/paddlehook
# or
pnpm add @puntoycoma/paddlehook
```

## Quick Start

### Proxy mode (default)

Verifies the Paddle webhook signature and forwards the payload to your backend with a Bearer token.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler()

export default { fetch: handler }
```

Set three environment variables and you're done:

| Variable | Description |
|----------|-------------|
| `PADDLE_WEBHOOK_SECRET` | Signing secret from Paddle Dashboard > Developer Tools > Notifications |
| `TARGET_URL` | Your backend endpoint (e.g. `https://api.example.com/webhooks/paddle`) |
| `INTERNAL_AUTH_TOKEN` | Bearer token sent to your backend in the `Authorization` header |

### Custom mode (onVerified)

Verifies the Paddle webhook signature and gives you the raw payload. You decide what happens next — enqueue, store, process inline, anything.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler({
  onVerified: (payload) =>
    new Response(JSON.stringify({ received: true }), { status: 202 }),
})
```

In custom mode you only need `PADDLE_WEBHOOK_SECRET`.

## Runtime Examples

### Cloudflare Workers

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"
import type { PaddleWorkerEnv } from "@puntoycoma/paddlehook"

export default {
  fetch: createPaddleWebhookHandler<PaddleWorkerEnv>(),
}
```

### Deno

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const env = {
  PADDLE_WEBHOOK_SECRET: Deno.env.get("PADDLE_WEBHOOK_SECRET")!,
  TARGET_URL: Deno.env.get("TARGET_URL")!,
  INTERNAL_AUTH_TOKEN: Deno.env.get("INTERNAL_AUTH_TOKEN")!,
}

const handler = createPaddleWebhookHandler()

Deno.serve((request) => handler(request, env))
```

### Bun

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const env = {
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET!,
  TARGET_URL: process.env.TARGET_URL!,
  INTERNAL_AUTH_TOKEN: process.env.INTERNAL_AUTH_TOKEN!,
}

const handler = createPaddleWebhookHandler()

Bun.serve({
  fetch: (request) => handler(request, env),
})
```

### Hono

```typescript
import { Hono } from "hono"
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const app = new Hono()
const handler = createPaddleWebhookHandler()

app.post("/webhook/paddle", (c) =>
  handler(c.req.raw, {
    PADDLE_WEBHOOK_SECRET: c.env.PADDLE_WEBHOOK_SECRET,
    TARGET_URL: c.env.TARGET_URL,
    INTERNAL_AUTH_TOKEN: c.env.INTERNAL_AUTH_TOKEN,
  })
)

export default app
```

### Vercel Edge Functions

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const env = {
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET!,
  TARGET_URL: process.env.TARGET_URL!,
  INTERNAL_AUTH_TOKEN: process.env.INTERNAL_AUTH_TOKEN!,
}

const handler = createPaddleWebhookHandler()

export default (request: Request) => handler(request, env)

export const config = { runtime: "edge" }
```

## Using onVerified

When you provide `onVerified`, the handler skips the proxy and calls your function with the verified payload. Use this for queues, databases, or any custom processing.

### Enqueue to any queue system

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

// Cloudflare Queue
const handler = createPaddleWebhookHandler({
  onVerified: (payload, env) => {
    env.PADDLE_QUEUE.send(payload)
    return new Response(null, { status: 202 })
  },
})

// AWS SQS, Redis, BullMQ, or anything else — same pattern:
// verify first, then do whatever you need.
```

### Custom event processing

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler({
  onVerified: (payload) => {
    const event = JSON.parse(payload)

    if (event.event_type === "subscription.canceled") {
      // handle cancellation
    }

    return new Response(null, { status: 200 })
  },
})
```

### Low-level: verifyPaddleSignature

Use the verification function directly if you don't need the handler.

```typescript
import { verifyPaddleSignature } from "@puntoycoma/paddlehook"

const isValid = await verifyPaddleSignature(
  request.headers.get("paddle-signature"),
  await request.text(),
  env.PADDLE_WEBHOOK_SECRET,
  { maxAge: 300 } // optional, default 300s, set 0 to disable
)
```

## Response Mapping (proxy mode)

| Backend Response | paddlehook Returns | Paddle Behavior |
|-----------------|-------------------|-----------------|
| 2xx | 200 | Success, no retry |
| 4xx | 400 | Client error, no retry |
| 5xx | 500 | Server error, Paddle retries |
| Unreachable | 502 | Gateway error, Paddle retries |

## API Reference

### `createPaddleWebhookHandler(options?)`

Creates a Paddle webhook handler for any edge runtime. Verifies HMAC-SHA256 signatures and either proxies to your backend or delegates to your callback.

```typescript
// Proxy mode (default)
const handler = createPaddleWebhookHandler()

// Custom mode
const handler = createPaddleWebhookHandler({
  onVerified: (payload, env) => Response | Promise<Response>
})
```

Returns `(request: Request, env: TEnv) => Promise<Response>`.

### `verifyPaddleSignature(header, rawBody, secret, options?)`

Low-level Paddle webhook HMAC-SHA256 signature verification using the Web Crypto API.

| Parameter | Type | Description |
|-----------|------|-------------|
| `header` | `string \| null` | `Paddle-Signature` header value |
| `rawBody` | `string` | Raw request body (not parsed JSON) |
| `secret` | `string` | Your Paddle webhook secret |
| `options` | `VerifyOptions` | Optional. `{ maxAge?: number }` — max signature age in seconds. Default `300`. Set `0` to disable replay protection. |

### Types

```typescript
interface PaddleBaseEnv {
  PADDLE_WEBHOOK_SECRET: string
}

interface PaddleWorkerEnv extends PaddleBaseEnv {
  TARGET_URL: string
  INTERNAL_AUTH_TOKEN: string
}

interface HandlerOptions<TEnv extends PaddleBaseEnv> {
  onVerified?: (payload: string, env: TEnv) => Response | Promise<Response>
}

interface VerifyOptions {
  maxAge?: number
}
```

## Security

- **HMAC-SHA256** verification via `crypto.subtle.verify()` (Web Crypto API, constant-time comparison)
- **Replay protection** rejects signatures older than 5 minutes by default (configurable via `maxAge`)
- **Zero runtime dependencies** — no supply chain risk
- **Provenance** — published with npm provenance for verifiable builds

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
bun install     # install dependencies
bun test        # run tests
bun run build   # build for production
```

## License

[MIT](LICENSE) - PuntoyComaTech
