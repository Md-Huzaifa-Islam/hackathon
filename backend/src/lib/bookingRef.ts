import { randomBytes } from "node:crypto";

export function generateBookingRef(): string {
  return `bk_${randomBytes(6).toString("hex")}`;
}
