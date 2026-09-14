import { ValidationPipe, type ValidationError } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";

/**
 * The socket-message equivalent of the global REST `ValidationPipe`. Strict
 * whitelisting strips unknown keys and `forbidNonWhitelisted` rejects them, so
 * an attacker can't smuggle extra fields through a gateway handler. Validation
 * failures surface as a structured `WsException` (delivered to the client as an
 * `exception` event) instead of a raw stack trace.
 */
export class WsValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new WsException({
          code: "BAD_PAYLOAD",
          message: "Invalid socket payload.",
          details: errors.map((e) => ({
            field: e.property,
            constraints: e.constraints,
          })),
        }),
    });
  }
}
