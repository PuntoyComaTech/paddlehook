import { describe, expect, it } from "bun:test"
import { verifyPaddleSignature } from "../src/verify"

async function createValidSignature(
  rawBody: string,
  secret: string,
  ts: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${ts}:${rawBody}`)
  )
  const hex = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `ts=${ts};h1=${hex}`
}

describe("verifyPaddleSignature", () => {
  const secret = "test-webhook-secret-1234"
  const body = '{"event_type":"subscription.created","event_id":"evt_123"}'

  it("returns true for a valid signature", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(true)
  })

  it("returns false for an invalid signature", async () => {
    const header = "ts=1234567890;h1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(false)
  })

  it("returns false when header is null", async () => {
    const result = await verifyPaddleSignature(null, body, secret)
    expect(result).toBe(false)
  })

  it("returns false when header is missing ts", async () => {
    const result = await verifyPaddleSignature("h1=abc123", body, secret)
    expect(result).toBe(false)
  })

  it("returns false when header is missing h1", async () => {
    const result = await verifyPaddleSignature("ts=1234567890", body, secret)
    expect(result).toBe(false)
  })

  it("returns false when header is empty string", async () => {
    const result = await verifyPaddleSignature("", body, secret)
    expect(result).toBe(false)
  })

  it("returns false when body differs from signed payload", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, "tampered-body", secret)
    expect(result).toBe(false)
  })

  it("returns false when secret differs", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, "wrong-secret")
    expect(result).toBe(false)
  })
})
