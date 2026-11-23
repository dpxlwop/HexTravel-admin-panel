import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export type IconName = "home" | "route" | "plus" | "menu" | "user" | "chevron" | "back" | "chevrons" | "search" | "close" | "photo" | "logout";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h5v-6h4v6h5V9"/></>,
  route: <><circle cx="6" cy="17.5" r="2.5"/><circle cx="18" cy="6.5" r="2.5"/><path d="M6 15v-3a2 2 0 0 1 2-2h6a2 2 0 0 0 2-2V7"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  menu: <><rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="M9 5v14M5.5 8.5h1M5.5 11h1"/></>,
  user: <><circle cx="12" cy="8" r="3.3"/><path d="M5 20v-1.5a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V20"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  back: <path d="m15 6-6 6 6 6"/>,
  chevrons: <path d="m8 9 4-4 4 4m-8 6 4 4 4-4"/>,
  search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  photo: <><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></>,
  logout: <><path d="M11 5H5v14h6m-1-7h11m-4-4 4 4-4 4"/></>,
};

export function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Brand() {
  return <div className="brand">
    <Icon name="route"/>
    <span>HexTravel</span>
  </div>;
}

export function PopupButton(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="popup-button">
    <select {...props}/>
    <Icon name="chevrons"/>
  </span>;
}

export function Notice({ children, error = false }: { children?: ReactNode; error?: boolean }) {
  if (!children) return null;
  return <div className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>{children}</div>;
}

export function Publication({ published }: { published?: boolean | null }) {
  return <span className={published ? "publication published" : "publication"}>
    <span aria-hidden="true" />{published ? "Опубликован" : "Черновик"}
  </span>;
}

export function Empty({ title, children, icon = "route" }: { title: string; children?: ReactNode; icon?: IconName }) {
  return <div className="empty">
    <span className="empty-icon"><Icon name={icon}/></span>
    <p className="empty-title">{title}</p>
    {children}
  </div>;
}

type Dismiss = (action?: () => void) => void;

export function Dialog({ title, close, children, kind, locked = false }: {
  title: string;
  close: () => void;
  children: ReactNode | ((dismiss: Dismiss) => ReactNode);
  kind?: "confirmation";
  locked?: boolean;
}) {
  const label = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const active = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (active instanceof HTMLElement && active.isConnected) active.focus({ preventScroll: true });
    };
  }, []);

  function dismiss(action = close) {
    const element = ref.current;
    if (!element || locked || element.hasAttribute("data-closing")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }

    element.dataset.closing = "";
    element.inert = true;
    const animation = element.getAnimations().find((item) =>
      "animationName" in item && item.animationName === "dialog-dismiss");
    function finish() {
      if (!element?.isConnected) return;
      delete element.dataset.closing;
      element.inert = false;
      action();
    }
    if (animation) void animation.finished.then(finish, finish);
    else finish();
  }

  return createPortal(
    <dialog ref={ref} className={kind} aria-labelledby={label} onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <div className="dialog-heading">
        <h2 id={label}>{title}</h2>
        <button type="button" className="button icon quiet" disabled={locked} onClick={() => dismiss()} aria-label="Закрыть">
          <Icon name="close"/>
        </button>
      </div>
      {typeof children === "function" ? children(dismiss) : children}
    </dialog>,
    document.body,
  );
}

export function Confirm({ title, text, action, close, confirm, danger = false }: {
  title: string;
  text?: ReactNode;
  action: string;
  close: () => void;
  confirm: () => void;
  danger?: boolean;
}) {
  return <Dialog title={title} close={close} kind="confirmation">{(dismiss) => <>
    {text && <div className="confirm-text">{text}</div>}
    <div className="button-row dialog-actions">
      <button type="button" className="button" onClick={() => dismiss()} autoFocus>Отмена</button>
      <button type="button" className={`button ${danger ? "danger" : "primary"}`} onClick={() => dismiss(confirm)}>{action}</button>
    </div>
  </>}</Dialog>;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export function showDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormat.format(date);
}

export function showDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateTimeFormat.format(date);
}

export function Details({ entries }: { entries: [string, ReactNode][] }) {
  return <dl className="details">
    {entries.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>;
}
