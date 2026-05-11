"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:4000/api/v1";

export class ApiClientError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(message: string, status: number, requestId: string | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.requestId = requestId;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  const requestId = res.headers.get("x-request-id");
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg = data?.message ?? `Request failed: ${res.status}`;
    const baseMessage = Array.isArray(msg) ? msg.join(", ") : String(msg);
    const enrichedMessage = requestId ? `${baseMessage} (Reference ID: ${requestId})` : baseMessage;
    throw new ApiClientError(enrichedMessage, res.status, requestId);
  }
  return data as T;
}
