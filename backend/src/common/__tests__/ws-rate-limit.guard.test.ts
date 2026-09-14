import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import { WsRateLimitGuard } from "../ws-rate-limit.guard";

const cfg = (values: Record<string, string>): ConfigService =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

/** Build an ExecutionContext whose ws client shares one socket.data object. */
const ctxFor = (socketData: Record<string, unknown>): ExecutionContext =>
  ({
    switchToWs: () => ({ getClient: () => ({ data: socketData }) }),
  }) as unknown as ExecutionContext;

describe("WsRateLimitGuard", () => {
  it("allows a burst up to capacity then rejects", () => {
    const guard = new WsRateLimitGuard(
      cfg({ WS_RATE_BURST: "3", WS_RATE_REFILL_PER_SEC: "0" }),
    );
    const data = {};
    const ctx = ctxFor(data);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
  });

  it("refills tokens over time", () => {
    const guard = new WsRateLimitGuard(
      cfg({ WS_RATE_BURST: "1", WS_RATE_REFILL_PER_SEC: "10" }),
    );
    const data = {};
    const ctx = ctxFor(data);

    const now = 1_000_000;
    const spy = jest.spyOn(Date, "now");
    spy.mockReturnValue(now);
    expect(guard.canActivate(ctx)).toBe(true); // spend the only token
    expect(() => guard.canActivate(ctx)).toThrow(WsException); // empty

    spy.mockReturnValue(now + 200); // 0.2s * 10/s = 2 tokens (capped at 1)
    expect(guard.canActivate(ctx)).toBe(true);
    spy.mockRestore();
  });

  it("keeps a separate bucket per socket", () => {
    const guard = new WsRateLimitGuard(
      cfg({ WS_RATE_BURST: "1", WS_RATE_REFILL_PER_SEC: "0" }),
    );
    const a = ctxFor({});
    const b = ctxFor({});
    expect(guard.canActivate(a)).toBe(true);
    expect(() => guard.canActivate(a)).toThrow(WsException);
    expect(guard.canActivate(b)).toBe(true); // b unaffected by a
  });
});
