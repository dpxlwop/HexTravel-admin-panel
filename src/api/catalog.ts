import { ApiError, request } from "./client";
import type {
  BookingCreateRequest, BookingResponse,
  FlightCreateRequest, FlightResponse,
  ItineraryDayCreateRequest, ItineraryDayResponse,
  ItineraryEventCreateRequest, ItineraryEventResponse,
  PhotoCreateRequest, PhotoResponse,
  PlaceCreateRequest, PlaceResponse,
  TransportCreateRequest, TransportResponse,
  TripCreateRequest, TripResponse, TripUpdateRequest,
  TripPointCreateRequest, TripPointResponse,
} from "./schema";

export type Saved<T> = T & { id: string };
export type PlaceInput = Omit<PlaceCreateRequest, "osmId"> & { osmId: string };
export type Place = Saved<Omit<PlaceResponse, "osmId">>;

export function osmId(value: string) {
  if (!/^\d{1,19}$/.test(value)) return undefined;
  const id = BigInt(value);
  return id > 0n && id <= 9223372036854775807n ? id.toString() : undefined;
}

export function isUuid(value: string) {
  return /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
}

function saved<T extends { id?: string | null }>(value: T, writing = false): Saved<T> {
  if (typeof value?.id !== "string" || !value.id) {
    throw new ApiError(200, undefined, writing, "В ответе API отсутствует идентификатор записи.");
  }
  return value as Saved<T>;
}

async function list<T extends { id?: string | null }>(path: string, signal?: AbortSignal) {
  const data = await request<T[]>(path, { signal });
  if (!Array.isArray(data)) throw new Error("API вернул некорректный список.");
  return data.map((item) => saved(item));
}

async function get<T extends { id?: string | null }>(path: string, signal?: AbortSignal) {
  return saved(await request<T>(path, { signal }));
}

async function post<T extends { id?: string | null }>(path: string, json: object) {
  return saved(await request<T>(path, { method: "POST", json }), true);
}

function remove(path: string) {
  return request<void>(path, { method: "DELETE", readAs: "none" });
}

const id = encodeURIComponent;
const trip = (tripId: string) => `/trips/${id(tripId)}`;
const points = (tripId: string) => `${trip(tripId)}/points`;
const days = (tripId: string) => `${trip(tripId)}/days`;
const day = (tripId: string, dayId: string) => `${days(tripId)}/${id(dayId)}`;
const transports = (tripId: string) => `${trip(tripId)}/transports`;
const transport = (tripId: string, transportId: string) => `${transports(tripId)}/${id(transportId)}`;
const bookings = (tripId: string) => `${trip(tripId)}/bookings`;
const photo = (photoId: string) => `/me/photos/${id(photoId)}`;

export const catalog = {
  trips: (signal?: AbortSignal) => list<TripResponse>("/trips", signal),
  trip: (tripId: string, signal?: AbortSignal) => get<TripResponse>(trip(tripId), signal),
  createTrip: (data: TripCreateRequest) => post<TripResponse>("/trips", data),
  async updateTrip(tripId: string, json: TripUpdateRequest) {
    return saved(await request<TripResponse>(trip(tripId), { method: "PATCH", json }), true);
  },

  points: (tripId: string, signal?: AbortSignal) => list<TripPointResponse>(points(tripId), signal),
  point: (tripId: string, pointId: string) => get<TripPointResponse>(`${points(tripId)}/${id(pointId)}`),
  createPoint: (tripId: string, data: TripPointCreateRequest) => post<TripPointResponse>(points(tripId), data),
  removePoint: (tripId: string, pointId: string) => remove(`${points(tripId)}/${id(pointId)}`),

  days: (tripId: string, signal?: AbortSignal) => list<ItineraryDayResponse>(days(tripId), signal),
  createDay: (tripId: string, data: ItineraryDayCreateRequest) => post<ItineraryDayResponse>(days(tripId), data),
  removeDay: (tripId: string, dayId: string) => remove(day(tripId, dayId)),
  events: (tripId: string, dayId: string, signal?: AbortSignal) =>
    list<ItineraryEventResponse>(`${day(tripId, dayId)}/events`, signal),
  createEvent: (tripId: string, dayId: string, pointId: string, data: ItineraryEventCreateRequest) =>
    post<ItineraryEventResponse>(`${day(tripId, dayId)}/${id(pointId)}/events`, data),
  removeEvent: (tripId: string, dayId: string, eventId: string) =>
    remove(`${day(tripId, dayId)}/events/${id(eventId)}`),

  transports: (tripId: string, signal?: AbortSignal) => list<TransportResponse>(transports(tripId), signal),
  transport: (tripId: string, transportId: string) => get<TransportResponse>(transport(tripId, transportId)),
  createTransport: (tripId: string, data: TransportCreateRequest) => post<TransportResponse>(transports(tripId), data),
  removeTransport: (tripId: string, transportId: string) => remove(transport(tripId, transportId)),
  async flight(tripId: string, transportId: string, signal?: AbortSignal) {
    try {
      const data = await request<FlightResponse | null>(`${transport(tripId, transportId)}/flight`, { signal });
      return data ? saved(data) : null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  createFlight: (tripId: string, transportId: string, data: FlightCreateRequest) =>
    post<FlightResponse>(`${transport(tripId, transportId)}/flight`, data),
  removeFlight: (tripId: string, transportId: string, flightId: string) =>
    remove(`${transport(tripId, transportId)}/flight/${id(flightId)}`),

  bookings: (tripId: string, signal?: AbortSignal) => list<BookingResponse>(bookings(tripId), signal),
  booking: (tripId: string, bookingId: string) => get<BookingResponse>(`${bookings(tripId)}/${id(bookingId)}`),
  createBooking: (tripId: string, data: BookingCreateRequest) => post<BookingResponse>(bookings(tripId), data),
  removeBooking: (tripId: string, bookingId: string) => remove(`${bookings(tripId)}/${id(bookingId)}`),

  place: (uuid: string) => get<Place>(`/places/${id(uuid)}`),
  placeByOsm: (key: string) => get<Place>(`/places/by-osm-id/${id(key)}`),
  async createPlace({ osmId: value, ...fields }: PlaceInput) {
    const key = osmId(value);
    if (!key) throw new Error("Укажите положительный OSM ID формата int64.");
    const fieldsJson = JSON.stringify(fields);
    const body = `{"osmId":${key}${fieldsJson === "{}" ? "}" : "," + fieldsJson.slice(1)}`;
    return saved(await request<Place>("/places", { method: "POST", body }), true);
  },

  photos: (tripId: string, signal?: AbortSignal) => list<PhotoResponse>(`/me/photos/trip/${id(tripId)}`, signal),
  createPhoto: (data: PhotoCreateRequest) => post<PhotoResponse>("/me/photos", data),
  photoFile: (photoId: string, signal?: AbortSignal) =>
    request<Blob>(`${photo(photoId)}/file`, { readAs: "blob", signal }),
  uploadPhoto: (photoId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<string>(`${photo(photoId)}/file`, { method: "POST", body, readAs: "text" });
  },
  removePhoto: (photoId: string) => remove(photo(photoId)),
};
