/** Клиентские хелперы для API. */

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `Ошибка ${res.status}`);
    (err as any).status = res.status;
    (err as any).code = data?.code;
    throw err;
  }
  return data as T;
}

export const apiGet = <T = any>(url: string) => api<T>(url);
export const apiPost = <T = any>(url: string, body?: unknown) =>
  api<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T = any>(url: string, body?: unknown) =>
  api<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(url: string, body?: unknown) =>
  api<T>(url, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
