import type { PaddleBaseEnv, PaddleWorkerEnv, HandlerOptions } from "./types"
import type { PaddleWebhookEvent } from "./events"
import { verifyPaddleSignature } from "./verify"

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Factory that creates a Paddle webhook handler for any edge runtime.
 *
 * Default: verifies HMAC signature and proxies to TARGET_URL.
 * With onVerified: verifies signature and delegates to your callback.
 */
export function createPaddleWebhookHandler<TEnv extends PaddleBaseEnv = PaddleWorkerEnv>(
  options?: HandlerOptions<TEnv>
) {
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

    // Parse and validate the event envelope
    let event: PaddleWebhookEvent
    try {
      const parsed = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== "object" || !("event_type" in parsed)) {
        return jsonResponse({ error: "Invalid event structure" }, 400)
      }
      event = parsed as PaddleWebhookEvent
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }

    // Filter by event type if configured
    if (options?.events && !options.events.includes(event.event_type)) {
      return jsonResponse({ ok: true, skipped: true }, 200)
    }

    if (options?.onVerified) {
      return options.onVerified(event, env)
    }

    const proxyEnv = env as unknown as PaddleWorkerEnv
    if (!proxyEnv.TARGET_URL || !proxyEnv.INTERNAL_AUTH_TOKEN) {
      return jsonResponse({ error: "TARGET_URL and INTERNAL_AUTH_TOKEN are required in proxy mode" }, 500)
    }
    let backendResponse: Response
    try {
      backendResponse = await fetch(proxyEnv.TARGET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${proxyEnv.INTERNAL_AUTH_TOKEN}`,
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
