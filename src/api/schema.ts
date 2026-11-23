export interface ErrorResponse {
  error?: string;
  message?: string;
}

export interface JwtWebResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginWebRequest {
  login: string;
  password: string;
}

export interface RefreshJwtWebRequest {
  refreshToken: string;
}

export interface TripCreateRequest {
  title: string;
  description?: string;
  coverImageUrl: string;
  startDate: string;
  endDate: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isPublic?: boolean;
  budget?: number;
  currency: string;
}

export interface TripUpdateRequest {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isPublic?: boolean;
  budget?: number;
  currency?: string;
}

export interface TripResponse {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  status?: string | null;
  isPublic?: boolean | null;
  budget?: number | null;
  currency?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TripPointCreateRequest {
  name: string;
  description?: string;
  orderIndex: number;
  pointType: string;
  latitude: number;
  longitude: number;
  address: string;
  arrivalTime?: string;
  departureTime?: string;
  durationHours?: number;
  placeId: string;
}

export interface TripPointResponse {
  id?: string | null;
  tripId?: string | null;
  name?: string | null;
  description?: string | null;
  orderIndex?: number | null;
  pointType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  durationHours?: number | null;
  placeId?: string | null;
  createdAt?: string | null;
}

export interface PlaceCreateRequest {
  name: string;
  description?: string;
  osmCategory: string;
  osmValue: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
  rating?: number;
  reviewsCount?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  imageUrl?: string;
  tags?: string[];
  osmId: number;
  osmTags: string;
}

export interface PlaceResponse {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  osmCategory?: string | null;
  osmValue?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null;
  imageUrl?: string | null;
  tags?: string[] | null;
  osmId?: number | null;
  osmTags?: string | null;
  createdAt?: string | null;
}

export interface ItineraryDayCreateRequest {
  dayNumber: number;
  date: string;
  title: string;
  notes?: string;
}

export interface ItineraryDayResponse {
  id?: string | null;
  tripId?: string | null;
  dayNumber?: number | null;
  date?: string | null;
  title?: string | null;
  notes?: string | null;
}

export interface ItineraryEventCreateRequest {
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  orderIndex: number;
}

export interface ItineraryEventResponse {
  id?: string | null;
  dayId?: string | null;
  tripPointId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  description?: string | null;
  orderIndex?: number | null;
}

export interface TransportCreateRequest {
  transportType: string;
  company: string;
  vehicleNumber: string;
  departureTime: string;
  arrivalTime: string;
  durationHours?: number;
  ticketPrice?: number;
  currency: string;
  notes?: string;
}

export interface TransportResponse {
  id?: string | null;
  tripId?: string | null;
  transportType?: string | null;
  company?: string | null;
  vehicleNumber?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  durationHours?: number | null;
  ticketPrice?: number | null;
  currency?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface FlightCreateRequest {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  terminalDeparture: string;
  terminalArrival: string;
  baggageAllowance: string;
  seatNumber: string;
}

export interface FlightResponse {
  id?: string | null;
  transportId?: string | null;
  airline?: string | null;
  flightNumber?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  terminalDeparture?: string | null;
  terminalArrival?: string | null;
  baggageAllowance?: string | null;
  seatNumber?: string | null;
}

export interface BookingCreateRequest {
  placeId: string;
  bookingType: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalPrice: number;
  currency: string;
  confirmationNumber: string;
  notes?: string;
}

export interface BookingResponse {
  id?: string | null;
  tripId?: string | null;
  placeId?: string | null;
  bookingType?: string | null;
  status?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guestsCount?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
  confirmationNumber?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface PhotoCreateRequest {
  tripId: string;
  placeId?: string;
  tripPointId?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  takenAt?: string;
  isPublic?: boolean;
}

export interface PhotoResponse {
  id?: string | null;
  userId?: string | null;
  tripId?: string | null;
  placeId?: string | null;
  tripPointId?: string | null;
  caption?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  takenAt?: string | null;
  isPublic?: boolean | null;
  createdAt?: string | null;
  fileWebExtension?: "FILE_EXTENSION_UNSPECIFIED" | "PDF" | "JPEG" | "JPG" | "PNG" | "DOC" | "DOCX" | "XLS" | "XLSX" | "HEIC" | "WEBP" | "TIFF" | "BMP" | "GIF" | null;
  thumbnailUrl?: string | null;
}
