import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env.js";

// Verifies the gateway's X-Signature header: HMAC-SHA256 of the raw request
// body, computed with GATEWAY_SECRET. Must run against the exact bytes
// received (see app.ts's express.json({ verify }) capturing rawBody) — a
// re-serialised JSON.stringify(parsed) does not reliably match.
export function verifyGatewaySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", env.gatewaySecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== gotBuf.length) return false;
  return timingSafeEqual(expectedBuf, gotBuf);
}
