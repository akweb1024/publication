import { describe, expect, it } from "vitest";
import { loadEnv } from "./config.js";

describe("worker config", () => {
  it("parses defaults", () => {
    const env = loadEnv();
    expect(env.SMTP_PORT).toBeGreaterThan(0);
  });
});

