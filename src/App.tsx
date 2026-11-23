import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, createHashRouter, useLocation, useNavigate } from "react-router";
import { catalog } from "./api/catalog";
import { auth, signIn, signOut } from "./api/client";
import { EditBoundary, useEdits } from "./components/dirty";
import { Loading } from "./components/feedback";
import { GlassSurface } from "./components/glass";
import { SelectionIndicator } from "./components/selection";
import { useAction, useResource } from "./components/state";
import { WorkspaceToolbar } from "./components/toolbar";
import { Brand, Confirm, Empty, Icon, Notice, Publication, showDate } from "./components/ui";
import { useWorkspace, useWorkspaceLayout, workspaceTransitions } from "./components/workspace";
import type { WorkspaceLayout } from "./components/workspace";
import { EditorPage } from "./editor/Editor";

function Login({ notice, layout }: { notice: string; layout: WorkspaceLayout }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction();
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login.trim() || !password) {
      action.setError("Укажите логин и пароль.");
      return;
    }
    void action.run(async () => {
      await signIn(login, password);
      setPassword("");
      void navigate("/", { replace: true });
    });
  }

  return <main className="login-page" data-layout={layout}>
    <div className="login-sheet">
      <Brand/>
      <div className="login-content">
        <h1>Вход в панель</h1>
        <form onSubmit={submit} aria-busy={action.busy}>
          <fieldset disabled={action.busy}>
            <div className="field">
              <label htmlFor="login">Логин или email</label>
              <input id="login" name="login" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={login} onChange={(event) => setLogin(event.target.value)} required/>
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input id="password" name="password" type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} required/>
            </div>
            <div className="login-actions">
              <button type="submit" className="button primary">{action.busy ? "Входим…" : "Войти"}</button>
            </div>
          </fieldset>
        </form>
        <Notice error>{action.error || notice}</Notice>
      </div>
    </div>
  </main>;
}

function Nav({ layout }: { layout: WorkspaceLayout }) {
  const { pathname } = useLocation();
  const selected = pathname.startsWith("/trips") ? "/trips" : pathname;
  return <nav className="workspace-nav" aria-label="Основная навигация">
    <SelectionIndicator selected={selected} selector='a[aria-current="page"]'/>
    <NavLink to="/" end viewTransition={workspaceTransitions}><Icon name="home"/>Главная</NavLink>
    <NavLink to="/trips" viewTransition={workspaceTransitions}>
      <Icon name="route"/>{layout === "desktop" ? "Цифровизация туров" : "Туры"}
    </NavLink>
  </nav>;
}

function AccountMenu({ login, onSignOut }: { login: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div className="account" ref={wrapper} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <GlassSurface className="account-control">
      <button ref={trigger} className="toolbar-icon account-trigger" type="button"
        aria-label={`Меню аккаунта — ${login}`} title={login} aria-controls={id} aria-expanded={open}
        onClick={() => setOpen((current) => !current)}>
        <Icon name="user"/><span className="account-login">{login}</span>
      </button>
    </GlassSurface>
    <div className="account-menu" id={id} data-open={open} aria-hidden={!open} inert={!open}>
      <GlassSurface kind="menu">
        <span className="account-owner">{login}</span>
        <button type="button" className="button quiet" onClick={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
          onSignOut();
        }}>
          <Icon name="logout"/>Выйти
        </button>
      </GlassSurface>
    </div>
  </div>;
}

