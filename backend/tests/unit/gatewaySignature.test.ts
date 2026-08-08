import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGatewaySignature } from "@/lib/gatewaySignature.js";
import { env } from "@/config/env.js";

function sign(body: string) {
  return createHmac("sha256", env.gatewaySecret).update(Buffer.from(body)).digest("hex");
}

describe("verifyGatewaySignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event_id: "evt_1", status: "SUCCEEDED" });
    expect(verifyGatewaySignature(Buffer.from(body), sign(body))).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event_id: "evt_1", status: "SUCCEEDED" });
    const wrongSig = createHmac("sha256", "not-the-secret").update(Buffer.from(body)).digest("hex");
    expect(verifyGatewaySignature(Buffer.from(body), wrongSig)).toBe(false);
  });

  it("rejects a body that was tampered with after signing", () => {
    const original = JSON.stringify({ event_id: "evt_1", status: "SUCCEEDED" });
    const sig = sign(original);
    const tampered = JSON.stringify({ event_id: "evt_1", status: "REFUNDED" });
    expect(verifyGatewaySignature(Buffer.from(tampered), sig)).toBe(false);
  });

  it("rejects a missing signature", () => {
    const body = JSON.stringify({ event_id: "evt_1" });
    expect(verifyGatewaySignature(Buffer.from(body), undefined)).toBe(false);
  });
});
