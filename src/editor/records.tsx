import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useDirty } from "../components/dirty";
import { Fields, Form, changed, useFields } from "../components/fields";
import type { Field, FieldErrors, FormState, Values } from "../components/fields";
import { Loading, MutationFeedback } from "../components/feedback";
import { useAction, useMutation, useResource } from "../components/state";
import { Confirm, Details, Empty, Icon, Notice, showDate, showDateTime } from "../components/ui";

export function nextIndex(indices: (number | null | undefined)[], first = 0) {
  const used = new Set(indices);
  let next = first;
  while (used.has(next)) next++;
  return next;
}

export function AddPanel({ empty, allowSkip = false, label, title, locked, renderForm }: {
  empty: boolean;
  allowSkip?: boolean;
  label: string;
  title: string;
  locked?: boolean;
  renderForm: (close: () => void) => ReactNode;
}) {
  const [mode, setMode] = useState<"idle" | "form" | "skipped">("idle");
  const add = () => setMode("form");
  const close = () => setMode("idle");
  const buttons = <div className="button-row">
    <button className="button" type="button" onClick={add} disabled={locked}><Icon name="plus"/>{label}</button>
    {allowSkip && empty && mode !== "skipped" &&
      <button className="button quiet" type="button" onClick={() => setMode("skipped")}>Не добавлять</button>}
  </div>;

  if (mode === "form") return renderForm(close);
  if (empty) return <Empty title={mode === "skipped" ? "Раздел пропущен" : title}>{buttons}</Empty>;
  return <div className="section-actions">{buttons}</div>;
}

export function RecordForm<Payload extends object, Row>({ title, section, fields, initial, checks, beforeFields, save, find, onSaved, close }: {
  title: string;
  section: string;
  fields: readonly Field[];
  initial: Values;
  checks?: (values: Values) => FieldErrors;
  beforeFields?: (form: FormState) => ReactNode;
  save: (data: Payload) => Promise<Row>;
  find: (data: Payload) => Promise<Row | undefined>;
  onSaved: (row: Row) => void;
  close: () => void;
}) {
  const [baseline] = useState(initial);
  const form = useFields(baseline);
  const action = useMutation();
  const [cancel, setCancel] = useState(false);
  const key = useId();
  const dirty = changed(form.values, baseline);
  useDirty(key, section, dirty || action.busy || action.needsVerification);

  function complete(row: Row) {
    onSaved(row);
    close();
  }

  function submit() {
    const data = form.read<Payload>(fields, checks);
    if (!data) return;
    void action.run(async () => complete(await save(data)), async () => {
      const row = await find(data);
      if (row) complete(row);
      return Boolean(row);
    });
  }

  return <div className="record-form">
    <h3>{title}</h3>
    <Form submit={submit} locked={action.busy || action.needsVerification}>
      {beforeFields?.(form)}
      <Fields fields={fields.filter((field) => field.kind !== "uuid")} form={form}/>
      <div className="button-row form-actions">
        <button className="button primary" type="submit">{action.busy ? "Сохраняем…" : "Добавить"}</button>
        <button className="button quiet" type="button" onClick={() => dirty ? setCancel(true) : close()}>Отмена</button>
      </div>
    </Form>
    <MutationFeedback state={action}/>
    {cancel && <Confirm title="Сбросить заполненную форму?" action="Сбросить" close={() => setCancel(false)} confirm={close} danger/>}
  </div>;
}

export function RowDetails({ row, fields }: { row: object; fields: readonly Field[] }) {
  const data = row as Record<string, unknown>;
  return <Details entries={fields.map((field) => {
    const value = data[field.name];
    if (value == null || value === "") return [field.label, undefined];
    if (field.kind === "date") return [field.label, showDate(String(value))];
    if (field.kind === "date-time") return [field.label, showDateTime(String(value))];
    const label = field.options?.find((option) => option.value === value)?.label;
    return [field.label, label ?? String(value)];
  })}/>;
}

export function RecordCard<T extends { id: string }>({ row, title, summary, load, children }: {
  row: T;
  title: string;
  summary?: string;
  load?: () => Promise<T>;
  children: (data: T, open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const detail = useResource(() => load!(), open && load ? row.id : null);

  return <article className="record">
    <button className="record-toggle" type="button" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(!open)}>
      <span><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
      <span className="record-chevron"><Icon name="chevron"/></span>
    </button>
    <div id={panelId} className="record-disclosure" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="record-clipping">
        <div className="record-content">
          <Loading loading={detail.loading} error={detail.error} retry={() => { void detail.reload().catch(() => {}); }}/>
          {children(detail.data ?? row, open)}
        </div>
      </div>
    </div>
  </article>;
}

export function RemoveButton({ name, links, remove }: {
  name: string;
  links?: () => Promise<string[]>;
  remove: () => Promise<void>;
}) {
  const action = useAction();
  const [dependencyList, setDependencyList] = useState<string[] | null>(null);

  function ask() {
    void action.run(async () => { setDependencyList(links ? await links() : []); });
  }

  function confirm() {
    setDependencyList(null);
    void action.run(remove);
  }

  return <div className="remove">
    <Notice error>{action.error}</Notice>
    <button className="button quiet destructive" type="button" disabled={action.busy} onClick={ask}>
      {action.busy ? "Проверяем…" : "Удалить"}
    </button>
    {dependencyList && <Confirm title={`Удалить ${name}?`}
      text={dependencyList.length > 0 && <>
        <p>Связанные записи</p>
        <ul>{dependencyList.map((link, index) => <li key={`${index}-${link}`}>{link}</li>)}</ul>
      </>}
      action="Удалить" close={() => setDependencyList(null)} confirm={confirm} danger/>}
  </div>;
}

export function byIndex<T>(items: T[], index: (value: T) => number | null | undefined) {
  return [...items].sort((a, b) => (index(a) ?? Number.MAX_SAFE_INTEGER) - (index(b) ?? Number.MAX_SAFE_INTEGER));
}
