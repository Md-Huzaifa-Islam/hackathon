import { Router } from "express";
import { prisma } from "@/lib/prisma.js";

export const healthRouter = Router();

// Must stay gateway-independent and respond in <1s even if the payment
// gateway is down. Do not add any gateway calls here.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch {
    // DB down is still reported, but the endpoint itself must not hang.
    res.status(200).json({ status: "degraded" });
  }
});
