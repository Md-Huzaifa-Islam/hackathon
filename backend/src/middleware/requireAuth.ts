import type { NextFunction, Request, Response } from "express";
import { auth } from "@/lib/auth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: req.headers as unknown as Headers });
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  (req as Request & { userId?: string }).userId = session.user.id;
  next();
}
