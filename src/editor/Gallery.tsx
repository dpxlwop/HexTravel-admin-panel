import { useEffect, useId, useState } from "react";
import { ApiError } from "../api/client";
import { catalog } from "../api/catalog";
import type { Saved } from "../api/catalog";
import type { PhotoCreateRequest, PhotoResponse, TripPointResponse } from "../api/schema";
import { useDirty } from "../components/dirty";
import { Fields, Form, changed, useFields } from "../components/fields";
import type { Field } from "../components/fields";
import { Loading, MutationFeedback } from "../components/feedback";
import { newMatch, useMutation, useResource } from "../components/state";
import { Details, Icon, Notice, showDateTime } from "../components/ui";
import { config } from "../config";
import { photoFields } from "./definitions";
import { PlacePicker } from "./PlacePicker";
import { AddPanel, RemoveButton, byIndex } from "./records";
import type { Rows } from "./sections";

const mime = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp",
  gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff",
} as const;
type ImageExtension = keyof typeof mime;
const accept = Object.keys(mime).map((key) => `.${key}`).join(",");
const MiB = 1024 * 1024;

function extension(value: string | null | undefined) {
  const key = value?.toLowerCase() ?? "";
  return Object.hasOwn(mime, key) ? key as ImageExtension : undefined;
}

function fileExtension(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot >= 0 ? extension(file.name.slice(dot + 1)) : undefined;
}

function validate(file: File | undefined) {
  if (!file || file.size === 0) return "Выберите непустой файл.";
  if (!fileExtension(file)) {
    return "Поддерживаются JPG, JPEG, PNG, HEIC, WebP, GIF, BMP и TIFF.";
  }
  if (config.photoFileLimit > 0 && file.size > config.photoFileLimit) {
    return `Файл должен быть не больше ${config.photoFileLimit / MiB} МиБ.`;
  }
  if (config.photoRequestLimit > 0 && file.size + 1024 + new TextEncoder().encode(file.name).length > config.photoRequestLimit) {
    return `Файл вместе с multipart должен помещаться в ${config.photoRequestLimit / MiB} МиБ.`;
  }
  return "";
}

function FileInput({ onFile, error }: { onFile: (file: File | undefined) => void; error: string }) {
  const id = useId();
  return <div className="field file-field">
    <label htmlFor={id}>Файл фото <span aria-hidden="true">*</span></label>
    <input id={id} type="file" accept={accept} aria-required="true" aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : `${id}-hint`}
      onChange={(event) => onFile(event.target.files?.[0])}/>
    {error
      ? <small className="field-error" id={`${id}-error`}>{error}</small>
      : <small className="field-help" id={`${id}-hint`}>JPG, JPEG, PNG, HEIC, WebP, GIF, BMP или TIFF</small>}
  </div>;
}

