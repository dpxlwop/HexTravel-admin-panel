import { config } from "../config";
import type { ErrorResponse, JwtWebResponse, LoginWebRequest, RefreshJwtWebRequest } from "./schema";

const statusMessages: Record<number, string> = {
  400: "API отклонил данные. Проверьте поля и повторите сохранение.",
  401: "Сеанс истёк. Войдите снова.",
  403: "У аккаунта нет доступа к этому действию.",
  404: "Запись не найдена или недоступна.",
  409: "Запись конфликтует с данными на сервере.",
  413: "Файл превышает лимит загрузки на сервере.",
  428: "Запись связана с другими данными. Проверьте зависимости.",
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail?: ErrorResponse,
    public readonly unknownOutcome = false,
    fallback?: string,
  ) {
    super(fallback ?? statusMessages[status] ?? (
      status >= 500 ? "API временно недоступен." : "Не удалось выполнить запрос."
    ));
  }
}

export function errorText(error: unknown) {
  if (error instanceof ApiError) {
    const detail = [error.detail?.error, error.detail?.message].filter(Boolean).join(" · ");
    return detail ? `${error.message} ${detail}` : error.message;
  }
  return error instanceof Error ? error.message : "Не удалось выполнить действие.";
}

export function unknownOutcome(error: unknown) {
  return error instanceof ApiError && error.unknownOutcome;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: object;
  body?: string | FormData;
  readAs?: "json" | "text" | "blob" | "none";
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions, accessToken?: string) {
  const { method = "GET", json, body, signal } = options;
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (json !== undefined || typeof body === "string") headers.set("Content-Type", "application/json");
  try {
    return await fetch(config.apiBase + path, {
      method,
      headers,
      body: json === undefined ? body : JSON.stringify(json),
      signal,
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, undefined, method !== "GET", "Нет соединения с API. Проверьте подключение.");
  }
}

async function decode<T>(response: Response, options: RequestOptions): Promise<T> {
  const writing = options.method !== undefined && options.method !== "GET";
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const detail = body && typeof body === "object" ? body as ErrorResponse : undefined;
    throw new ApiError(response.status, detail, writing && response.status >= 500);
  }
  if (response.status === 204 || options.readAs === "none") return undefined as T;
  try {
    if (options.readAs === "blob") return await response.blob() as T;
    if (options.readAs === "text") return await response.text() as T;
    return await response.json() as T;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(response.status, undefined, writing, "API вернул неполный или некорректный ответ.");
  }
}

interface Session {
  tokens: JwtWebResponse;
  login: string;
  generation: number;
}

interface AuthState {
  session: Session | null;
  notice: string;
}

let generation = 0;
let authState: AuthState = { session: null, notice: "" };
let refreshInFlight: { generation: number; promise: Promise<JwtWebResponse> } | undefined;
const listeners = new Set<() => void>();

function setAuth(session: Session | null, notice = "") {
  authState = { session, notice };
  listeners.forEach((listener) => listener());
}

export const auth = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  snapshot: () => authState,
};

function currentSession(expectedGeneration: number) {
  const session = authState.session;
  if (session?.generation !== expectedGeneration) throw new ApiError(401);
  return session;
}

function adminTokens(value: JwtWebResponse) {
  if (!value?.accessToken || !value?.refreshToken) return false;
  try {
    const token = value.accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(token.padEnd(Math.ceil(token.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).role === "ADMIN";
  } catch {
    return false;
  }
}

async function publicPost<T>(path: string, json: LoginWebRequest | RefreshJwtWebRequest) {
  const options: RequestOptions = { method: "POST", json };
  return decode<T>(await send(path, options), options);
}

export async function signIn(login: string, password: string) {
  const active = ++generation;
  setAuth(null);
  let tokens: JwtWebResponse;
  try {
    tokens = await publicPost<JwtWebResponse>("/auth/login", { login: login.trim(), password });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new Error("Неверный логин или пароль.");
    }
    throw error;
  }
  if (generation !== active || !adminTokens(tokens)) {
    if (tokens?.refreshToken) void publicPost<void>("/auth/logout", { refreshToken: tokens.refreshToken }).catch(() => {});
    if (generation === active) throw new Error("Для входа нужна роль администратора.");
    return;
  }
  setAuth({ tokens, login: login.trim(), generation: active });
}

export async function signOut() {
  const session = authState.session;
  const pending = refreshInFlight;
  ++generation;
  setAuth(null);
  if (!session) return;
  const tokens = pending?.generation === session.generation
    ? await pending.promise.catch(() => session.tokens)
    : session.tokens;
  try {
    await publicPost<void>("/auth/logout", { refreshToken: tokens.refreshToken });
  } catch {
    if (!authState.session && generation === session.generation + 1) {
      setAuth(null, "Сеанс на этом устройстве завершён. API не подтвердил отзыв токена.");
    }
  }
}

function refresh(session: Session) {
  if (refreshInFlight?.generation === session.generation) return refreshInFlight.promise;

  const promise = publicPost<JwtWebResponse>("/auth/refresh", { refreshToken: session.tokens.refreshToken })
    .then((tokens) => {
      if (!adminTokens(tokens)) {
        if (tokens?.refreshToken) void publicPost<void>("/auth/logout", { refreshToken: tokens.refreshToken }).catch(() => {});
        throw new ApiError(403);
      }
      if (authState.session?.generation === session.generation) setAuth({ ...session, tokens });
      return tokens;
    })
    .catch(() => {
      if (authState.session?.generation === session.generation) {
        setAuth(null, "Сеанс истёк. Войдите снова.");
      }
      throw new ApiError(401);
    })
    .finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
    });
  refreshInFlight = { generation: session.generation, promise };
  return promise;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = authState.session;
  if (!session) throw new ApiError(401);

  const token = session.tokens.accessToken;
  let response = await send(path, options, token);
  const active = currentSession(session.generation);
  if (response.status === 401 && !options.signal?.aborted) {
    const tokens = active.tokens.accessToken === token ? await refresh(active) : active.tokens;
    currentSession(session.generation);
    response = await send(path, options, tokens.accessToken);
    const afterRetry = currentSession(session.generation);
    if (response.status === 401 && afterRetry.tokens.accessToken === tokens.accessToken) {
      setAuth(null, "Сеанс истёк. Войдите снова.");
    }
  }
  return decode<T>(response, options);
}
