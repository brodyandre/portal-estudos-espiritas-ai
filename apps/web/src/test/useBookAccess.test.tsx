import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBookAccess } from "../hooks/useBookAccess";
import { listUserBookAccess, ServiceRequestError } from "../services/bookAccessService";
import type { UserBookAccessResult } from "../types/bookAccess";

vi.mock("../services/bookAccessService", () => {
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
    listUserBookAccess: vi.fn(),
    ServiceRequestError: MockServiceRequestError,
  };
});

const listUserBookAccessMock = vi.mocked(listUserBookAccess);

const createResult = (name = "Emmanuel"): UserBookAccessResult => ({
  groups: [
    {
      id: "emmanuel",
      name,
      knowledgeBook: {
        id: "book-emmanuel",
        slug: "emmanuel",
        title: "Emmanuel",
      },
    },
  ],
  count: 1,
  source: "api",
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

describe("useBookAccess", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("carrega BookAccess e expõe refetch", async () => {
    listUserBookAccessMock.mockResolvedValue(createResult());

    const { result } = renderHook(() => useBookAccess());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.groups[0]?.name).toBe("Emmanuel");
    expect(result.current.error).toBeNull();
  });

  it("preserva códigos 401, 403 e 503", async () => {
    listUserBookAccessMock
      .mockRejectedValueOnce(
        new ServiceRequestError({ kind: "api", code: "AUTH_REQUIRED", message: "Sessão necessária." }),
      )
      .mockRejectedValueOnce(
        new ServiceRequestError({ kind: "api", code: "FORBIDDEN", message: "Acesso negado." }),
      )
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "api",
          code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
          message: "Catálogo indisponível.",
        }),
      );

    const { result } = renderHook(() => useBookAccess());

    await waitFor(() => {
      expect(result.current.error).toMatchObject({ code: "AUTH_REQUIRED" });
    });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toMatchObject({ code: "FORBIDDEN" });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toMatchObject({ code: "BOOK_ACCESS_CATALOG_UNAVAILABLE" });
  });

  it("respeita enabled=false", async () => {
    const { result } = renderHook(() => useBookAccess({ enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listUserBookAccessMock).not.toHaveBeenCalled();
  });

  it("mantém somente a resposta mais recente", async () => {
    const oldRequest = createDeferred<UserBookAccessResult>();
    const newRequest = createDeferred<UserBookAccessResult>();
    listUserBookAccessMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result } = renderHook(() => useBookAccess());

    await act(async () => {
      void result.current.refetch();
    });

    await act(async () => {
      newRequest.resolve(createResult("Resposta nova"));
      await newRequest.promise;
    });

    expect(result.current.data?.groups[0]?.name).toBe("Resposta nova");

    await act(async () => {
      oldRequest.resolve(createResult("Resposta antiga"));
      await oldRequest.promise;
    });

    expect(result.current.data?.groups[0]?.name).toBe("Resposta nova");
  });
});
