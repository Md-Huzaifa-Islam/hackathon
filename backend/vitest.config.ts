import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    env: { NODE_ENV: "test" },
    // Integration tests hit a real (possibly remote, pooled) database —
    // vitest's 5s default is tuned for local/in-memory work and is too
    // tight once DATABASE_URL points off-host.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
