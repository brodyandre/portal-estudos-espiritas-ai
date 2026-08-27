import { useCallback, useEffect, useRef, useState } from "react";

import {
  listUserBookAccess,
  ServiceRequestError,
} from "../services/bookAccessService";
import type { UserBookAccessResult } from "../types/bookAccess";

interface UseBookAccessState {
  data: UserBookAccessResult | null;
  error: ServiceRequestError | Error | null;
  isLoading: boolean;
  requestId: number;
}

export const useBookAccess = (options: { enabled?: boolean } = {}) => {
  const { enabled = true } = options;
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [state, setState] = useState<UseBookAccessState>({
    data: null,
    error: null,
    isLoading: enabled,
    requestId: 0,
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
      requestId,
    }));

    try {
      const data = await listUserBookAccess();

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setState({
        data,
        error: null,
        isLoading: false,
        requestId,
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        data: null,
        error: error instanceof Error ? error : new Error("Erro desconhecido."),
        isLoading: false,
        requestId,
      }));
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    refetch: load,
  };
};
