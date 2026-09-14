import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  type ArgumentsHost,
} from "@nestjs/common";
import { BaseExceptionFilter, type HttpAdapterHost } from "@nestjs/core";
import { WsException } from "@nestjs/websockets";
import type { MetricsService } from "../../metrics/metrics.service";
import { AllExceptionsFilter } from "../all-exceptions.filter";

jest.mock("../sentry", () => ({
  captureException: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { captureException } = require("../sentry") as {
  captureException: jest.Mock;
};

const adapterHost = { httpAdapter: {} } as unknown as HttpAdapterHost;

const httpHost = (): ArgumentsHost =>
  ({
    getType: () => "http",
    switchToHttp: () => ({ getResponse: () => ({}), getRequest: () => ({}) }),
  }) as unknown as ArgumentsHost;

const wsHost = (client: { emit: jest.Mock }): ArgumentsHost =>
  ({
    getType: () => "ws",
    switchToWs: () => ({
      getClient: () => client,
      getPattern: () => "event",
      getData: () => ({}),
    }),
  }) as unknown as ArgumentsHost;

describe("AllExceptionsFilter", () => {
  let metrics: { incError: jest.Mock };
  let filter: AllExceptionsFilter;
  let superCatch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    metrics = { incError: jest.fn() };
    filter = new AllExceptionsFilter(
      adapterHost,
      metrics as unknown as MetricsService,
    );
    // Stub the framework's HTTP rendering — we only assert our own behaviour.
    superCatch = jest
      .spyOn(BaseExceptionFilter.prototype, "catch")
      .mockImplementation(() => undefined);
  });

  afterEach(() => superCatch.mockRestore());

  it("counts + reports HTTP 5xx / unknown errors", () => {
    filter.catch(new InternalServerErrorException(), httpHost());
    filter.catch(new Error("boom"), httpHost());
    expect(metrics.incError).toHaveBeenCalledTimes(2);
    expect(metrics.incError).toHaveBeenCalledWith("Error", "http");
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(superCatch).toHaveBeenCalledTimes(2); // response still rendered
  });

  it("ignores expected HTTP 4xx (normal flow, not incidents)", () => {
    filter.catch(new BadRequestException(), httpHost());
    filter.catch(new ForbiddenException(), httpHost());
    expect(metrics.incError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledTimes(2);
  });

  it("emits over the socket for WS errors and never leaks internals", () => {
    const client = { emit: jest.fn() };

    // Expected WsException: passed through, not counted.
    filter.catch(new WsException("nope"), wsHost(client));
    expect(metrics.incError).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith("exception", expect.anything());

    // Unknown server error over WS: counted + reported + genericised.
    client.emit.mockClear();
    filter.catch(new Error("db exploded"), wsHost(client));
    expect(metrics.incError).toHaveBeenCalledWith("Error", "ws");
    expect(captureException).toHaveBeenCalledTimes(1);
    const emitted = JSON.stringify(client.emit.mock.calls[0]);
    expect(emitted).not.toContain("db exploded");
  });
});
