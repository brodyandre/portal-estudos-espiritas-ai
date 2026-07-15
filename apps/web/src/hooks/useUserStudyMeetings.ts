import { useCallback, useEffect, useRef, useState } from "react";

import {
  listUserStudyMeetings,
  ServiceRequestError,
} from "../services/userStudyMeetingsService";
import type { UserStudyMeetingsResult } from "../types/userStudyMeetings";

interface UseUserStudyMeetingsState {
  data: UserStudyMeetingsResult | null;
  error: ServiceRequestError | Error | null;
  isLoading: boolean;
  requestId: number;
}

export const useUserStudyMeetings = (options: { limit?: number; enabled?: boolean } = {}) => {
  const { enabled = true, limit = 3 } = options;
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [state, setState] = useState<UseUserStudyMeetingsState>({
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
      const data = await listUserStudyMeetings({ limit });

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
        error: error instanceof Error ? error : new Error("Erro desconhecido."),
        isLoading: false,
        requestId,
      }));
    }
  }, [enabled, limit]);

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
