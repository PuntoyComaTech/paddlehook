import { describe, expect, it, afterEach, mock } from "bun:test"
import { createPaddleWebhookHandler } from "../src/handler"
import type { PaddleWorkerEnv } from "../src/types"

const SECRET = "test-webhook-secret-handler"
const TARGET_URL = "https://backend.example.com/api/webhooks/paddle"
const AUTH_TOKEN = "internal-auth-token-xyz"

const env: PaddleWorkerEnv = {
  PADDLE_WEBHOOK_SECRET: SECRET,
  TARGET_URL,
  INTERNAL_AUTH_TOKEN: AUTH_TOKEN,
}

async function createSignedRequest(body: string): Promise<Request> {
  const ts = Math.floor(Date.now() / 1000).toString()
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${ts}:${body}`)
  )
  const hex = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return new Request("https://worker.example.com/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Paddle-Signature": `ts=${ts};h1=${hex}`,
    },
    body,
  })
}

const SAMPLE_BODY = JSON.stringify({
  event_type: "subscription.created",
  event_id: "evt_test_123",
  data: { id: "sub_123" },
})

interface JsonBody {
  ok?: boolean
  error?: string
}

describe("createPaddleWebhookHandler", () => {
  const handler = createPaddleWebhookHandler<PaddleWorkerEnv>()
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns 405 for non-POST requests", async () => {
    const request = new Request("https://worker.example.com/webhook", {
      method: "GET",
    })
    const response = await handler(request, env)
    expect(response.status).toBe(405)
    const body = (await response.json()) as JsonBody
    expect(body.error).toBe("Method not allowed")
  })

  it("returns 401 for invalid signature", async () => {
    const request = new Request("https://worker.example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Paddle-Signature": "ts=1234567890;h1=invalid",
      },
      body: SAMPLE_BODY,
    })
    const response = await handler(request, env)
    expect(response.status).toBe(401)
    const body = (await response.json()) as JsonBody
    expect(body.error).toBe("Invalid signature")
  })

  it("returns 401 when signature header is missing", async () => {
    const request = new Request("https://worker.example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: SAMPLE_BODY,
    })
    const response = await handler(request, env)
    expect(response.status).toBe(401)
  })

  it("returns 200 when backend responds 200", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    ) as unknown as typeof fetch

    const request = await createSignedRequest(SAMPLE_BODY)
    const response = await handler(request, env)

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body.ok).toBe(true)
  })

  it("returns 200 when backend responds 201", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 201 }))
    ) as unknown as typeof fetch

    const request = await createSignedRequest(SAMPLE_BODY)
    const response = await handler(request, env)

    expect(response.status).toBe(200)
  })

  it("returns 400 when backend responds 4xx", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "bad" }), { status: 422 }))
    ) as unknown as typeof fetch

    const request = await createSignedRequest(SAMPLE_BODY)
    const response = await handler(request, env)

    expect(response.status).toBe(400)
    const body = (await response.json()) as JsonBody
    expect(body.error).toBe("Backend rejected the request")
  })

  it("returns 500 when backend responds 5xx", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 503 }))
    ) as unknown as typeof fetch

    const request = await createSignedRequest(SAMPLE_BODY)
    const response = await handler(request, env)

    expect(response.status).toBe(500)
    const body = (await response.json()) as JsonBody
    expect(body.error).toBe("Backend error")
  })

  it("returns 502 when backend is unreachable", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("DNS resolution failed"))) as unknown as typeof fetch
    const request = await createSignedRequest(SAMPLE_BODY)
    const response = await handler(request, env)
    expect(response.status).toBe(502)
    const body = (await response.json()) as JsonBody
    expect(body.error).toBe("Backend unreachable")
  })

  it("forwards original body and Authorization header to backend", async () => {
    const mockFetch = mock((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    )
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const request = await createSignedRequest(SAMPLE_BODY)
    await handler(request, env)

    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(TARGET_URL)
    expect(calledInit.method).toBe("POST")
    expect((calledInit.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${AUTH_TOKEN}`
    )
    expect((calledInit.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    )
    expect(calledInit.body).toBe(SAMPLE_BODY)
  })
})
