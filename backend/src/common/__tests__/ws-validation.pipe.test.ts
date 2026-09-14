import type { ArgumentMetadata } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { WsValidationPipe } from "../ws-validation.pipe";
import { SubscribeDto } from "../../games/dto/subscribe.dto";

const meta: ArgumentMetadata = {
  type: "body",
  metatype: SubscribeDto,
  data: "",
};

describe("WsValidationPipe", () => {
  const pipe = new WsValidationPipe();

  it("accepts and returns a well-formed payload", async () => {
    const out = await pipe.transform({ gameId: "abc123" }, meta);
    expect(out).toBeInstanceOf(SubscribeDto);
    expect(out.gameId).toBe("abc123");
  });

  it("rejects a missing/blank required field as a WsException", async () => {
    await expect(pipe.transform({}, meta)).rejects.toBeInstanceOf(WsException);
    await expect(pipe.transform({ gameId: "" }, meta)).rejects.toBeInstanceOf(
      WsException,
    );
  });

  it("rejects wrong types", async () => {
    await expect(
      pipe.transform({ gameId: 123 }, meta),
    ).rejects.toBeInstanceOf(WsException);
  });

  it("forbids unknown/smuggled fields", async () => {
    await expect(
      pipe.transform({ gameId: "abc", isAdmin: true }, meta),
    ).rejects.toBeInstanceOf(WsException);
  });
});
