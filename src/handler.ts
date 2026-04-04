import type { PaddleWorkerEnv } from "./types"
import { verifyPaddleSignature } from "./verify"

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

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
      return jsonResponse({ error: "Method not allowed" }, 405)
    }

    const rawBody = await request.text()
    const signatureHeader = request.headers.get("paddle-signature")

    const valid = await verifyPaddleSignature(
      signatureHeader,
      rawBody,
      env.PADDLE_WEBHOOK_SECRET
    )

    if (!valid) {
      return jsonResponse({ error: "Invalid signature" }, 401)
    }

    let backendResponse: Response
    try {
      backendResponse = await fetch(env.TARGET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.INTERNAL_AUTH_TOKEN}`,
        },
        body: rawBody,
      })
    } catch {
      return jsonResponse({ error: "Backend unreachable" }, 502)
    }

    const status = backendResponse.status

    if (status >= 200 && status < 300) {
      return jsonResponse({ ok: true }, 200)
    }

    if (status >= 400 && status < 500) {
      return jsonResponse({ error: "Backend rejected the request" }, 400)
    }

    // 5xx or any other unexpected status -> 500 so Paddle retries
    return jsonResponse({ error: "Backend error" }, 500)
  }
}
