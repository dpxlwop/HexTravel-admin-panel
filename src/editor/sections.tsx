import { useState } from "react";
import { catalog } from "../api/catalog";
import type { Saved } from "../api/catalog";
import type {
  BookingCreateRequest, BookingResponse, FlightCreateRequest, ItineraryDayCreateRequest,
  ItineraryDayResponse, ItineraryEventCreateRequest, PhotoResponse, TransportCreateRequest, TransportResponse,
  TripPointCreateRequest, TripPointResponse,
} from "../api/schema";
import { compareDates } from "../components/fields";
import type { Field } from "../components/fields";
import { Loading } from "../components/feedback";
import { matches, newMatch, useResource, useRows } from "../components/state";
import { Notice, showDate, showDateTime } from "../components/ui";
import { bookingFields, dayFields, eventFields, flightFields, pointFields, transportFields } from "./definitions";
import { PlacePicker } from "./PlacePicker";
import { AddPanel, RecordCard, RecordForm, RemoveButton, RowDetails, byIndex, nextIndex } from "./records";

export type Rows<T extends { id: string }> = ReturnType<typeof useRows<T>>;

export const sections = ["Основное", "Точки маршрута", "Программа", "Транспорт", "Бронирования", "Фото"] as const;
export type Section = typeof sections[number];

export function Points({ tripId, rows, days, photos, onChange }: {
  tripId: string;
  rows: Rows<Saved<TripPointResponse>>;
  days: Rows<Saved<ItineraryDayResponse>>;
  photos: Rows<Saved<PhotoResponse>>;
  onChange: () => void;
}) {
  async function links(pointId: string) {
    const [allDays, allPhotos] = await Promise.all([
      days.data ? Promise.resolve(days.data) : catalog.days(tripId),
      photos.data ? Promise.resolve(photos.data) : catalog.photos(tripId),
    ]);
    const allEvents = (await Promise.all(allDays.map((day) => catalog.events(tripId, day.id)))).flat();
    return [
      ...allEvents.filter((event) => event.tripPointId === pointId).map((event) => `Событие «${event.title || event.id}»`),
      ...allPhotos.filter((photo) => photo.tripPointId === pointId).map((photo) => `Фото «${photo.caption || photo.id}»`),
    ];
  }

  return <Loading loading={rows.loading} error={rows.error} retry={() => { void rows.reload().catch(() => {}); }}>
    <Notice>{rows.notice}</Notice>
    {rows.data && <>
      <div className="records">
        {byIndex(rows.items, (row) => row.orderIndex).map((row) => (
          <RecordCard key={row.id} row={row} title={row.name || "Точка маршрута"}
            summary={[row.orderIndex, row.address].filter((x) => x != null && x !== "").join(" · ")}
            load={() => catalog.point(tripId, row.id)}>
            {(point) => <>
              <RowDetails row={point} fields={pointFields}/>
              <RemoveButton name="точку" links={() => links(point.id)} remove={async () => {
                await catalog.removePoint(tripId, point.id);
                rows.drop(point.id);
                onChange();
                void days.reload().catch(() => {});
                void photos.reload().catch(() => {});
              }}/>
            </>}
          </RecordCard>
        ))}
      </div>
      <AddPanel empty={rows.items.length === 0} title="В маршруте пока нет точек" label="Добавить точку"
        renderForm={(close) => <RecordForm
          title="Новая точка" section="Точки маршрута" fields={pointFields}
          initial={{ orderIndex: String(nextIndex(rows.items.map((row) => row.orderIndex))) }}
          checks={(values) => ({
            ...compareDates(values, "arrivalTime", "departureTime", "Отправление должно быть не раньше прибытия."),
            ...(values.orderIndex?.trim() && rows.items.some((row) => Number(values.orderIndex) === row.orderIndex)
              ? { orderIndex: "Этот индекс уже занят в маршруте." } : {}),
          })}
          beforeFields={(form) => <PlacePicker value={form.values.placeId} error={form.errors.placeId} label="Место маршрута"
            suggestions={{
              name: form.values.name, address: form.values.address,
              latitude: form.values.latitude, longitude: form.values.longitude,
            }}
            onChoose={(place) => {
              form.set("placeId", place.id);
              const fromPlace = { name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude };
              form.setValues((values) => {
                const next = { ...values };
                for (const [key, value] of Object.entries(fromPlace)) {
                  if (!values[key]?.trim() && value != null) next[key] = String(value);
                }
                return next;
              });
            }}/>}
          save={(data: TripPointCreateRequest) => catalog.createPoint(tripId, data)}
          find={async (data) => newMatch(await rows.reload() ?? [], rows.items, data)}
          onSaved={rows.upsert} close={close}
        />}/>
    </>}
  </Loading>;
}

