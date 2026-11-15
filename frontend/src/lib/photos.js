const KEY = 'ck_photos_v1';

/* one place for the server address, shared with Auth.jsx.
   dev: leave VITE_API_URL unset, the Vite proxy forwards /api.
   production: set VITE_API_URL=https://your-domain, or leave it empty for the same site. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
const API = `${API_BASE}/api`;

export const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Token ${getToken()}` });
const authJson = () => ({ ...authHeaders(), 'Content-Type': 'application/json' });

/* ---------- cache ---------- */
export function readCached() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function writeCached(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

let photosInFlight = null;   /* { token, promise } for the request currently running */

/* call on login and logout so users never see each other's photos */
export const clearCache = () => {
  photosInFlight = null;
  localStorage.removeItem(KEY);
};
let sessionInFlight = null;
export function checkSession() {
  const token = getToken();
  if (!token) return Promise.resolve(false);
  if (sessionInFlight) return sessionInFlight;

  sessionInFlight = fetch(`${API}/storage/`, { headers: authHeaders() })
    .then((r) => r.status !== 401)     /* a network error keeps the user signed in */
    .catch(() => true)
    .finally(() => { sessionInFlight = null; });
  return sessionInFlight;
}

/* warm the browser cache so WebGL textures load instantly (once per URL) */
const warmed = new Set();
export function preload(list) {
  list.forEach((p) => {
    if (!p?.url || warmed.has(p.url)) return;
    warmed.add(p.url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => warmed.delete(p.url); /* allow a retry if it failed */
    img.src = p.url;
  });
}
export async function getProfile() {
  const r = await fetch(`${API}/me/`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Could not load profile.');
  return r.json();
}
/* ---------- photos ---------- */
export function fetchPhotos() {
  const token = getToken();
  if (!token) return Promise.reject(new Error('Not signed in.'));

  /* reuse the request already running (StrictMode, Home + Photo asking together) */
  if (photosInFlight && photosInFlight.token === token) return photosInFlight.promise;

  const entry = { token, promise: null };
  entry.promise = (async () => {
    const r = await fetch(`${API}/photos/`, { headers: authHeaders() });
    if (!r.ok) throw new Error('Could not load photos.');
    const list = await r.json();
    if (getToken() === token) {          /* skip if the user logged out meanwhile */
      writeCached(list);
      preload(list);
    }
    return list;
  })().finally(() => {
    if (photosInFlight === entry) photosInFlight = null;
  });

  photosInFlight = entry;
  return entry.promise;
}

export async function deletePhoto(id, { force = false } = {}) {
  const r = await fetch(`${API}/photos/${id}/${force ? '?force=1' : ''}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (r.status !== 204 && r.status !== 404) {
    const body = await r.json().catch(() => ({}));
    const err = new Error(body.errors || 'Could not remove the photo.');
    err.code = body.code;
    throw err;
  }
  writeCached(readCached().filter((p) => p.id !== id));   /* keep Home's cache in sync */
}

export async function getStorageStatus(check = false) {
  const r = await fetch(`${API}/storage/${check ? '?check=1' : ''}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Could not reach the server.');
  return r.json();
}

export function uploadPhoto(file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('image', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/photos/upload/`);
    xhr.setRequestHeader('Authorization', `Token ${getToken()}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 201) {
        writeCached([body, ...readCached()]);
        preload([body]);
        resolve(body);
      } else {
        const fallback =
          xhr.status === 413 ? 'That image is too large for the server.'
          : xhr.status === 401 ? 'Your session has expired. Please log in again.'
          : 'Upload failed.';
        const err = new Error(body.errors || fallback);
        err.code = body.code;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error.'));
    xhr.onabort = () => {
      const e = new Error('Upload cancelled.');
      e.code = 'aborted';
      reject(e);
    };
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(fd);
  });
}

/* ---------- Cloudinary connection ---------- */
export const getStorage = () =>
  fetch(`${API}/storage/`, { headers: authHeaders() }).then((r) => r.json());

export async function connectStorage(cloud_name, api_key, api_secret) {
  const r = await fetch(`${API}/storage/`, {
    method: 'POST',
    headers: authJson(),
    body: JSON.stringify({ cloud_name, api_key, api_secret }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.errors || 'Could not connect.');
  return body;
}

export const disconnectStorage = () =>
  fetch(`${API}/storage/`, { method: 'DELETE', headers: authHeaders() });