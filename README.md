# @puntoycoma/paddlehook

Lightweight Paddle webhook verification and proxy for any edge runtime.

Verifies HMAC-SHA256 signatures at the edge, then either proxies to your backend or hands you the verified payload to do whatever you want.

```
Paddle --> paddlehook (verify HMAC) --> Your backend / queue / anything
```

Zero runtime dependencies. Works on Cloudflare Workers, Deno, Bun, Vercel Edge, Node 18+.

## Install

```bash
npm install @puntoycoma/paddlehook
```

## Quick Start

### Proxy mode (default)

Verifies the signature and forwards the payload to your backend with a Bearer token.

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

Verifies the signature and gives you the raw payload. You decide what to do next.

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

When you provide `onVerified`, the handler skips the proxy and calls your function with the verified payload.

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

### Custom processing

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

If you don't want the handler at all, use the verification function directly.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `header` | `string \| null` | `Paddle-Signature` header value |
| `rawBody` | `string` | Raw request body (not parsed JSON) |
| `secret` | `string` | Your Paddle webhook secret |
| `options` | `VerifyOptions` | Optional. `{ maxAge?: number }` — default `300`, set `0` to disable |

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

- **HMAC-SHA256** via `crypto.subtle.verify()` (Web Crypto API)
- **Replay protection** rejects signatures older than 5 minutes by default (configurable via `maxAge`)
- **Zero runtime dependencies**

## License

[MIT](LICENSE)
