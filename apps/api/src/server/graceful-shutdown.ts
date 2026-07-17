import type { Server } from "node:http";

export interface ShutdownServer extends Pick<Server, "close"> {
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
}

export interface GracefulShutdownOptions {
  server: ShutdownServer;
  disconnect: () => Promise<void>;
  timeoutMs?: number;
  logger?: (message: string, details?: unknown) => void;
  exit?: (code: number) => void;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export type ShutdownSignalListener = (signal: NodeJS.Signals) => void;

export interface SignalHandlerTarget {
  once(event: NodeJS.Signals, listener: ShutdownSignalListener): unknown;
  removeListener(event: NodeJS.Signals, listener: ShutdownSignalListener): unknown;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

const closeServer = (server: ShutdownServer) =>
  new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const createGracefulShutdown = (options: GracefulShutdownOptions) => {
  let shutdownStarted = false;
  let shutdownPromise: Promise<number> | null = null;

  const shutdown = (signal: NodeJS.Signals | "manual" = "manual") => {
    if (shutdownStarted && shutdownPromise) {
      return shutdownPromise;
    }

    shutdownStarted = true;
    options.logger?.("[api] encerramento gracioso iniciado", { signal });

    const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

    shutdownPromise = new Promise<number>((resolve) => {
      let finished = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (code: number) => {
        if (finished) {
          return;
        }

        finished = true;
        if (timeout) {
          clearTimeoutFn(timeout);
        }
        options.exit?.(code);
        resolve(code);
      };

      timeout = setTimeoutFn(async () => {
        options.logger?.("[api] timeout no encerramento gracioso", { signal });
        options.server.closeAllConnections?.();

        try {
          await options.disconnect();
        } catch (error) {
          options.logger?.("[api] falha ao desconectar Prisma apos timeout", { signal, error });
        }

        finish(1);
      }, timeoutMs);

      void (async () => {
        try {
          options.server.closeIdleConnections?.();
          await closeServer(options.server);
          await options.disconnect();
          finish(0);
        } catch (error) {
          options.logger?.("[api] falha no encerramento gracioso", { signal, error });
          finish(1);
        }
      })();
    });

    return shutdownPromise;
  };

  return {
    shutdown,
    hasStarted: () => shutdownStarted,
  };
};

export const installGracefulShutdownHandlers = (
  shutdown: (signal: NodeJS.Signals) => Promise<number>,
  target: SignalHandlerTarget = process,
) => {
  const onSignal: ShutdownSignalListener = (signal) => {
    void shutdown(signal);
  };

  target.once("SIGTERM", onSignal);
  target.once("SIGINT", onSignal);

  return () => {
    target.removeListener("SIGTERM", onSignal);
    target.removeListener("SIGINT", onSignal);
  };
};
