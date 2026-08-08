import { Router } from "express";
import { sendOtp, verifyOtp } from "@/lib/gatewayClient.js";

export const otpRouter = Router();

otpRouter.post("/otp/send", async (req, res) => {
  const { phone, ref } = req.body ?? {};
  if (!phone || !ref) return res.status(400).json({ error: "phone and ref required" });
  await sendOtp(phone, ref);
  res.status(202).json({ sent: true });
});

otpRouter.post("/otp/verify", async (req, res) => {
  const { ref, code } = req.body ?? {};
  if (!ref || !code) return res.status(400).json({ error: "ref and code required" });
  const result = await verifyOtp(ref, code);
  if (!result) return res.status(400).json({ verified: false });
  res.status(200).json({ verified: true });
});
