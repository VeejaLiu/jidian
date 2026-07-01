export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "操作失败") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}

function resolveApiUrl(path: string) {
  if (!path.startsWith("/")) return path;
  const desktopApiOrigin = window.desktopApp?.apiOrigin;
  const viteApiOrigin = import.meta.env.VITE_API_ORIGIN;
  const apiOrigin = desktopApiOrigin || viteApiOrigin;
  return apiOrigin ? `${apiOrigin}${path}` : path;
}
