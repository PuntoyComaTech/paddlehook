import type { PaddleWorkerEnv } from "./types"
import { verifyPaddleSignature } from "./verify"

/**
 * Factory that creates a Paddle webhook proxy handler for Cloudflare Workers.
 *
 * Flow: Paddle -> CF Worker (verify HMAC) -> POST to backend -> return status to Paddle.
 *
 * Response mapping:
 * - Backend 2xx -> 200 to Paddle
 * - Backend 4xx -> 400 to Paddle (no retry)
 * - Backend 5xx -> 500 to Paddle (Paddle retries)
 */
export function createPaddleWebhookHandler<TEnv extends PaddleWorkerEnv>() {
  return async (request: Request, env: TEnv): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const rawBody = await request.text()
    const signatureHeader = request.headers.get("paddle-signature")

    const valid = await verifyPaddleSignature(
      signatureHeader,
      rawBody,
      env.PADDLE_WEBHOOK_SECRET
    )

    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const backendResponse = await fetch(env.TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.INTERNAL_AUTH_TOKEN}`,
      },
      body: rawBody,
    })

    const status = backendResponse.status

    if (status >= 200 && status < 300) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (status >= 400 && status < 500) {
      return new Response(
        JSON.stringify({ error: "Backend rejected the request" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // 5xx or any other unexpected status -> 500 so Paddle retries
    return new Response(
      JSON.stringify({ error: "Backend error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
