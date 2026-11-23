import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { errorText, unknownOutcome } from "../api/client";

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, key: string | null) {
  const [data, setLoadedData] = useState<T>();
  const [loading, setLoading] = useState(key !== null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController>(null);
  const load = useRef(loader);
  load.current = loader;

  const reload = useCallback(async () => {
    if (key === null) return undefined;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    try {
      const value = await load.current(request.signal);
      if (!request.signal.aborted) setLoadedData(value);
      return value;
    } catch (failure) {
      if (!request.signal.aborted) setError(errorText(failure));
      throw failure;
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [key]);

  const setData = useCallback((update: SetStateAction<T | undefined>) => {
    controller.current?.abort();
    setLoading(false);
    setError("");
    setLoadedData(update);
  }, []);

  useEffect(() => {
    if (key !== null) void reload().catch(() => {});
    return () => controller.current?.abort();
  }, [key, reload]);

  return { data, setData, loading, error, reload };
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run<T>(work: () => Promise<T>) {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await work();
    } catch (failure) {
      setError(errorText(failure));
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return { busy, error, notice, setError, setNotice, run };
}

export function useMutation() {
  const action = useAction();
  const [reconcile, setReconcile] = useState<null | (() => Promise<boolean>)>(null);

  function run(work: () => Promise<void>, verify?: () => Promise<boolean>) {
    if (reconcile) return Promise.resolve(undefined);
    return action.run(async () => {
      try {
        await work();
      } catch (failure) {
        if (verify && unknownOutcome(failure)) setReconcile(() => verify);
        throw failure;
      }
    });
  }

  function verify() {
    if (!reconcile) return;
    void action.run(async () => {
      const found = await reconcile();
      setReconcile(null);
      action.setNotice(found
        ? "Сервер подтвердил действие."
        : "Действие не подтверждено. Проверьте обновлённые данные перед повторной отправкой.");
    });
  }

  return { ...action, run, verify, needsVerification: reconcile !== null };
}

function canonical(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (["arrivalTime", "departureTime", "checkIn", "checkOut", "takenAt"].includes(key)) {
    const date = Date.parse(value);
    if (Number.isFinite(date)) return date;
  }
  if ((key === "startTime" || key === "endTime") && /^\d\d:\d\d$/.test(value)) return `${value}:00`;
  return value;
}

export function matches(record: object, submitted: object) {
  return Object.entries(submitted).every(([key, value]) => (
    canonical(key, value) === canonical(key, (record as Record<string, unknown>)[key])
  ));
}

export function newMatch<T extends { id: string }>(rows: T[], before: T[], submitted: object) {
  const existing = new Set(before.map((row) => row.id));
  const candidates = rows.filter((row) => !existing.has(row.id) && matches(row, submitted));
  if (candidates.length > 1) {
    throw new Error("В списке несколько совпадающих записей. Проверьте их перед повторным созданием.");
  }
  return candidates[0];
}

export function useRows<T extends { id: string }>(loader: (signal: AbortSignal) => Promise<T[]>, key: string | null) {
  const resource = useResource(loader, key);
  const [notice, setNotice] = useState("");
  function upsert(row: T) {
    resource.setData((rows = []) => [...rows.filter((item) => item.id !== row.id), row]);
    setNotice("Запись сохранена.");
  }
  function drop(id: string) {
    resource.setData((rows) => rows?.filter((row) => row.id !== id));
    setNotice("Запись удалена.");
  }
  return { ...resource, upsert, drop, notice, items: resource.data ?? [] };
}
