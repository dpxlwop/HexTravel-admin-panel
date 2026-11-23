import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { catalog, isUuid } from "../api/catalog";
import type { Saved } from "../api/catalog";
import { ApiError } from "../api/client";
import type { TripCreateRequest, TripResponse, TripUpdateRequest } from "../api/schema";
import { useDirty, useEdits } from "../components/dirty";
import { Fields, Form, changed, compareDates, useFields, valuesFrom } from "../components/fields";
import { Loading, MutationFeedback } from "../components/feedback";
import { SelectionIndicator } from "../components/selection";
import { matches, useMutation, useResource, useRows } from "../components/state";
import { WorkspaceToolbar } from "../components/toolbar";
import { Confirm, Icon, Notice, PopupButton, Publication, showDate } from "../components/ui";
import { useWorkspace, workspaceTransitions } from "../components/workspace";
import { Gallery } from "./Gallery";
import { tripCoordinates, tripCore, tripFields } from "./definitions";
import { Bookings, Points, Program, Transports, sections } from "./sections";
import type { Section } from "./sections";

function Editor({ initial }: { initial?: Saved<TripResponse> }) {
  const { layout } = useWorkspace();
  const [record, setRecord] = useState(initial);
  const [baseline, setBaseline] = useState(() => initial ? valuesFrom(tripFields, initial) : { status: "PLANNED", currency: "RUB" });
  const form = useFields(baseline);
  const [selected, select] = useState<Section>("Основное");
  const [publishDialog, setPublishDialog] = useState(false);
  const [publishBlocked, setPublishBlocked] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [pointRevision, setPointRevision] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const edits = useEdits();
  const action = useMutation();
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tripId = record?.id;
  const dirty = changed(form.values, baseline);
  const [initialNotice] = useState((location.state as { notice?: string } | null)?.notice);
  useDirty(id, "Основное", dirty || action.busy || action.needsVerification);

  const points = useRows((signal) => catalog.points(tripId!, signal), tripId ?? null);
  const days = useRows((signal) => catalog.days(tripId!, signal), tripId ?? null);
  const transports = useRows((signal) => catalog.transports(tripId!, signal), tripId ?? null);
  const bookings = useRows((signal) => catalog.bookings(tripId!, signal), tripId ?? null);
  const photos = useRows((signal) => catalog.photos(tripId!, signal), tripId ?? null);

  function apply(row: Saved<TripResponse>) {
    const values = valuesFrom(tripFields, row);
    setRecord(row);
    setBaseline(values);
    form.reset(values);
    setConflict(false);
  }

  function openDraft(row: Saved<TripResponse>) {
    edits.allowNavigation();
    void navigate(`/trips/${row.id}`, { replace: true, viewTransition: workspaceTransitions, state: { notice: "Черновик сохранён." } });
  }

  function persist(publish = false) {
    setPublishDialog(false);
    setPublishBlocked(undefined);
    setConflict(false);

    const data = publish && !dirty ? {} : form.read<TripUpdateRequest>(
      tripFields,
      (values) => compareDates(values, "startDate", "endDate", "Дата окончания должна быть не раньше начала."),
      tripId ? baseline : undefined,
    );
    if (!data) {
      select("Основное");
      return;
    }
    if (tripId && !publish && Object.keys(data).length === 0) {
      form.reset(baseline);
      action.setError("");
      action.setNotice("Изменений для сохранения нет.");
      return;
    }

    let expected: TripUpdateRequest = data;
    void action.run(async () => {
      try {
        if (!tripId) {
          openDraft(await catalog.createTrip({ ...data, isPublic: false } as TripCreateRequest));
          return;
        }
        if (Object.keys(data).length > 0) {
          apply(await catalog.updateTrip(tripId, data));
          action.setNotice("Изменения сохранены.");
        }
        if (publish) {
          expected = { isPublic: true };
          const published = await catalog.updateTrip(tripId, expected);
          apply(published);
          if (!published.isPublic) throw new Error("API не подтвердил публикацию тура.");
          action.setNotice("Тур опубликован.");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true);
          select("Основное");
        }
        throw error;
      }
    }, async () => {
      if (!tripId) {
        const current = await catalog.trips();
        const found = current.find((row) => matches(row, { ...data, isPublic: false }));
        if (found) openDraft(found);
        return Boolean(found);
      }
      const current = await catalog.trip(tripId);
      if (!matches(current, expected)) return false;
      apply(current);
      return true;
    });
  }

  function requestPublication() {
    const unfinished = edits.sections.find((section) => section !== "Основное");
    if (unfinished) {
      select(unfinished as Section);
      setPublishBlocked(`Завершите сохранение или отмените правки в разделе «${unfinished}».`);
      return;
    }
    setPublishDialog(true);
  }

  function switchTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "Home" ? 0
      : event.key === "End" ? sections.length - 1
        : event.key === "ArrowRight" ? (index + 1) % sections.length
          : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : null;
    if (next === null) return;
    event.preventDefault();
    select(sections[next]);
    tabRefs.current[next]?.focus();
  }

  const main = <Form id={`${id}-form`} locked={action.busy || action.needsVerification} submit={() => persist()}>
    <div className="form-block">
      <Fields fields={tripCore} baseline={tripId ? baseline : undefined} form={form}/>
    </div>
    <section className="form-block" aria-labelledby={`${id}-coordinates`}>
      <h2 id={`${id}-coordinates`}>Координаты маршрута</h2>
      <Fields fields={tripCoordinates} baseline={tripId ? baseline : undefined} form={form}/>
    </section>
  </Form>;

  const saveFirst = <div className="waiting-for-draft"><Icon name="route"/>
    <p>Сохраните черновик, чтобы добавить записи в этот раздел.</p>
    <button type="button" className="button" onClick={() => select("Основное")}>К карточке тура</button>
  </div>;
  const currency = record?.currency ?? form.values.currency;
  const panels: ReactNode[] = [
    main,
    tripId ? <Points tripId={tripId} rows={points} days={days} photos={photos}
      onChange={() => setPointRevision((value) => value + 1)}/> : saveFirst,
    tripId ? <Program tripId={tripId} rows={days} points={points.items} pointRevision={pointRevision}/> : saveFirst,
    tripId ? <Transports tripId={tripId} rows={transports} currency={currency}/> : saveFirst,
    tripId ? <Bookings tripId={tripId} rows={bookings} currency={currency}/> : saveFirst,
    tripId ? <Gallery tripId={tripId} rows={photos} points={points.items} active={selected === "Фото"}/> : saveFirst,
  ];
  const busy = action.busy || action.needsVerification;
  const back = { to: "/trips", label: "К списку туров" };

  return <div className="editor">
    <WorkspaceToolbar title={record?.title || "Новый тур"} back={back} details={tripId && <>
      <Publication published={record?.isPublic}/>
      {record?.startDate && <span className="toolbar-dates">{showDate(record.startDate)} — {showDate(record.endDate)}</span>}
    </>}>
      <button className={!tripId || record?.isPublic ? "button primary" : "button"}
        type={selected === "Основное" ? "submit" : "button"}
        form={selected === "Основное" ? `${id}-form` : undefined}
        onClick={selected === "Основное" ? undefined : () => persist()}
        disabled={busy || Boolean(tripId && !dirty)}>
        {action.busy ? "Сохраняем…" : tripId ? "Сохранить изменения" : "Сохранить черновик"}
      </button>
      {tripId && !record?.isPublic && <button type="button" className="button primary" disabled={busy} onClick={requestPublication}>
        Опубликовать
      </button>}
    </WorkspaceToolbar>

    <div className="editor-feedback">
      {action.notice || action.error ? null : <Notice>{initialNotice}</Notice>}
      <MutationFeedback state={action}/>
      {publishBlocked && <Notice>{publishBlocked}</Notice>}
      {dirty && record?.isPublic && <p className="editor-hint">Сохранённые изменения будут видны в каталоге.</p>}
      {conflict && <Notice error>
        <span>Измените название или даты, либо откройте существующий тур из списка.</span>
        <Link className="button" to="/trips" viewTransition={workspaceTransitions}>К списку</Link>
      </Notice>}
    </div>

    {layout === "phone" ? <div className="section-picker">
      <label htmlFor={`${id}-sections`}>Раздел тура</label>
      <PopupButton id={`${id}-sections`} value={selected} onChange={(event) => {
        select(event.target.value as Section);
        setPublishBlocked(undefined);
      }}>
        {sections.map((section) => <option key={section} value={section}>{section}</option>)}
      </PopupButton>
    </div> : <div className="tabs" role="tablist" aria-label="Разделы тура">
      <SelectionIndicator selected={selected} selector='[role="tab"][aria-selected="true"]'/>
      {sections.map((section, index) => <button key={section} type="button" role="tab" id={`${id}-tab-${index}`}
        ref={(element) => { tabRefs.current[index] = element; }} aria-controls={`${id}-section-${index}`}
        aria-selected={selected === section} tabIndex={selected === section ? 0 : -1}
        onClick={() => { select(section); setPublishBlocked(undefined); }}
        onKeyDown={(event) => switchTab(event, index)}>{section}</button>)}
    </div>}

    <fieldset disabled={action.busy} className="editor-sections">
      {sections.map((section, index) => (
        <section role={layout === "phone" ? undefined : "tabpanel"} id={`${id}-section-${index}`}
          aria-label={layout === "phone" ? section : undefined}
          aria-labelledby={layout === "phone" ? undefined : `${id}-tab-${index}`}
          hidden={selected !== section} key={section} className="editor-panel">
          {panels[index]}
        </section>
      ))}
    </fieldset>

    {publishDialog && <Confirm title={dirty ? "Сохранить и опубликовать тур?" : "Опубликовать тур?"}
      text={dirty ? "Сначала панель сохранит изменения в карточке. После публикации тур появится в каталоге."
        : "После публикации тур появится в каталоге HexTravel."}
      action={dirty ? "Сохранить и опубликовать" : "Опубликовать"}
      close={() => setPublishDialog(false)} confirm={() => persist(true)}/>}
  </div>;
}

function StoredEditor({ tripId }: { tripId: string }) {
  const trip = useResource((signal) => catalog.trip(tripId, signal), tripId);
  return <Loading loading={trip.loading} error={trip.error} retry={() => { void trip.reload().catch(() => {}); }}>
    {trip.data && <Editor initial={trip.data}/>}
    {!trip.data && <WorkspaceToolbar title="Редактор тура" back={{ to: "/trips", label: "К списку туров" }}/>}
    {trip.error && <p><Link to="/trips" viewTransition={workspaceTransitions}>К списку туров</Link></p>}
  </Loading>;
}

export function EditorPage() {
  const { tripId } = useParams();
  if (!tripId) return <Editor key="new"/>;
  if (!isUuid(tripId)) return <>
    <WorkspaceToolbar title="Редактор тура" back={{ to: "/trips", label: "К списку туров" }}/>
    <Notice error>Ссылка на тур содержит некорректный UUID.</Notice>
  </>;
  return <StoredEditor key={tripId} tripId={tripId}/>;
}
