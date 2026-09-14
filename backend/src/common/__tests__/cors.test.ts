import type { ConfigService } from "@nestjs/config";
import { corsOrigins, DEFAULT_ORIGINS } from "../cors";

const cfg = (value?: string): ConfigService =>
  ({ get: () => value }) as unknown as ConfigService;

describe("corsOrigins", () => {
  it("parses a comma-separated list, trimming blanks", () => {
    expect(
      corsOrigins(cfg("https://a.com, https://b.com ,, https://c.com")),
    ).toEqual(["https://a.com", "https://b.com", "https://c.com"]);
  });

  it("falls back to dev defaults when unset or empty", () => {
    expect(corsOrigins(cfg(undefined))).toEqual(DEFAULT_ORIGINS);
    expect(corsOrigins(cfg("   "))).toEqual(DEFAULT_ORIGINS);
  });
});
