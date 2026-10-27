const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include', // שולח ומקבל את עוגיית ההתחברות
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function uploadFile(path, file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}${path}`, { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}