function Day({ tripId, day, points, open, revision, remove }: {
  tripId: string;
  day: Saved<ItineraryDayResponse>;
  points: Saved<TripPointResponse>[];
  open: boolean;
  revision: number;
  remove: () => Promise<void>;
}) {
  const events = useRows((signal) => catalog.events(tripId, day.id, signal), open ? `${day.id}/${revision}` : null);
  const pointField: Field = {
    name: "tripPointId", label: "Точка маршрута", kind: "select", wide: true,
    options: byIndex(points, (point) => point.orderIndex).map((point) => ({
      value: point.id,
      label: point.name || point.id,
    })),
  };
  const fields = [pointField, ...eventFields];

  return <>
    <RowDetails row={day} fields={dayFields}/>
    <div className="nested-section">
      <h3>События дня</h3>
      <Loading loading={events.loading} error={events.error} retry={() => { void events.reload().catch(() => {}); }}>
        <Notice>{events.notice}</Notice>
        {events.data && <>
          <div className="records">
            {byIndex(events.items, (event) => event.orderIndex).map((event) => (
              <RecordCard key={event.id} row={event} title={event.title || "Событие"}
                summary={[event.startTime, event.endTime].filter(Boolean).join(" — ")}>
                {(row) => <>
                  <RowDetails row={{ ...row,
                    tripPointId: points.find((point) => point.id === row.tripPointId)?.name ?? row.tripPointId,
                  }} fields={fields}/>
                  <RemoveButton name="событие" remove={async () => {
                    await catalog.removeEvent(tripId, day.id, row.id);
                    events.drop(row.id);
                  }}/>
                </>}
              </RecordCard>
            ))}
          </div>
          {points.length === 0 && <Notice>Добавьте точку маршрута, чтобы привязать к ней событие.</Notice>}
          <AddPanel empty={events.items.length === 0} allowSkip label="Добавить событие" title="Событий пока нет"
            locked={points.length === 0}
            renderForm={(close) => <RecordForm
              title="Новое событие" section="Программа" fields={fields}
              initial={{ orderIndex: String(nextIndex(events.items.map((row) => row.orderIndex))) }}
              save={({ tripPointId, ...data }: ItineraryEventCreateRequest & { tripPointId: string }) =>
                catalog.createEvent(tripId, day.id, tripPointId, data)}
              find={async (data) => newMatch(await events.reload() ?? [], events.items, data)}
              onSaved={events.upsert} close={close}
            />}/>
        </>}
      </Loading>
    </div>
    <RemoveButton name="день" links={async () => (await catalog.events(tripId, day.id)).map((event) =>
      `Событие «${event.title || event.id}»`)} remove={remove}/>
  </>;
}

export function Program({ tripId, rows, points, pointRevision }: {
  tripId: string;
  rows: Rows<Saved<ItineraryDayResponse>>;
  points: Saved<TripPointResponse>[];
  pointRevision: number;
}) {
  return <Loading loading={rows.loading} error={rows.error} retry={() => { void rows.reload().catch(() => {}); }}>
    <Notice>{rows.notice}</Notice>
    {rows.data && <>
      <div className="records">
        {byIndex(rows.items, (row) => row.dayNumber).map((row) => (
          <RecordCard key={row.id} row={row} title={row.title || "День программы"}
            summary={`День ${row.dayNumber ?? "—"} · ${showDate(row.date)}`}>
            {(day, open) => <Day tripId={tripId} day={day} points={points} revision={pointRevision} open={open}
              remove={async () => {
                await catalog.removeDay(tripId, day.id);
                rows.drop(day.id);
              }}/>}
          </RecordCard>
        ))}
      </div>
      <AddPanel empty={rows.items.length === 0} allowSkip title="Программа ещё не добавлена" label="Добавить день"
        renderForm={(close) => <RecordForm
          title="Новый день" section="Программа" fields={dayFields}
          initial={{ dayNumber: String(nextIndex(rows.items.map((row) => row.dayNumber), 1)) }}
          save={(data: ItineraryDayCreateRequest) => catalog.createDay(tripId, data)}
          find={async (data) => newMatch(await rows.reload() ?? [], rows.items, data)}
          onSaved={rows.upsert} close={close}
        />}/>
    </>}
  </Loading>;
}

