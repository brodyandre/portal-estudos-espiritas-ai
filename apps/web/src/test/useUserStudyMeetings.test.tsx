import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserStudyMeetingsResult } from "../types/userStudyMeetings";
import { useUserStudyMeetings } from "../hooks/useUserStudyMeetings";
import { listUserStudyMeetings, ServiceRequestError } from "../services/userStudyMeetingsService";

vi.mock("../services/userStudyMeetingsService", () => {
  class MockServiceRequestError extends Error {
    readonly kind: "api" | "network";
    readonly code?: string;

    constructor(options: { message: string; kind: "api" | "network"; code?: string }) {
      super(options.message);
      this.kind = options.kind;
      this.code = options.code;
    }
  }

  return {
    listUserStudyMeetings: vi.fn(),
    ServiceRequestError: MockServiceRequestError,
  };
});

const listUserStudyMeetingsMock = vi.mocked(listUserStudyMeetings);

const createResult = (title = "Encontro autenticado"): UserStudyMeetingsResult => ({
  group: { id: "group-001", name: "Emmanuel", status: "active" },
  items: [
    {
      id: `meeting-${title}`,
      title,
      description: null,
      startsAt: "2026-07-15T20:00:00.000-03:00",
      endsAt: "2026-07-15T21:00:00.000-03:00",
      status: "scheduled",
      meetUrl: null,
    },
  ],
  limit: 3,
  source: "api",
  notice: null,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

describe("useUserStudyMeetings", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("expõe loading inicial e finaliza com sucesso", async () => {
    listUserStudyMeetingsMock.mockResolvedValue(createResult());

    const { result } = renderHook(() => useUserStudyMeetings());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.items[0]?.title).toBe("Encontro autenticado");
    expect(result.current.error).toBeNull();
    expect(listUserStudyMeetingsMock).toHaveBeenCalledWith({ limit: 3 });
  });

  it("usa resultado demonstrativo sem chamada fetch real", async () => {
    vi.stubGlobal("fetch", vi.fn());
    listUserStudyMeetingsMock.mockResolvedValue({
      ...createResult("Agenda demonstrativa"),
      source: "mock",
      notice: "Modo demonstrativo seguro.",
    });

    const { result } = renderHook(() => useUserStudyMeetings());

    await waitFor(() => {
      expect(result.current.data?.source).toBe("mock");
    });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("mantém erro real sem fallback para mock e encerra loading", async () => {
    listUserStudyMeetingsMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useUserStudyMeetings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toMatchObject({ message: "offline" });
  });

  it("preserva códigos 401 e 403", async () => {
    listUserStudyMeetingsMock
      .mockRejectedValueOnce(
        new ServiceRequestError({ kind: "api", code: "AUTH_REQUIRED", message: "Sessão necessária." }),
      )
      .mockRejectedValueOnce(
        new ServiceRequestError({ kind: "api", code: "FORBIDDEN", message: "Acesso negado." }),
      );

    const { result } = renderHook(() => useUserStudyMeetings());

    await waitFor(() => {
      expect(result.current.error).toMatchObject({ code: "AUTH_REQUIRED" });
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toMatchObject({ code: "FORBIDDEN" });
  });

  it("retry recupera após erro", async () => {
    listUserStudyMeetingsMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(createResult("Retry recuperado"));

    const { result } = renderHook(() => useUserStudyMeetings());

    await waitFor(() => {
      expect(result.current.error).toMatchObject({ message: "offline" });
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.items[0]?.title).toBe("Retry recuperado");
    expect(result.current.isLoading).toBe(false);
  });

  it("retry mais recente prevalece sobre resposta antiga", async () => {
    const oldRequest = createDeferred<UserStudyMeetingsResult>();
    const newRequest = createDeferred<UserStudyMeetingsResult>();
    listUserStudyMeetingsMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result } = renderHook(() => useUserStudyMeetings());

    await act(async () => {
      void result.current.refetch();
    });

    await act(async () => {
      newRequest.resolve(createResult("Resposta nova"));
      await newRequest.promise;
    });

    expect(result.current.data?.items[0]?.title).toBe("Resposta nova");

    await act(async () => {
      oldRequest.resolve(createResult("Resposta antiga"));
      await oldRequest.promise;
    });

    expect(result.current.data?.items[0]?.title).toBe("Resposta nova");
  });

  it("erro antigo não sobrescreve sucesso novo", async () => {
    const oldRequest = createDeferred<UserStudyMeetingsResult>();
    const newRequest = createDeferred<UserStudyMeetingsResult>();
    listUserStudyMeetingsMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result } = renderHook(() => useUserStudyMeetings());

    await act(async () => {
      void result.current.refetch();
    });

    await act(async () => {
      newRequest.resolve(createResult("Sucesso novo"));
      await newRequest.promise;
    });

    await act(async () => {
      oldRequest.reject(new Error("erro antigo"));
      await oldRequest.promise.catch(() => undefined);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.items[0]?.title).toBe("Sucesso novo");
  });

  it("resposta antiga não sobrescreve resposta nova após mudança de limit", async () => {
    const oldRequest = createDeferred<UserStudyMeetingsResult>();
    const newRequest = createDeferred<UserStudyMeetingsResult>();
    listUserStudyMeetingsMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender } = renderHook(
      ({ limit }) => useUserStudyMeetings({ limit }),
      { initialProps: { limit: 3 } },
    );

    rerender({ limit: 2 });

    await act(async () => {
      newRequest.resolve(createResult("Limit novo"));
      await newRequest.promise;
    });

    await act(async () => {
      oldRequest.resolve(createResult("Limit antigo"));
      await oldRequest.promise;
    });

    expect(result.current.data?.items[0]?.title).toBe("Limit novo");
  });

  it("não atualiza estado após unmount", async () => {
    const deferred = createDeferred<UserStudyMeetingsResult>();
    listUserStudyMeetingsMock.mockReturnValue(deferred.promise);

    const { result, unmount } = renderHook(() => useUserStudyMeetings());

    expect(result.current.isLoading).toBe(true);
    unmount();

    await act(async () => {
      deferred.resolve(createResult("Depois do unmount"));
      await deferred.promise;
    });

    expect(listUserStudyMeetingsMock).toHaveBeenCalledTimes(1);
  });
});
