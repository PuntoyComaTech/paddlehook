export interface VerifyOptions {
  maxAge?: number
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * 2
    bytes[i] = parseInt(hex.slice(offset, offset + 2), 16)
  }
  return bytes
}

const encoder = new TextEncoder()

/**
 * Verify a Paddle webhook signature using Web Crypto API (HMAC-SHA256).
 *
 * CF Workers do NOT have Node.js crypto — this uses crypto.subtle exclusively.
 *
 * @param header  - The `Paddle-Signature` header value
 * @param rawBody - The raw request body string (NOT parsed JSON)
 * @param secret  - Your PADDLE_WEBHOOK_SECRET
 * @param options - Optional configuration (maxAge in seconds, default 300)
 * @returns true if the signature is valid
 */
export async function verifyPaddleSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  options?: VerifyOptions
): Promise<boolean> {
  if (!header) return false

  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const idx = p.indexOf("=")
      if (idx === -1) return [p, ""]
      return [p.slice(0, idx), p.slice(idx + 1)]
    })
  )

  const ts = parts["ts"]
  const h1 = parts["h1"]
  if (!ts || !h1) return false

  const maxAge = options?.maxAge ?? 300
  if (maxAge > 0) {
    const now = Math.floor(Date.now() / 1000)
    const timestamp = parseInt(ts, 10)
    if (isNaN(timestamp) || Math.abs(now - timestamp) > maxAge) return false
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )

  const h1Bytes = hexToBytes(h1)
  const dataBytes = encoder.encode(`${ts}:${rawBody}`)

  return crypto.subtle.verify("HMAC", key, h1Bytes, dataBytes)
}
