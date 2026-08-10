import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events: string[] = [];

  return {
    events,
    listen: vi.fn((_port: number, callback: () => void) => {
      events.push("listen");
      callback();
      return { close: vi.fn() };
    }),
    bootstrap: vi.fn(() => {
      events.push("bootstrap");
      return Promise.resolve();
    }),
    createGracefulShutdown: vi.fn(() => ({
      shutdown: vi.fn(),
    })),
    installGracefulShutdownHandlers: vi.fn(),
    disconnectPrisma: vi.fn(),
  };
});

vi.mock("../src/app", () => ({
  app: {
    listen: mocks.listen,
  },
}));

vi.mock("../src/config/env", () => ({
  env: {
    port: 3333,
  },
}));

vi.mock("../src/database/prisma", () => ({
  disconnectPrisma: mocks.disconnectPrisma,
}));

vi.mock("../src/knowledge/corpus-bootstrap", () => ({
  startGovernedCorpusBootstrap: mocks.bootstrap,
}));

vi.mock("../src/server/graceful-shutdown", () => ({
  createGracefulShutdown: mocks.createGracefulShutdown,
  installGracefulShutdownHandlers: mocks.installGracefulShutdownHandlers,
}));

describe("server startup corpus bootstrap", () => {
  afterEach(() => {
    mocks.events.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("dispara bootstrap assincrono depois que o servidor começa a escutar", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { startServer } = await import("../src/server");

    const result = startServer();

    expect(mocks.listen).toHaveBeenCalledWith(3333, expect.any(Function));
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.events).toEqual(["listen", "bootstrap"]);
    expect(result.server).toBeDefined();
    expect(result.shutdown).toBeDefined();
    consoleLog.mockRestore();
  });
});
