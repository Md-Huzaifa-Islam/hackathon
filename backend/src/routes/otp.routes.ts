import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { sendOtp, verifyOtp } from "@/lib/gatewayClient.js";

export const otpRouter = Router();

const RESEND_COOLDOWN_MS = 10_000;

// POST /otp/send { phone, ref } — ref is the booking_ref. Also serves as
// "resend": the gateway has no concept of resend, it's just another
// /otp/send call, so the 10% non-delivery rate is handled by letting the
// client call this again rather than the backend retrying internally.
otpRouter.post("/otp/send", async (req, res) => {
  const { phone, ref } = req.body ?? {};
  if (!phone || !ref) return res.status(400).json({ error: "phone and ref required" });

  const existing = await prisma.otpRequest.findUnique({ where: { ref } });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return res.status(429).json({
      error: "resend_cooldown",
      retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime()),
    });
  }

  await sendOtp(phone, ref, `${env.callbackBaseUrl}/otp/callback`);

  await prisma.otpRequest.upsert({
    where: { ref },
    create: { ref, phone, attempts: 1 },
    update: { attempts: { increment: 1 }, lastSentAt: new Date(), delivered: false },
  });

  res.status(202).json({ sent: true });
});

// POST /otp/verify { ref, code } — verification is authoritative on the
// gateway's side; we just relay its answer and distinguish "wrong code"
// (client should let the user retry) from "gateway unreachable" (client
// should show a transient error, not blame the code).
otpRouter.post("/otp/verify", async (req, res) => {
  const { ref, code } = req.body ?? {};
  if (!ref || !code) return res.status(400).json({ error: "ref and code required" });

  const result = await verifyOtp(ref, code);
  if (!result.ok) {
    return res.status(502).json({ error: "gateway_unreachable" });
  }
  res.status(result.verified ? 200 : 400).json({ verified: result.verified });
});

// POST /otp/callback — the gateway's async OTP delivery notification.
// Informational only (the mock's own /otp/verify is still authoritative);
// used so the UI can show "delivered" vs. "still waiting, try resend".
otpRouter.post("/otp/callback", async (req, res) => {
  const { ref, delivered } = req.body ?? {};
  if (ref) {
    await prisma.otpRequest
      .update({ where: { ref }, data: { delivered: Boolean(delivered ?? true) } })
      .catch(() => undefined);
  }
  res.status(200).json({ received: true });
});

// GET /otp/status/:ref — polled by the client to know whether the OTP has
// been marked delivered yet (surfacing the "resend" option honestly).
otpRouter.get("/otp/status/:ref", async (req, res) => {
  const otp = await prisma.otpRequest.findUnique({ where: { ref: req.params.ref } });
  if (!otp) return res.status(404).json({ error: "not_found" });
  res.json({ delivered: otp.delivered, attempts: otp.attempts, lastSentAt: otp.lastSentAt });
});
