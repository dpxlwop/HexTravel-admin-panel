import { useId, useState } from "react";
import { ApiError } from "../api/client";
import { catalog, isUuid, osmId } from "../api/catalog";
import type { Place, PlaceInput } from "../api/catalog";
import { Fields, Form, useFields } from "../components/fields";
import type { Values } from "../components/fields";
import { MutationFeedback } from "../components/feedback";
import { useAction, useMutation } from "../components/state";
import { Details, Dialog, Icon, Notice, PopupButton } from "../components/ui";
import { placeFields } from "./definitions";

function PlaceSummary({ place }: { place: Place }) {
  return <div className="place-result">
    <strong>{place.name || place.id}</strong>
    <Details entries={[
      ["Адрес", [place.address, place.city, place.country].filter(Boolean).join(", ")],
      ["Координаты", place.latitude != null && place.longitude != null ? `${place.latitude}, ${place.longitude}` : undefined],
    ]}/>
  </div>;
}

function PlaceDialog({ initial, close, choose }: { initial: Values; close: () => void; choose: (place: Place) => void }) {
  const form = useFields({ ...initial, osmTags: "{}" });
  const action = useMutation();
  const [existing, setExisting] = useState<Place>();

  function submit(complete: (place: Place) => void) {
    const data = form.read<PlaceInput>(placeFields);
    if (!data) return;
    setExisting(undefined);
    void action.run(async () => {
      try {
        complete(await catalog.createPlace(data));
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        setExisting(await catalog.placeByOsm(data.osmId));
        action.setNotice("На сервере уже есть место с этим OSM ID.");
      }
    }, async () => {
      try {
        setExisting(await catalog.placeByOsm(data.osmId));
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return false;
        throw error;
      }
    });
  }

  return <Dialog title="Создать место" close={close} locked={action.busy}>{(dismiss) => <>
    <Form submit={() => submit((place) => dismiss(() => choose(place)))} locked={action.busy || action.needsVerification}>
      <Fields fields={placeFields} form={form}/>
      <div className="button-row dialog-actions">
        <button className="button" type="button" onClick={() => dismiss()}>Отмена</button>
        <button className="button primary" type="submit">{action.busy ? "Сохраняем…" : "Сохранить место"}</button>
      </div>
    </Form>
    <MutationFeedback state={action}/>
    {existing && <div className="place-candidate">
      <PlaceSummary place={existing}/>
      <button className="button primary" type="button" onClick={() => dismiss(() => choose(existing))}>Выбрать найденное место</button>
    </div>}
  </>}</Dialog>;
}

export function PlacePicker({ value, onChoose, optional = false, onToggle, error, suggestions, label = "Место" }: {
  value: string | undefined;
  onChoose: (place: Place) => void;
  optional?: boolean;
  onToggle?: (omitted: boolean) => void;
  error?: string;
  suggestions?: Values;
  label?: string;
}) {
  const lookup = useAction();
  const labelId = useId();
  const lookupId = useId();
  const [mode, setMode] = useState<"osm" | "uuid">("osm");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place>();
  const [result, setResult] = useState<Place>();
  const [missing, setMissing] = useState("");
  const [dialog, setDialog] = useState(false);

  function resetResult() {
    setResult(undefined);
    setMissing("");
    lookup.setError("");
  }

  function find() {
    const text = query.trim();
    const key = mode === "osm" ? osmId(text) : isUuid(text) ? text : undefined;
    resetResult();
    if (!key) {
      lookup.setError(mode === "osm" ? "Введите положительный OSM ID до 9223372036854775807." : "Введите UUID места.");
      return;
    }
    void lookup.run(async () => {
      try {
        setResult(await (mode === "osm" ? catalog.placeByOsm(key) : catalog.place(key)));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) setMissing(key);
        else throw error;
      }
    });
  }

  function choose(place: Place) {
    setSelected(place);
    setResult(undefined);
    setMissing("");
    setDialog(false);
    onChoose(place);
  }

  return <div className="place-picker" role="group" aria-labelledby={labelId}>
    <div className="field-label">
      <span id={labelId}>{label}{!optional && <span className="required-mark" aria-hidden="true"> *</span>}</span>
      {optional && <label className="check omit">
        <input type="checkbox" aria-label={`Не указывать — ${label}`} checked={value === undefined}
          onChange={(event) => { resetResult(); onToggle?.(event.target.checked); }}/>
        Не указывать
      </label>}
    </div>
    {(!optional || value !== undefined) && <>
      {value && (selected?.id === value
        ? <PlaceSummary place={selected}/>
        : <p className="muted id-value">Выбранное место · {value}</p>)}
      <div className="place-search">
        <PopupButton aria-label="Способ поиска места" value={mode} disabled={lookup.busy} onChange={(event) => {
          setMode(event.target.value === "uuid" ? "uuid" : "osm");
          setQuery("");
          resetResult();
        }}>
          <option value="osm">По OSM ID</option>
          <option value="uuid">По ID места</option>
        </PopupButton>
        <input aria-label={mode === "osm" ? "OSM ID для поиска" : "UUID места для поиска"}
          placeholder={mode === "osm" ? "Например, 154321098" : "UUID места"}
          value={query} disabled={lookup.busy} autoComplete="off"
          inputMode={mode === "osm" ? "numeric" : "text"} aria-invalid={Boolean(error || lookup.error)}
          aria-describedby={error ? lookupId : undefined}
          onChange={(event) => { setQuery(event.target.value); resetResult(); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); find(); } }}/>
        <button type="button" className="button" onClick={find} disabled={lookup.busy}>
          <Icon name="search"/>{lookup.busy ? "Ищем…" : lookup.error ? "Повторить" : "Найти"}
        </button>
      </div>
      {error && <small id={lookupId} className="field-error">{error}</small>}
      <Notice error>{lookup.error}</Notice>
      {result && <div className="place-candidate">
        <PlaceSummary place={result}/>
        <button type="button" className="button primary" onClick={() => choose(result)}>Выбрать место</button>
      </div>}
      {missing && <Notice>
        <span>Место не найдено.</span>
        <button type="button" className="button" onClick={() => setDialog(true)}>Создать место</button>
      </Notice>}
    </>}
    {dialog && <PlaceDialog
      initial={{ ...suggestions, osmId: mode === "osm" ? missing : "" }}
      close={() => setDialog(false)} choose={choose}/>}
  </div>;
}