function TransportDetails({ row, tripId, open, remove }: {
  row: Saved<TransportResponse>;
  tripId: string;
  open: boolean;
  remove: () => Promise<void>;
}) {
  const flight = useResource((signal) => catalog.flight(tripId, row.id, signal), open ? row.id : null);
  const [notice, setNotice] = useState("");

  return <>
    <RowDetails row={row} fields={transportFields}/>
    <div className="nested-section">
      <h3>Детали рейса</h3>
      <Loading loading={flight.loading} error={flight.error} retry={() => { void flight.reload().catch(() => {}); }}>
        <Notice>{notice}</Notice>
        {flight.data && <>
          <RowDetails row={flight.data} fields={flightFields}/>
          <RemoveButton name="рейс" remove={async () => {
            if (!flight.data) return;
            await catalog.removeFlight(tripId, row.id, flight.data.id);
            flight.setData(null);
            setNotice("Рейс удалён.");
          }}/>
        </>}
        {flight.data === null && <AddPanel empty allowSkip label="Добавить рейс" title="Деталей рейса пока нет"
          renderForm={(close) => <RecordForm
            title="Новый рейс" section="Транспорт" fields={flightFields} initial={{}}
            save={(data: FlightCreateRequest) => catalog.createFlight(tripId, row.id, data)}
            find={async (data) => {
              const found = await catalog.flight(tripId, row.id);
              if (found && !matches(found, data)) throw new Error("К отрезку уже привязан другой рейс. Проверьте его перед повтором.");
              return found ?? undefined;
            }}
            onSaved={(savedFlight) => { flight.setData(savedFlight); setNotice("Рейс сохранён."); }} close={close}
          />}/>}
      </Loading>
    </div>
    <RemoveButton name="отрезок" links={async () => {
      const found = await catalog.flight(tripId, row.id);
      return found ? [`Рейс ${found.flightNumber || found.id}`] : [];
    }} remove={remove}/>
  </>;
}

export function Transports({ tripId, rows, currency }: {
  tripId: string;
  rows: Rows<Saved<TransportResponse>>;
  currency: string | undefined;
}) {
  return <Loading loading={rows.loading} error={rows.error} retry={() => { void rows.reload().catch(() => {}); }}>
    <Notice>{rows.notice}</Notice>
    {rows.data && <>
      <div className="records">
        {rows.items.map((row) => (
          <RecordCard key={row.id} row={row} title={[row.company, row.vehicleNumber].filter(Boolean).join(" · ") || "Транспорт"}
            summary={[row.transportType, showDateTime(row.departureTime)].filter(Boolean).join(" · ")}
            load={() => catalog.transport(tripId, row.id)}>
            {(details, open) => <TransportDetails row={details} tripId={tripId} open={open}
              remove={async () => {
                await catalog.removeTransport(tripId, details.id);
                rows.drop(details.id);
              }}/>}
          </RecordCard>
        ))}
      </div>
      <AddPanel empty={rows.items.length === 0} allowSkip label="Добавить транспорт" title="Транспорт ещё не добавлен"
        renderForm={(close) => <RecordForm
          title="Новый транспортный отрезок" section="Транспорт" fields={transportFields} initial={{ currency }}
          save={(data: TransportCreateRequest) => catalog.createTransport(tripId, data)}
          find={async (data) => newMatch(await rows.reload() ?? [], rows.items, data)}
          onSaved={rows.upsert} close={close}
        />}/>
    </>}
  </Loading>;
}

export function Bookings({ tripId, rows, currency }: {
  tripId: string;
  rows: Rows<Saved<BookingResponse>>;
  currency: string | undefined;
}) {
  return <Loading loading={rows.loading} error={rows.error} retry={() => { void rows.reload().catch(() => {}); }}>
    <Notice>{rows.notice}</Notice>
    {rows.data && <>
      <div className="records">
        {rows.items.map((row) => (
          <RecordCard key={row.id} row={row} title={[row.bookingType, row.status].filter(Boolean).join(" · ") || "Бронирование"}
            summary={`${showDateTime(row.checkIn)} — ${showDateTime(row.checkOut)}`}
            load={() => catalog.booking(tripId, row.id)}>
            {(booking) => <>
              <RowDetails row={booking} fields={bookingFields}/>
              <RemoveButton name="бронирование" remove={async () => {
                await catalog.removeBooking(tripId, booking.id);
                rows.drop(booking.id);
              }}/>
            </>}
          </RecordCard>
        ))}
      </div>
      <AddPanel empty={rows.items.length === 0} allowSkip label="Добавить бронирование" title="Бронирований пока нет"
        renderForm={(close) => <RecordForm
          title="Новое бронирование" section="Бронирования" fields={bookingFields} initial={{ currency }}
          beforeFields={(form) => <PlacePicker value={form.values.placeId} error={form.errors.placeId}
            onChoose={(place) => form.set("placeId", place.id)}/>}
          save={(data: BookingCreateRequest) => catalog.createBooking(tripId, data)}
          find={async (data) => newMatch(await rows.reload() ?? [], rows.items, data)}
          onSaved={rows.upsert} close={close}
        />}/>
    </>}
  </Loading>;
}

