import { describe, expect, it } from "bun:test"
import { verifyPaddleSignature } from "../src/verify"
import { signPayload } from "./helpers"

const createValidSignature = signPayload

describe("verifyPaddleSignature", () => {
  const secret = "test-webhook-secret-1234"
  const body = '{"event_type":"subscription.created","event_id":"evt_123"}'

  it("returns true for a valid signature", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(true)
  })

  it("accepts any valid h1 while Paddle rotates secrets", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const signed = await createValidSignature(body, secret, ts)
    const header = `ts=${ts};h1=${"0".repeat(64)};${signed.split(";")[1]}`
    expect(await verifyPaddleSignature(header, body, secret)).toBe(true)
  })

  it("returns false when no h1 matches during rotation", async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const header = `ts=${ts};h1=${"0".repeat(64)};h1=${"f".repeat(64)}`
    expect(await verifyPaddleSignature(header, body, secret)).toBe(false)
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

  it("returns false when timestamp is too old (default 300s tolerance)", async () => {
    const ts = (Math.floor(Date.now() / 1000) - 600).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(false)
  })

  it("returns true when timestamp is within tolerance", async () => {
    const ts = (Math.floor(Date.now() / 1000) - 100).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(true)
  })

  it("returns true when maxAge is 0 (disabled) even with old timestamp", async () => {
    const ts = (Math.floor(Date.now() / 1000) - 600).toString()
    const header = await createValidSignature(body, secret, ts)
    const result = await verifyPaddleSignature(header, body, secret, { maxAge: 0 })
    expect(result).toBe(true)
  })

  it("returns false when h1 has non-hex characters", async () => {
    const header = "ts=1234567890;h1=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(false)
  })

  it("returns false when h1 length is not 64", async () => {
    const header = "ts=1234567890;h1=deadbeef"
    const result = await verifyPaddleSignature(header, body, secret)
    expect(result).toBe(false)
  })
})
