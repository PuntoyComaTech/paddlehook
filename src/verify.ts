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

const SIGNATURE_PATTERN = /^[0-9a-fA-F]{64}$/

function parseSignatureHeader(header: string): { ts: string | undefined; signatures: string[] } {
  let ts: string | undefined
  const signatures: string[] = []
  for (const part of header.split(";")) {
    const [key, value = ""] = part.split("=", 2)
    if (key === "ts") ts = value
    if (key === "h1" && SIGNATURE_PATTERN.test(value)) signatures.push(value)
  }
  return { ts, signatures }
}

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

  const { ts, signatures } = parseSignatureHeader(header)
  if (!ts || signatures.length === 0) return false

  const maxAge = Math.max(options?.maxAge ?? 300, 0)
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

  const signedPayload = encoder.encode(`${ts}:${rawBody}`)
  const results = await Promise.all(
    signatures.map((signature) => crypto.subtle.verify("HMAC", key, hexToBytes(signature), signedPayload))
  )
  return results.includes(true)
}
