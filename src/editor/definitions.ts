import type { Field } from "../components/fields";
import type { TripCreateRequest } from "../api/schema";

export const tripStatuses = {
  PLANNED: "Запланирована",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
} satisfies Record<TripCreateRequest["status"], string>;

const currency: Field = {
  name: "currency", label: "Валюта", maxLength: 3, pattern: /^[A-Z]{3}$/, placeholder: "RUB",
  hint: "Три заглавные латинские буквы, например RUB.",
};

const description: Field = { name: "description", label: "Описание", kind: "area", optional: true, wide: true };
const notes: Field = { name: "notes", label: "Примечания", kind: "area", optional: true, wide: true };
const name: Field = { name: "name", label: "Название", maxLength: 255 };
const placeId: Field = { name: "placeId", label: "Место", kind: "uuid" };
const lat: Field = { name: "latitude", label: "Широта", kind: "number", min: -90, max: 90 };
const lng: Field = { name: "longitude", label: "Долгота", kind: "number", min: -180, max: 180 };
const index: Field = { name: "orderIndex", label: "Порядковый индекс", kind: "int", min: 0 };
const duration: Field = { name: "durationHours", label: "Длительность, ч", kind: "number", optional: true, min: 0 };
const airport = { maxLength: 3, pattern: /^[A-Z]{3}$/, hint: "Три заглавные латинские буквы." };

export const tripCore: readonly Field[] = [
  { name: "title", label: "Название тура", maxLength: 255, wide: true, placeholder: "Например, Выходные в Карелии" },
  { name: "startDate", label: "Дата начала", kind: "date", future: true },
  { name: "endDate", label: "Дата окончания", kind: "date", future: true },
  { name: "status", label: "Состояние поездки", kind: "select",
    options: Object.entries(tripStatuses).map(([value, label]) => ({ value, label })) },
  currency,
  { name: "coverImageUrl", label: "URL обложки", kind: "url", maxLength: 500, wide: true, placeholder: "https://…" },
  { ...description, maxLength: 10000 },
  { name: "budget", label: "Бюджет", kind: "number", min: 0, optional: true },
];

export const tripCoordinates: readonly Field[] = [
  { ...lat, name: "startLat", label: "Широта начала", optional: true },
  { ...lng, name: "startLng", label: "Долгота начала", optional: true },
  { ...lat, name: "endLat", label: "Широта окончания", optional: true },
  { ...lng, name: "endLng", label: "Долгота окончания", optional: true },
];

export const tripFields = [...tripCore, ...tripCoordinates];

export const pointFields: readonly Field[] = [
  placeId,
  { ...name, label: "Название точки" },
  index,
  { name: "pointType", label: "Тип точки", placeholder: "SIGHTSEEING" },
  { name: "address", label: "Адрес", wide: true },
  lat, lng,
  { ...description, maxLength: 10000 },
  { name: "arrivalTime", label: "Прибытие", kind: "date-time", future: true, optional: true },
  { name: "departureTime", label: "Отправление", kind: "date-time", future: true, optional: true },
  { ...duration, positive: true },
];

export const dayFields: readonly Field[] = [
  { name: "title", label: "Название дня", maxLength: 255, wide: true },
  { name: "dayNumber", label: "Номер дня", kind: "int", min: 1 },
  { name: "date", label: "Дата", kind: "date", future: true },
  notes,
];

export const eventFields: readonly Field[] = [
  { name: "title", label: "Название события", maxLength: 255 },
  index,
  { name: "startTime", label: "Время начала", kind: "time", hint: "Локальное время без смещения." },
  { name: "endTime", label: "Время окончания", kind: "time", hint: "Локальное время без смещения." },
  description,
];

export const transportFields: readonly Field[] = [
  { name: "transportType", label: "Тип транспорта", maxLength: 50, placeholder: "FLIGHT" },
  { name: "company", label: "Перевозчик", maxLength: 255 },
  { name: "vehicleNumber", label: "Номер транспортного средства", maxLength: 100 },
  currency,
  { name: "departureTime", label: "Отправление", kind: "date-time", future: true },
  { name: "arrivalTime", label: "Прибытие", kind: "date-time", future: true },
  duration,
  { name: "ticketPrice", label: "Цена билета", kind: "number", optional: true, min: 0 },
  notes,
];

export const flightFields: readonly Field[] = [
  { name: "airline", label: "Авиакомпания" },
  { name: "flightNumber", label: "Номер рейса" },
  { ...airport, name: "departureAirport", label: "Аэропорт вылета", placeholder: "SVO" },
  { ...airport, name: "arrivalAirport", label: "Аэропорт прилёта", placeholder: "LED" },
  { name: "terminalDeparture", label: "Терминал вылета" },
  { name: "terminalArrival", label: "Терминал прилёта" },
  { name: "baggageAllowance", label: "Норма багажа", placeholder: "23 кг" },
  { name: "seatNumber", label: "Номер места", placeholder: "14C" },
];

export const bookingFields: readonly Field[] = [
  placeId,
  { name: "bookingType", label: "Тип бронирования", placeholder: "HOTEL" },
  { name: "status", label: "Статус бронирования", placeholder: "CONFIRMED" },
  { name: "checkIn", label: "Заезд", kind: "date-time", future: true },
  { name: "checkOut", label: "Выезд", kind: "date-time", future: true },
  { name: "guestsCount", label: "Количество гостей", kind: "int", min: 1 },
  { name: "confirmationNumber", label: "Телефон клиента", kind: "tel", pattern: /^\+?\d{10,15}$/,
    maxLength: 16, hint: "10–15 цифр, можно начать с +." },
  { name: "totalPrice", label: "Стоимость", kind: "number", min: 0 },
  currency,
  notes,
];

export const placeFields: readonly Field[] = [
  { ...name, label: "Название места", wide: true },
  { name: "osmId", label: "OSM ID", kind: "osm", maxLength: 19 },
  { name: "osmCategory", label: "Категория OSM", placeholder: "tourism" },
  { name: "osmValue", label: "Значение категории OSM", placeholder: "museum" },
  { name: "address", label: "Адрес" },
  { name: "city", label: "Город" },
  { name: "country", label: "Страна" },
  lat, lng,
  { name: "osmTags", label: "Теги OSM", kind: "json-object", wide: true, hint: "JSON-объект, например {}." },
  description,
  { name: "rating", label: "Рейтинг", kind: "number", min: 0, max: 5, optional: true },
  { name: "reviewsCount", label: "Количество отзывов", kind: "int", min: 0, optional: true },
  { name: "phone", label: "Телефон", kind: "tel", optional: true },
  { name: "website", label: "Сайт", kind: "url", optional: true },
  { name: "openingHours", label: "Часы работы", optional: true },
  { name: "imageUrl", label: "URL изображения", kind: "url", optional: true },
  { name: "tags", label: "Теги", kind: "tags", optional: true, hint: "Перечислите через запятую." },
];

export const photoFields: readonly Field[] = [
  { ...placeId, optional: true },
  { name: "caption", label: "Подпись", kind: "area", optional: true, wide: true, maxLength: 500 },
  { ...lat, optional: true },
  { ...lng, optional: true },
  { name: "takenAt", label: "Дата съёмки", kind: "date-time", optional: true },
  { name: "isPublic", label: "Публичное фото", kind: "bool", optional: true },
];
