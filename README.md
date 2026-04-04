# @puntoycoma/paddlehook

[![npm version](https://img.shields.io/npm/v/@puntoycoma/paddlehook)](https://www.npmjs.com/package/@puntoycoma/paddlehook)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@puntoycoma/paddlehook)](https://bundlephobia.com/package/@puntoycoma/paddlehook)
[![CI](https://github.com/PuntoyComaTech/paddlehook/actions/workflows/ci.yml/badge.svg)](https://github.com/PuntoyComaTech/paddlehook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Typed Paddle webhook verification for any edge runtime — HMAC-SHA256 signatures, replay protection, and fully typed events in 3.34 KB with zero runtime dependencies.

## Why paddlehook?

- **Secure** — HMAC-SHA256 signature verification via `crypto.subtle.verify()` (Web Crypto API, constant-time comparison) with built-in replay attack protection
- **Typed events** — Discriminated union of all Paddle billing event types; TypeScript narrows `event.data` automatically per event
- **Tiny** — 3.34 KB minified, zero runtime dependencies, no supply chain risk
- **Universal** — Works on Cloudflare Workers, Supabase Edge Functions, Deno, Bun, Vercel Edge, Netlify Edge, Hono, and Node.js 18+
- **Flexible** — Proxy mode for instant setup; `onVerified` callback for queues, databases, or any custom Paddle payments processing
- **Filterable** — Pass an `events` array to ignore event types your app doesn't care about

## Architecture

```
Paddle billing platform
        │
        │  POST /webhook
        │  Paddle-Signature: ts=…;h1=…
        ▼
┌────────────────────┐
│    paddlehook      │  ← HMAC-SHA256 verify + replay check
│                    │
│  proxy mode        │  → forwards raw body to TARGET_URL
│  onVerified mode   │  → calls your handler with typed PaddleWebhookEvent
└────────────────────┘
        │
        ▼
  Your backend / queue / database
```

## Install

```bash
npm install @puntoycoma/paddlehook
# or
bun add @puntoycoma/paddlehook
# or
pnpm add @puntoycoma/paddlehook
```

## Quick Start

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

export default {
  fetch: createPaddleWebhookHandler(),
}
```

Set three environment variables and Paddle webhook verification is live:

| Variable | Description |
|----------|-------------|
| `PADDLE_WEBHOOK_SECRET` | Signing secret from Paddle Dashboard > Developer Tools > Notifications |
| `TARGET_URL` | Your backend endpoint (e.g. `https://api.example.com/webhooks/paddle`) |
| `INTERNAL_AUTH_TOKEN` | Bearer token sent to your backend in the `Authorization` header |

## Two Modes

### Proxy mode (default)

Verifies the Paddle webhook signature, then forwards the raw body to your backend with a Bearer token. Your backend receives the same JSON Paddle sent — no transformation.

Use proxy mode when your backend already handles Paddle event logic and you just need a verified relay at the edge.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

// Requires: PADDLE_WEBHOOK_SECRET, TARGET_URL, INTERNAL_AUTH_TOKEN
export default {
  fetch: createPaddleWebhookHandler(),
}
```

### Custom mode (onVerified)

Verifies the signature, parses the payload into a typed `PaddleWebhookEvent`, then calls your function. You own the response — enqueue, store, process inline, anything.

Use custom mode when you want to react to Paddle payments events directly at the edge: push to a queue, write to a database, or run conditional logic based on event type.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

// Only requires: PADDLE_WEBHOOK_SECRET
const handler = createPaddleWebhookHandler({
  onVerified: (event, env) => {
    // event is a fully typed PaddleWebhookEvent — no JSON.parse needed
    console.log(event.event_type, event.data)
    return new Response(null, { status: 202 })
  },
})

export default { fetch: handler }
```

## Typed Events

`PaddleWebhookEvent` is a discriminated union — TypeScript narrows `event.data` automatically when you check `event.event_type`.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"
import type { PaddleWebhookEvent, SubscriptionData, TransactionData } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler({
  onVerified: (event) => {
    switch (event.event_type) {
      case "subscription.activated":
      case "subscription.canceled":
      case "subscription.updated": {
        // event.data is SubscriptionData here
        const sub = event.data as SubscriptionData
        console.log(sub.id, sub.status, sub.customer_id)
        break
      }

      case "transaction.completed":
      case "transaction.paid": {
        // event.data is TransactionData here
        const tx = event.data as TransactionData
        console.log(tx.id, tx.status, tx.customer_id)
        break
      }

      default: {
        // All other Paddle billing events — log and acknowledge
        console.log("unhandled event:", event.event_type)
      }
    }

    return new Response(null, { status: 200 })
  },
})
```

### Filter to specific events

Use the `events` option to tell paddlehook which Paddle event types to process. Other event types receive a `200 { ok: true, skipped: true }` response immediately — no work done, Paddle stays happy.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler({
  events: ["subscription.activated", "subscription.canceled", "transaction.completed"],
  onVerified: (event) => {
    // Only called for the three event types above
    return new Response(null, { status: 200 })
  },
})
```

`PaddleEventType` covers all documented Paddle events — your editor will autocomplete valid values.

## Runtime Examples

### Cloudflare Workers

The runtime injects `env` per request automatically — no setup beyond the handler.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

export default {
  fetch: createPaddleWebhookHandler(),
}
```

### Supabase Edge Functions / Deno / Netlify Edge

All Deno-based runtimes read env vars with `Deno.env.get()`.

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

### Bun / Node.js 18+ / Vercel Edge

All `process.env` runtimes follow the same pattern.

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const env = {
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET!,
  TARGET_URL: process.env.TARGET_URL!,
  INTERNAL_AUTH_TOKEN: process.env.INTERNAL_AUTH_TOKEN!,
}

const handler = createPaddleWebhookHandler()

// Bun
Bun.serve({ fetch: (req) => handler(req, env) })

// Node.js 18+
import { serve } from "@hono/node-server" // or any http adapter
serve({ fetch: (req) => handler(req, env) })

// Vercel Edge
export default (req: Request) => handler(req, env)
export const config = { runtime: "edge" }
```

### Hono (any runtime)

Hono runs on Cloudflare Workers, Deno, Bun, Node.js — anywhere Hono runs, paddlehook works.

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

## Using onVerified

### Enqueue to a queue system

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

// Cloudflare Queue — env is typed to include the binding
const handler = createPaddleWebhookHandler<Env>({
  onVerified: (event, env) => {
    // event is already parsed — send it directly to the queue
    env.PADDLE_QUEUE.send(event)
    return new Response(null, { status: 202 })
  },
})

// Same pattern for AWS SQS, Redis, BullMQ, Upstash, etc.
// Verification happens first; your callback only runs on valid Paddle payloads.
```

### Custom event processing

```typescript
import { createPaddleWebhookHandler } from "@puntoycoma/paddlehook"

const handler = createPaddleWebhookHandler({
  events: ["subscription.canceled", "subscription.updated"],
  onVerified: async (event, env) => {
    // No JSON.parse needed — event is already a typed PaddleWebhookEvent
    if (event.event_type === "subscription.canceled") {
      await db.subscriptions.update({
        where: { paddleId: event.data.id },
        data: { status: "canceled" },
      })
    }

    return new Response(null, { status: 200 })
  },
})
```

### Low-level: verifyPaddleSignature

Use the verification function directly if you manage your own request lifecycle.

```typescript
import { verifyPaddleSignature } from "@puntoycoma/paddlehook"

const isValid = await verifyPaddleSignature(
  request.headers.get("paddle-signature"),
  await request.text(),
  env.PADDLE_WEBHOOK_SECRET,
  { maxAge: 300 } // optional — default 300s, set 0 to disable replay protection
)

if (!isValid) {
  return new Response("Unauthorized", { status: 401 })
}
```

## Response Mapping (proxy mode)

| Backend response | paddlehook returns | Paddle behavior |
|------------------|--------------------|-----------------|
| 2xx | 200 | Success, no retry |
| 4xx | 400 | Client error, no retry |
| 5xx | 500 | Server error, Paddle retries |
| Unreachable | 502 | Gateway error, Paddle retries |

## API Reference

### `createPaddleWebhookHandler(options?)`

Factory that creates a Paddle webhook handler for any edge runtime. Verifies HMAC-SHA256 signatures and either proxies the payload to your backend or calls your `onVerified` callback.

```typescript
const handler = createPaddleWebhookHandler<TEnv>(options?)
// Returns: (request: Request, env: TEnv) => Promise<Response>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.events` | `PaddleEventType[]` | Optional. Only call `onVerified` for these event types. Others receive `200 { ok: true, skipped: true }`. |
| `options.onVerified` | `(event: PaddleWebhookEvent, env: TEnv) => Response \| Promise<Response>` | Optional. Custom handler called after successful verification. Omit to use proxy mode. |

### `verifyPaddleSignature(header, rawBody, secret, options?)`

Low-level Paddle webhook HMAC-SHA256 signature verification using the Web Crypto API.

| Parameter | Type | Description |
|-----------|------|-------------|
| `header` | `string \| null` | `Paddle-Signature` header value |
| `rawBody` | `string` | Raw request body (unparsed string) |
| `secret` | `string` | Paddle webhook signing secret |
| `options.maxAge` | `number` | Max signature age in seconds. Default `300`. Set `0` to disable replay protection. |

Returns `Promise<boolean>`.

## Types

```typescript
// Environment shapes
interface PaddleBaseEnv {
  PADDLE_WEBHOOK_SECRET: string
}

interface PaddleWorkerEnv extends PaddleBaseEnv {
  TARGET_URL: string
  INTERNAL_AUTH_TOKEN: string
}

// Handler options
interface HandlerOptions<TEnv extends PaddleBaseEnv> {
  events?: PaddleEventType[]
  onVerified?: (event: PaddleWebhookEvent, env: TEnv) => Response | Promise<Response>
}

// Verify options
interface VerifyOptions {
  maxAge?: number
}

// Event envelope — discriminated union on event_type
type PaddleWebhookEvent =
  | PaddleEvent<"subscription.activated", SubscriptionData>
  | PaddleEvent<"subscription.canceled", SubscriptionData>
  | PaddleEvent<"subscription.created", SubscriptionData>
  | PaddleEvent<"subscription.updated", SubscriptionData>
  | PaddleEvent<"transaction.completed", TransactionData>
  | PaddleEvent<"transaction.paid", TransactionData>
  | PaddleEvent<"customer.created", CustomerData>
  | PaddleEvent<"adjustment.created", AdjustmentData>
  // ... all Paddle billing event types

// Available data types
// SubscriptionData, TransactionData, CustomerData, AdjustmentData
```

All types are exported from `@puntoycoma/paddlehook`.

## Security

- **HMAC-SHA256** verification via `crypto.subtle.verify()` — constant-time comparison, no timing attacks
- **Replay protection** — rejects signatures older than 5 minutes by default (configurable via `maxAge`)
- **Method guard** — non-POST requests are rejected with `405` before any processing
- **Zero runtime dependencies** — no third-party code executes in your edge function
- **npm provenance** — published with attestation for verifiable, auditable builds

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
bun install     # install dependencies
bun test        # run 30 tests
bun run build   # build for production
```

## License

[MIT](LICENSE)

---

<p align="center">
  Developed by <a href="https://github.com/PuntoyComaTech"><strong>PuntoyComaTech</strong></a>
</p>

<p align="center">
  <a href="https://www.youtube.com/@PuntoyComaTech">YouTube</a> &bull;
  <a href="https://www.linkedin.com/in/gabriel-rubio99/">LinkedIn</a> &bull;
  <a href="https://x.com/PuntoyComaTech">X</a> &bull;
  <a href="https://www.instagram.com/puntoycomatech">Instagram</a> &bull;
  <a href="https://www.tiktok.com/@puntoycomatech">TikTok</a>
</p>
