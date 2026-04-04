/**
 * Verify a Paddle webhook signature using Web Crypto API (HMAC-SHA256).
 *
 * CF Workers do NOT have Node.js crypto — this uses crypto.subtle exclusively.
 *
 * @param header  - The `Paddle-Signature` header value
 * @param rawBody - The raw request body string (NOT parsed JSON)
 * @param secret  - Your PADDLE_WEBHOOK_SECRET
 * @returns true if the signature is valid
 */
export async function verifyPaddleSignature(
  header: string | null,
  rawBody: string,
  secret: string
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

  const computed = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== h1.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i)
  }
  return diff === 0
}