async function photoFile(id: string, signal?: AbortSignal) {
  try {
    return await catalog.photoFile(id, signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function Preview({ file, fileExt, name }: { file: Blob; fileExt?: ImageExtension; name: string }) {
  const [url, setUrl] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const inferred = Object.entries(mime).find(([, mediaType]) => file.type === mediaType)?.[0];
  const type = fileExt ? mime[fileExt] : "application/octet-stream";

  useEffect(() => {
    const data = file.type.startsWith("image/") ? file : new Blob([file], { type });
    const objectUrl = URL.createObjectURL(data);
    setUrl(objectUrl);
    setUnsupported(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, type]);

  if (!url) return null;
  return <div className="photo-preview">
    {unsupported ? <div className="photo-placeholder"><Icon name="photo"/><span>Превью недоступно</span></div>
      : <img src={url} alt={name} onError={() => setUnsupported(true)}/>}
    <a className="button quiet" href={url} download={`hextravel-photo.${fileExt ?? inferred ?? "bin"}`}>Скачать файл</a>
  </div>;
}

function PhotoCard({ row, active, remove, points }: {
  row: Saved<PhotoResponse>;
  active: boolean;
  remove: () => Promise<void>;
  points: Saved<TripPointResponse>[];
}) {
  const preview = useResource((signal) => photoFile(row.id, signal), active ? row.id : null);
  const retry = useMutation();
  const draftKey = useId();
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState("");
  const [uploadedExtension, setUploadedExtension] = useState<ImageExtension>();
  useDirty(draftKey, "Фото", Boolean(file) || retry.busy || retry.needsVerification);

  function upload() {
    const invalid = validate(file);
    setFileError(invalid);
    if (invalid || !file) return;
    void retry.run(async () => {
      await catalog.uploadPhoto(row.id, file);
      setUploadedExtension(fileExtension(file));
      setFile(undefined);
      retry.setNotice("Файл загружен.");
      await preview.reload().catch(() => {});
    }, async () => {
      const result = await preview.reload();
      if (result) {
        setUploadedExtension(fileExtension(file));
        setFile(undefined);
      }
      return Boolean(result);
    });
  }

  return <article className="photo-card">
    <div className="photo-card-head">
      <span className="photo-label"><Icon name="photo"/><strong>{row.caption || "Фото тура"}</strong></span>
      <span className="photo-visibility">{row.isPublic ? "Публичное" : "Непубличное"}</span>
    </div>
    {active && <Loading loading={preview.loading} error={preview.error}
      retry={() => { void preview.reload().catch(() => {}); }}>
      {preview.data && <Preview file={preview.data} fileExt={uploadedExtension ?? extension(row.fileWebExtension)} name={row.caption || "Фото тура"}/>}
      {preview.data === null && <>
        <Notice>Файл не загружен.</Notice>
        <Form submit={upload} locked={retry.busy || retry.needsVerification}>
          <FileInput error={fileError} onFile={(value) => { setFile(value); setFileError(""); }}/>
          <button className="button" type="submit">{retry.busy ? "Загружаем…" : "Загрузить файл"}</button>
        </Form>
      </>}
    </Loading>}
    <MutationFeedback state={retry}/>
    <Details entries={[
      ["Дата съёмки", row.takenAt ? showDateTime(row.takenAt) : undefined],
      ["Место", row.placeId],
      ["Точка", points.find((point) => point.id === row.tripPointId)?.name ?? row.tripPointId],
      ["Координаты", row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : undefined],
    ]}/>
    <RemoveButton name="фото" remove={remove}/>
  </article>;
}

const initial = { isPublic: "false" };

function PhotoForm({ tripId, points, rows, onSaved, close }: {
  tripId: string;
  points: Saved<TripPointResponse>[];
  rows: Rows<Saved<PhotoResponse>>;
  onSaved: (row: Saved<PhotoResponse>, notice: string) => void;
  close: () => void;
}) {
  const form = useFields(initial);
  const action = useMutation();
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState("");
  const [created, setCreated] = useState<Saved<PhotoResponse>>();
  const dirtyKey = useId();
  useDirty(dirtyKey, "Фото", changed(form.values, initial) || Boolean(file || created) || action.busy || action.needsVerification);

  const point: Field = {
    name: "tripPointId", label: "Точка маршрута", optional: true, kind: "select",
    options: byIndex(points, (item) => item.orderIndex).map((item) => ({ value: item.id, label: item.name || item.id })),
  };
  const fields = [...photoFields, point];

  function complete(row: Saved<PhotoResponse>, attachment: File) {
    const knownExtension = fileExtension(attachment)?.toUpperCase() as PhotoResponse["fileWebExtension"];
    onSaved({ ...row, fileWebExtension: knownExtension ?? row.fileWebExtension }, "Фото добавлено. Файл загружен.");
    close();
  }

  async function upload(row: Saved<PhotoResponse>, attachment: File) {
    await catalog.uploadPhoto(row.id, attachment);
    complete(row, attachment);
  }

  function submit() {
    const invalid = validate(file);
    setFileError(invalid);
    if (invalid || !file) return;
    if (created) {
      void action.run(() => upload(created, file), async () => {
        if (!await photoFile(created.id)) return false;
        complete(created, file);
        return true;
      });
      return;
    }

    const metadata = form.read<Omit<PhotoCreateRequest, "tripId">>(fields);
    if (!metadata) return;
    const data = { ...metadata, tripId };
    let savedPhoto: Saved<PhotoResponse> | undefined;
    void action.run(async () => {
      savedPhoto = await catalog.createPhoto(data);
      setCreated(savedPhoto);
      await upload(savedPhoto, file);
    }, async () => {
      if (savedPhoto) {
        if (!await photoFile(savedPhoto.id)) return false;
        complete(savedPhoto, file);
        return true;
      }
      const found = newMatch(await rows.reload() ?? [], rows.items, data);
      if (found) setCreated(found);
      return Boolean(found);
    });
  }

  function done() {
    if (created) onSaved(created, "Метаданные сохранены. Файл можно загрузить в карточке фото.");
    close();
  }

  return <div className="record-form">
    <h3>{created ? "Загрузка файла" : "Новое фото"}</h3>
    {created && <Notice>Метаданные сохранены. Файл не загружен.</Notice>}
    <Form submit={submit} locked={action.busy || action.needsVerification}>
      {!created && <>
        <PlacePicker label="Привязка к месту" value={form.values.placeId} onToggle={(omit) => form.set("placeId", omit ? undefined : "")}
          onChoose={(place) => form.set("placeId", place.id)} error={form.errors.placeId} optional/>
        <Fields fields={fields.filter((field) => field.kind !== "uuid")} form={form}/>
      </>}
      <FileInput onFile={(attachment) => { setFile(attachment); setFileError(""); }} error={fileError}/>
      <div className="button-row form-actions">
        <button className="button primary" type="submit">{action.busy ? "Сохраняем…" : created ? "Повторить загрузку" : "Сохранить и загрузить"}</button>
        <button className="button quiet" type="button" onClick={done}>{created ? "В галерею" : "Отмена"}</button>
      </div>
    </Form>
    <MutationFeedback state={action}/>
  </div>;
}

export function Gallery({ tripId, rows, points, active }: {
  tripId: string;
  rows: Rows<Saved<PhotoResponse>>;
  points: Saved<TripPointResponse>[];
  active: boolean;
}) {
  const [notice, setNotice] = useState("");
  return <Loading loading={rows.loading} error={rows.error} retry={() => { void rows.reload().catch(() => {}); }}>
    <Notice>{notice}</Notice>
    {rows.data && <>
      <div className="photos">
        {rows.items.map((row) => <PhotoCard key={row.id} row={row} active={active} points={points}
          remove={async () => {
            await catalog.removePhoto(row.id);
            rows.drop(row.id);
            setNotice("Фото удалено.");
          }}/>)}
      </div>
      <AddPanel empty={rows.items.length === 0} allowSkip title="В галерее пока нет фотографий" label="Добавить фото"
        renderForm={(close) => <PhotoForm tripId={tripId} points={points} rows={rows} close={close}
          onSaved={(row, message) => {
            rows.upsert(row);
            setNotice(message);
          }}/>}
      />
    </>}
  </Loading>;
}
