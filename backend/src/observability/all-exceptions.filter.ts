import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import { MetricsService } from "../metrics/metrics.service";
import { captureException } from "./sentry";

/**
 * One global filter for REST and WS. It observes every thrown exception —
 * counting *server* errors (5xx / unknown) in the error metric and reporting
 * them to Sentry — then delegates to the framework's default rendering so the
 * client-facing error contract is unchanged. Expected 4xx (validation, "not
 * your turn", auth) are left alone: they are normal flow, not incidents.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly wsFilter = new BaseWsExceptionFilter();

  constructor(
    httpAdapterHost: HttpAdapterHost,
    private readonly metrics: MetricsService,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const scope = host.getType<"http" | "ws">();
    const isHttp = exception instanceof HttpException;
    const isWs = exception instanceof WsException;
    // Server error = an unexpected 5xx or a raw (non-framework) throw. Expected
    // HTTP 4xx and thrown WsExceptions are normal flow, not incidents.
    const serverError = isHttp ? exception.getStatus() >= 500 : !isWs;

    if (serverError) {
      const type =
        exception instanceof Error ? exception.constructor.name : "Unknown";
      this.metrics.incError(type, scope);
      captureException(exception, { scope });
    }

    if (scope === "ws") {
      // Never leak internals over the socket; wrap unknowns generically.
      const toEmit = isWs
        ? exception
        : new WsException(
            isHttp ? exception.message : "Internal server error.",
          );
      this.wsFilter.catch(toEmit, host);
      return;
    }

    super.catch(exception, host);
  }
}
