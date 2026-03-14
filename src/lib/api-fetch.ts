export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch { /* use default message */ }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function apiFetchRaw(url: string, opts?: RequestInit): Promise<Response> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch { /* use default message */ }
    throw new ApiError(message, res.status);
  }
  return res;
}
