import type { ReactNode } from "react";
import type { useMutation } from "./state";
import { Notice } from "./ui";

export function MutationFeedback({ state }: { state: ReturnType<typeof useMutation> }) {
  return <>
    <Notice error>{state.error}</Notice>
    {state.needsVerification && <div className="verify">
      <p>API мог сохранить запись. Сверьте данные на сервере перед повтором.</p>
      <button type="button" className="button" disabled={state.busy} onClick={state.verify}>Сверить с сервером</button>
    </div>}
    <Notice>{state.notice}</Notice>
  </>;
}

export function Loading({ loading, error, retry, children }: {
  loading: boolean;
  error: string;
  retry: () => void;
  children?: ReactNode;
}) {
  return <>
    {error && <div className="load-error">
      <Notice error>{error}</Notice>
      <button type="button" className="button" onClick={retry}>Повторить</button>
    </div>}
    {loading && <p className="loading" role="status">Загрузка…</p>}
    {children}
  </>;
}
