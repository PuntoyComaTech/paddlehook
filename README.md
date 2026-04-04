# @puntoycoma/paddle-cf-worker

Lightweight Paddle webhook proxy for Cloudflare Workers with HMAC-SHA256 verification.

Sits between Paddle and your backend: verifies webhook signatures at the edge, then proxies valid requests to your API with an internal auth token.

```
Paddle --> CF Worker (verify HMAC) --> Your Backend
```

## Install

```bash
npm install @puntoycoma/paddle-cf-worker
```

## Quick Start

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddle-cf-worker"
import type { PaddleWorkerEnv } from "@puntoycoma/paddle-cf-worker"

const handleWebhook = createPaddleWebhookHandler<PaddleWorkerEnv>()

export default {
  async fetch(request: Request, env: PaddleWorkerEnv): Promise<Response> {
    return handleWebhook(request, env)
  },
}
```

### With custom env bindings

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddle-cf-worker"
import type { PaddleWorkerEnv } from "@puntoycoma/paddle-cf-worker"

interface Env extends PaddleWorkerEnv {
  MY_KV: KVNamespace
}

const handleWebhook = createPaddleWebhookHandler<Env>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/webhook/paddle") {
      return handleWebhook(request, env)
    }

    return new Response("Not found", { status: 404 })
  },
}
```

## Environment Variables

Configure these as secrets in your Cloudflare Worker:

| Variable | Description |
|----------|-------------|
| `PADDLE_WEBHOOK_SECRET` | Your Paddle webhook signing secret (from Paddle Dashboard > Developer Tools > Notifications) |
| `TARGET_URL` | The backend URL to proxy verified webhooks to (e.g. `https://api.example.com/webhooks/paddle`) |
| `INTERNAL_AUTH_TOKEN` | Bearer token sent to your backend in the `Authorization` header |

```bash
npx wrangler secret put PADDLE_WEBHOOK_SECRET
npx wrangler secret put TARGET_URL
npx wrangler secret put INTERNAL_AUTH_TOKEN
```

## Response Mapping

The worker maps your backend's response status to a status that controls Paddle's retry behavior:

| Backend Response | Worker Returns | Paddle Behavior |
|-----------------|---------------|-----------------|
| 2xx | 200 | Success, no retry |
| 4xx | 400 | Client error, no retry |
| 5xx | 500 | Server error, Paddle retries |
| Unreachable | 502 | Gateway error, Paddle retries |

## API Reference

### `createPaddleWebhookHandler<TEnv>()`

Factory that returns a webhook handler function.

```typescript
const handler = createPaddleWebhookHandler<PaddleWorkerEnv>()
// handler: (request: Request, env: TEnv) => Promise<Response>
```

The handler:
- Rejects non-POST requests with `405`
- Verifies the `Paddle-Signature` header (returns `401` if invalid)
- Forwards the raw body to `TARGET_URL` with a `Bearer` authorization header
- Maps the backend response status (see table above)

### `verifyPaddleSignature(header, rawBody, secret, options?)`

Low-level signature verification. Use this if you need custom handling instead of the full proxy handler.

```typescript
import { verifyPaddleSignature } from "@puntoycoma/paddle-cf-worker"

const isValid = await verifyPaddleSignature(
  request.headers.get("paddle-signature"),
  await request.text(),
  env.PADDLE_WEBHOOK_SECRET,
  { maxAge: 300 } // optional, default: 300 seconds
)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `header` | `string \| null` | The `Paddle-Signature` header value |
| `rawBody` | `string` | The raw request body (not parsed JSON) |
| `secret` | `string` | Your Paddle webhook secret |
| `options` | `VerifyOptions` | Optional. `{ maxAge?: number }` — max signature age in seconds. Default `300`. Set to `0` to disable. |

### `PaddleWorkerEnv`

TypeScript interface for the required environment bindings.

```typescript
interface PaddleWorkerEnv {
  PADDLE_WEBHOOK_SECRET: string
  TARGET_URL: string
  INTERNAL_AUTH_TOKEN: string
}
```

### `VerifyOptions`

```typescript
interface VerifyOptions {
  maxAge?: number // seconds, default 300, set 0 to disable
}
```

## Security

- **HMAC-SHA256** verification using `crypto.subtle.verify()` (Web Crypto API, no Node.js dependencies)
- **Replay protection** rejects signatures older than 5 minutes by default (configurable via `maxAge`)
- **Zero runtime dependencies** — runs entirely on Cloudflare Workers built-in APIs

## License

[MIT](LICENSE)