function Shell() {
  const { session, notice } = useSyncExternalStore(auth.subscribe, auth.snapshot);
  const layout = useWorkspaceLayout();
  const { pathname } = useLocation();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const { sections } = useEdits();

  function leave() {
    setConfirmLogout(false);
    void signOut();
  }

  if (!session) return <Login notice={notice} layout={layout}/>;

  return <div className="app" data-layout={layout} data-sidebar={sidebarHidden ? "closed" : "open"}>
    {layout === "desktop" && <aside className="sidebar" id="workspace-sidebar" aria-hidden={sidebarHidden} inert={sidebarHidden}>
      <GlassSurface kind="sidebar" className="sidebar-panel">
        <Brand/>
        <Nav layout={layout}/>
      </GlassSurface>
    </aside>}
    <div className="main-column">
      <header className="topbar">
        {layout === "desktop" && <GlassSurface className="toolbar-sidebar">
          <button className="toolbar-icon sidebar-toggle" type="button" aria-controls="workspace-sidebar"
            aria-expanded={!sidebarHidden} aria-label={sidebarHidden ? "Показать сайдбар" : "Скрыть сайдбар"}
            title={sidebarHidden ? "Показать сайдбар" : "Скрыть сайдбар"}
            onClick={() => setSidebarHidden((hidden) => !hidden)}><Icon name="menu"/></button>
        </GlassSurface>}
        {layout === "tablet" && <>
          <div className="toolbar-brand"><Brand/></div>
          <GlassSurface className="tablet-navigation"><Nav layout={layout}/></GlassSurface>
        </>}
        <div className="toolbar-slot" ref={setToolbar}/>
        <AccountMenu login={session.login} onSignOut={() => sections.length ? setConfirmLogout(true) : leave()}/>
      </header>
      <main className="main-content">
        <div className="route-content" key={pathname}><Outlet context={{ layout, toolbar }}/></div>
      </main>
    </div>
    {layout === "phone" && <GlassSurface className="phone-navigation"><Nav layout={layout}/></GlassSurface>}
    {confirmLogout && <Confirm title="Выйти из панели?"
      text="На этой странице есть несохранённые изменения."
      action="Выйти" close={() => setConfirmLogout(false)} confirm={leave} danger/>}
  </div>;
}

function Home() {
  return <div className="page">
    <WorkspaceToolbar title="Главная"/>
    <Link className="home-link" to="/trips" viewTransition={workspaceTransitions}>
      <Icon name="route"/>
      <span>Цифровизация туров</span>
      <Icon name="chevron"/>
    </Link>
  </div>;
}

function Trips() {
  const { layout } = useWorkspace();
  const trips = useResource(catalog.trips, "catalog");

  return <div className="page">
    <WorkspaceToolbar title={layout === "phone" ? "Туры" : "Цифровизация туров"}>
      <Link to="/trips/new" className="button primary" viewTransition={workspaceTransitions}><Icon name="plus"/>Создать тур</Link>
    </WorkspaceToolbar>
    <Loading loading={trips.loading} error={trips.error} retry={() => { void trips.reload().catch(() => {}); }}>
      {trips.data && (trips.data.length > 0 ? <ul className="trip-list">
        {trips.data.map((trip) => <li key={trip.id}>
          <Link to={`/trips/${trip.id}`} viewTransition={workspaceTransitions}>
            <span className="trip-list-icon"><Icon name="route"/></span>
            <span className="trip-list-details">
              <strong>{trip.title || "Тур без названия"}</strong>
              <TourDates start={trip.startDate} end={trip.endDate}/>
            </span>
            <Publication published={trip.isPublic}/>
            <span className="trip-list-chevron"><Icon name="chevron"/></span>
          </Link>
        </li>)}
      </ul> : <Empty title="В каталоге пока нет туров"/>)}
    </Loading>
  </div>;
}

function TourDates({ start, end }: { start?: string | null; end?: string | null }) {
  return <span className="tour-dates">
    <time dateTime={start ?? undefined}>{showDate(start)}</time>
    <span> — </span><time dateTime={end ?? undefined}>{showDate(end)}</time>
  </span>;
}

export const router = createHashRouter([{
  path: "/",
  element: <EditBoundary><Shell/><ScrollRestoration/></EditBoundary>,
  children: [
    { index: true, element: <Home/> },
    { path: "trips", element: <Trips/> },
    { path: "trips/new", element: <EditorPage/> },
    { path: "trips/:tripId", element: <EditorPage/> },
    { path: "*", element: <><WorkspaceToolbar title="Страница не найдена"/>
      <Link className="button" to="/" viewTransition={workspaceTransitions}>На главную</Link></> },
  ],
}]);
