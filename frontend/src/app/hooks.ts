import { useCallback, useEffect, useState } from "react";
import { ApiEnvelope, api } from "../api";
export function useRemote<T>(path: string | null, startupId?: string) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<ApiEnvelope<T>["meta"]>();
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) { setLoading(false); setData(null); setError(null); setMeta(undefined); return () => { active = false; }; }
    setLoading(true); setError(null);
    api.get<T>(path, startupId).then((result) => { if (!active) return; setData(result.data); setMeta(result.meta); })
      .catch((cause: unknown) => { if (!active) return; setError(cause instanceof Error ? cause : new Error(String(cause))); setData(null); setMeta(undefined); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, startupId, version]);
  return { data, meta, loading, error, reload: () => setVersion((v) => v + 1) };
}
export function useMutation() {
  const [pending, setPending] = useState(false); const [error, setError] = useState<Error | null>(null); const [success, setSuccess] = useState("");
  const execute = useCallback(async <T,>(work: () => Promise<T>, successText = "") => {
    setPending(true); setError(null); setSuccess("");
    try { const result = await work(); setSuccess(successText); return result; }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(String(cause))); return null; }
    finally { setPending(false); }
  }, []);
  return { pending, error, success, execute, clearError: () => setError(null), setSuccess };
}