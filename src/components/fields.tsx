import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isUuid, osmId } from "../api/catalog";
import { PopupButton } from "./ui";

type FieldType = "text" | "area" | "number" | "int" | "date" | "date-time" | "time" | "select" |
  "bool" | "uuid" | "osm" | "json-object" | "tags" | "tel" | "url";

export interface Field {
  name: string;
  label: string;
  kind?: FieldType;
  optional?: boolean;
  wide?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  positive?: boolean;
  pattern?: RegExp;
  future?: boolean;
  hint?: string;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
}

export type Values = Record<string, string | undefined>;
export type FieldErrors = Record<string, string | undefined>;

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function localDateTime(value: Date) {
  return new Date(value.valueOf() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function offsetDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(+date)) return undefined;
  const local = value.length === 16 ? `${value}:00` : value;
  if (localDateTime(date) !== local) return undefined;
  const offset = -date.getTimezoneOffset();
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${local}${offset < 0 ? "-" : "+"}${hours}:${minutes}`;
}

export function valuesFrom(fields: readonly Field[], row: object): Values {
  const data = row as Record<string, unknown>;
  const result: Values = {};
  for (const field of fields) {
    const value = data[field.name];
    if (value === undefined || value === null || (field.optional && value === "")) continue;
    if (field.kind === "date-time" && typeof value === "string") {
      const date = new Date(value);
      result[field.name] = Number.isFinite(+date) ? localDateTime(date) : value;
    } else {
      result[field.name] = Array.isArray(value) ? value.join(", ") : String(value);
    }
  }
  return result;
}

export function compareDates(values: Values, start: string, end: string, message: string): FieldErrors {
  const a = values[start];
  const b = values[end];
  if (!a || !b) return {};
  if (a.includes("T") && b.includes("T")) {
    return Date.parse(b) < Date.parse(a) ? { [end]: message } : {};
  }
  return b < a ? { [end]: message } : {};
}

function parse(field: Field, raw: string) {
  const value = raw.trim();
  if (field.kind === "bool") return value === "true";
  if (!value) throw new Error(field.optional ? "Укажите значение или отметьте «Не указывать»." : "Заполните поле.");
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    throw new Error(`Максимум ${field.maxLength} символов.`);
  }
  if (field.pattern && !field.pattern.test(value)) throw new Error(field.hint ?? "Проверьте формат.");
  switch (field.kind) {
    case "int":
    case "number": {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error("Введите число.");
      if (field.kind === "int" && (!Number.isInteger(number) || number > 2147483647 || number < -2147483648)) {
        throw new Error("Введите целое число формата int32.");
      }
      if (field.positive && number <= 0) throw new Error("Значение должно быть больше 0.");
      if (field.min !== undefined && number < field.min) throw new Error(`Минимум ${field.min}.`);
      if (field.max !== undefined && number > field.max) throw new Error(`Максимум ${field.max}.`);
      return number;
    }
    case "date": {
      const date = new Date(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) {
        throw new Error("Укажите дату в формате ГГГГ-ММ-ДД.");
      }
      if (field.future && value < localDateTime(new Date()).slice(0, 10)) {
        throw new Error("Укажите сегодняшнюю или будущую дату.");
      }
      return value;
    }
    case "date-time": {
      const date = offsetDateTime(value);
      if (!date) throw new Error("Укажите дату и время в показанном часовом поясе.");
      if (field.future && Date.parse(date) < Date.now()) throw new Error("Укажите будущее время.");
      return date;
    }
    case "time": {
      if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) throw new Error("Укажите время в формате ЧЧ:ММ:СС.");
      return value.length === 5 ? `${value}:00` : value;
    }
    case "select":
      if (!field.options?.some((option) => option.value === value)) throw new Error("Выберите значение из списка.");
      return value;
    case "uuid":
      if (!isUuid(value)) throw new Error("Выберите место по OSM ID или UUID.");
      return value;
    case "osm": {
      const exact = osmId(value);
      if (!exact) throw new Error("Введите положительный OSM ID до 9223372036854775807.");
      return exact;
    }
    case "json-object": {
      try {
        const json: unknown = JSON.parse(value);
        if (json && typeof json === "object" && !Array.isArray(json)) return value;
      } catch {
        // Invalid JSON is handled below.
      }
      throw new Error("Введите JSON-объект. Если тегов нет, оставьте {}.");
    }
    case "tags": {
      const tags = value.split(",").map((tag) => tag.trim());
      if (tags.some((tag) => !tag)) throw new Error("Перечислите непустые теги через запятую.");
      return tags;
    }
    default:
      return value;
  }
}

export function changed(values: Values, baseline: Values) {
  return Object.keys({ ...baseline, ...values }).some((key) => values[key] !== baseline[key]);
}

export function useFields(initial: Values) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  function set(name: string, value: string | undefined) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => current[name] ? { ...current, [name]: undefined } : current);
  }

  function reset(next: Values) {
    setValues(next);
    setErrors({});
  }

  function read<T extends object>(
    fields: readonly Field[],
    checks?: (values: Values) => FieldErrors,
    baseline?: Values,
  ): T | undefined {
    const result: Record<string, unknown> = {};
    const invalid: FieldErrors = checks?.(values) ?? {};
    for (const field of fields) {
      const raw = values[field.name];
      const previous = baseline?.[field.name];
      if (baseline && previous?.trim() === raw?.trim()) continue;
      if (field.optional && raw === undefined) continue;
      try {
        const parsed = parse(field, raw ?? "");
        if (previous !== undefined && typeof parsed === "number" && Number(previous) === parsed) continue;
        result[field.name] = parsed;
      } catch (error) {
        invalid[field.name] = error instanceof Error ? error.message : "Проверьте значение.";
      }
    }
    setErrors(invalid);
    if (Object.values(invalid).some(Boolean)) {
      requestAnimationFrame(() => {
        const root = document.querySelector("dialog[open]:last-of-type") ?? document;
        const inputs = Array.from(root.querySelectorAll<HTMLElement>('[aria-invalid="true"]:not(:disabled)'));
        inputs.find((element) => element.getClientRects().length > 0)?.focus();
      });
      return undefined;
    }
    return result as T;
  }

  return { values, setValues, errors, setErrors, set, reset, read };
}

export type FormState = ReturnType<typeof useFields>;

function Control({ field, form, baseline }: { field: Field; form: FormState; baseline?: Values }) {
  const id = useId();
  const { name, label, kind = "text" } = field;
  const value = form.values[name];
  const error = form.errors[name];
  const absent = field.optional && value === undefined;
  const keepExisting = baseline?.[name] !== undefined;
  const help = [kind === "date-time" ? `Часовой пояс: ${timeZone}` : "", field.hint].filter(Boolean).join(" · ");
  const shared = {
    id,
    name,
    "aria-required": !field.optional,
    "aria-invalid": Boolean(error),
    "aria-describedby": [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
  };
  const omit = field.optional && !keepExisting && <label className="check omit">
    <input type="checkbox" checked={absent}
      onChange={(event) => form.set(name, event.target.checked ? undefined : kind === "bool" ? "false" : "")}
      aria-label={`Не указывать — ${label}`}/>
    Не указывать
  </label>;

  const inputType = kind === "date-time" ? "datetime-local"
    : kind === "int" ? "number"
      : ["number", "date", "time", "tel", "url"].includes(kind) ? kind : "text";

  let control: ReactNode;
  if (kind === "bool") {
    control = <input {...shared} type="checkbox" checked={value === "true"}
      onChange={(event) => form.set(name, String(event.target.checked))}/>;
  } else if (kind === "area" || kind === "json-object") {
    control = <textarea {...shared} rows={kind === "json-object" ? 3 : 4} value={value ?? ""} maxLength={field.maxLength}
      placeholder={field.placeholder} onChange={(event) => form.set(name, event.target.value)}/>;
  } else if (kind === "select") {
    control = <PopupButton {...shared} value={value ?? ""} onChange={(event) => form.set(name, event.target.value)}>
      <option value="">Выберите…</option>
      {field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </PopupButton>;
  } else {
    control = <input {...shared} type={inputType} value={value ?? ""} maxLength={field.maxLength}
      step={kind === "number" ? "any" : kind === "int" || kind === "time" || kind === "date-time" ? "1" : undefined}
      inputMode={kind === "osm" ? "numeric" : kind === "number" ? "decimal" : undefined}
      placeholder={field.placeholder} onChange={(event) => form.set(name, event.target.value)}/>;
  }

  return <div className={`form-row${field.wide ? " wide" : ""}`}>
    {absent ? <span>{label}</span> : <label htmlFor={id}>
      {label}{!field.optional && <span className="required-mark" aria-hidden="true"> *</span>}
    </label>}
    <div className="form-value">
      <div className="form-controls">
        {!absent && (kind === "bool" ? control : <div className="form-input">{control}</div>)}
        {omit}
      </div>
      {!absent && help && <small className="field-help" id={`${id}-help`}>{help}</small>}
      {error && <small className="field-error" id={`${id}-error`}>{error}</small>}
    </div>
  </div>;
}

export function Fields({ fields, form, baseline }: { fields: readonly Field[]; form: FormState; baseline?: Values }) {
  return <div className="form-group">
    {fields.map((field) => <Control key={field.name} field={field} form={form} baseline={baseline}/>)}
  </div>;
}

export function Form({ submit, id, locked, children }: {
  submit: () => void;
  id?: string;
  locked?: boolean;
  children: ReactNode;
}) {
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!locked) submit();
  }
  return <form id={id} noValidate onSubmit={handle}>
    <fieldset disabled={locked}>{children}</fieldset>
  </form>;
}
