import { describe, expect, it, vi } from "vitest";

import {
  createGracefulShutdown,
  installGracefulShutdownHandlers,
  type ShutdownServer,
  type ShutdownSignalListener,
  type SignalHandlerTarget,
} from "../src/server/graceful-shutdown";

const createImmediateTimer = () => {
  const setTimeoutFn = vi.fn((_callback: () => void, _timeoutMs: number) => {
    return { id: "timer" } as unknown as NodeJS.Timeout;
  });
  const clearTimeoutFn = vi.fn();

  return { setTimeoutFn, clearTimeoutFn };
};

describe("graceful shutdown", () => {
  it("fecha servidor, encerra conexões ociosas, desconecta Prisma e finaliza com código 0", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const closeIdleConnections = vi.fn();
    const closeAllConnections = vi.fn();
    const disconnect = vi.fn(async () => undefined);
    const exit = vi.fn();
    const timer = createImmediateTimer();

    const gracefulShutdown = createGracefulShutdown({
      server: {
        close,
        closeIdleConnections,
        closeAllConnections,
      },
      disconnect,
      exit,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });

    await expect(gracefulShutdown.shutdown("SIGTERM")).resolves.toBe(0);

    expect(gracefulShutdown.hasStarted()).toBe(true);
    expect(closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(closeAllConnections).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("é idempotente quando chamado mais de uma vez", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const disconnect = vi.fn(async () => undefined);
    const timer = createImmediateTimer();
    const gracefulShutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });

    const first = gracefulShutdown.shutdown("SIGTERM");
    const second = gracefulShutdown.shutdown("SIGINT");

    await expect(first).resolves.toBe(0);
    await expect(second).resolves.toBe(0);
    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("retorna código de falha quando disconnect falha", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const disconnect = vi.fn(async () => {
      throw new Error("disconnect failed");
    });
    const exit = vi.fn();
    const logger = vi.fn();
    const timer = createImmediateTimer();

    const gracefulShutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      logger,
      exit,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });

    await expect(gracefulShutdown.shutdown("SIGTERM")).resolves.toBe(1);

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger).toHaveBeenCalledWith("[api] falha no encerramento gracioso", expect.any(Object));
  });

  it("força conexões e retorna falha no timeout", async () => {
    let timeoutCallback: (() => void) | undefined;
    const setTimeoutFn = vi.fn((callback: () => void, _timeoutMs: number) => {
      timeoutCallback = callback;
      return { id: "timer" } as unknown as NodeJS.Timeout;
    });
    const clearTimeoutFn = vi.fn();
    const close = vi.fn((_callback: (error?: Error) => void) => undefined);
    const closeAllConnections = vi.fn();
    const disconnect = vi.fn(async () => undefined);
    const exit = vi.fn();
    const gracefulShutdown = createGracefulShutdown({
      server: {
        close,
        closeAllConnections,
      },
      disconnect,
      exit,
      setTimeoutFn,
      clearTimeoutFn,
      timeoutMs: 10,
    });

    const shutdownPromise = gracefulShutdown.shutdown("SIGTERM");
    timeoutCallback?.();

    await expect(shutdownPromise).resolves.toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("tolera timer injetado que executa imediatamente", async () => {
    const setTimeoutFn = vi.fn((callback: () => void, _timeoutMs: number) => {
      callback();
      return { id: "timer" } as unknown as NodeJS.Timeout;
    });
    const clearTimeoutFn = vi.fn();
    const close = vi.fn((_callback: (error?: Error) => void) => undefined);
    const closeAllConnections = vi.fn();
    const disconnect = vi.fn(async () => undefined);
    const gracefulShutdown = createGracefulShutdown({
      server: {
        close,
        closeAllConnections,
      },
      disconnect,
      setTimeoutFn,
      clearTimeoutFn,
      timeoutMs: 10,
    });

    await expect(gracefulShutdown.shutdown("SIGTERM")).resolves.toBe(1);
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("instala handlers para SIGTERM e SIGINT e remove sem duplicar", async () => {
    const listeners = new Map<NodeJS.Signals, ShutdownSignalListener>();
    const target: SignalHandlerTarget = {
      once: vi.fn((event: NodeJS.Signals, listener: ShutdownSignalListener) => {
        listeners.set(event, listener);
      }),
      removeListener: vi.fn((event: NodeJS.Signals, listener: ShutdownSignalListener) => {
        if (listeners.get(event) === listener) {
          listeners.delete(event);
        }
      }),
    };
    const shutdown = vi.fn(async () => 0);

    const uninstall = installGracefulShutdownHandlers(shutdown, target);
    listeners.get("SIGTERM")?.("SIGTERM");
    listeners.get("SIGINT")?.("SIGINT");
    uninstall();

    expect(target.once).toHaveBeenCalledTimes(2);
    expect(shutdown).toHaveBeenCalledWith("SIGTERM");
    expect(shutdown).toHaveBeenCalledWith("SIGINT");
    expect(target.removeListener).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it("aceita servidor mínimo sem métodos opcionais do Node 20", async () => {
    const server: ShutdownServer = {
      close: vi.fn((callback: (error?: Error) => void) => callback()),
    };
    const timer = createImmediateTimer();
    const gracefulShutdown = createGracefulShutdown({
      server,
      disconnect: vi.fn(async () => undefined),
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });

    await expect(gracefulShutdown.shutdown("SIGINT")).resolves.toBe(0);
    expect(server.close).toHaveBeenCalledTimes(1);
  });
});
