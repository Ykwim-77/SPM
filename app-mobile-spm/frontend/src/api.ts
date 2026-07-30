import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './utils/storage';

const TOKEN_KEY = 'auth_token';
const DEFAULT_TIMEOUT = 15000;
const BACKEND_BASE_URL_KEY = 'backend_base_url';

let cachedBaseUrl: string | null = null;
let cachedBaseUrlLoaded = false;
let resolveBaseUrlPromise: Promise<string> | null = null;

async function loadCachedBaseUrl(): Promise<void> {
  if (cachedBaseUrlLoaded) return;
  cachedBaseUrlLoaded = true;
  cachedBaseUrl = await storage.getItem<string | null>(BACKEND_BASE_URL_KEY, null);
}

async function saveCachedBaseUrl(url: string): Promise<void> {
  cachedBaseUrl = url;
  await storage.setItem(BACKEND_BASE_URL_KEY, url);
}

async function clearCachedBaseUrl(): Promise<void> {
  cachedBaseUrl = null;
  await storage.removeItem(BACKEND_BASE_URL_KEY);
  resolveBaseUrlPromise = null;
}

function extractHostFromDebuggerHost(debuggerHost: string | undefined): string | undefined {
  if (!debuggerHost) return undefined;
  const [host] = debuggerHost.split(':');
  if (!host) return undefined;
  return host;
}

function normalizeDebugHostForPlatform(host: string): string {
  const normalized = host.trim();
  if (Platform.OS === 'android' && (normalized === '127.0.0.1' || normalized === 'localhost')) {
    return '10.0.2.2';
  }
  return normalized;
}

function parseHostFromDebugString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // value may be host:port or full URL
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return undefined;
    }
  }

  return trimmed.split(':')[0];
}

function getExpoBackendUrlRaw(): string | undefined {
  const envValue = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (envValue) return envValue;

  const manifest = (Constants as any).expoConfig || (Constants as any).manifest || (Constants as any).manifest2 || {};
  const extra = manifest?.extra as { EXPO_PUBLIC_BACKEND_URL?: string } | undefined;
  const extraValue = extra?.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (extraValue) return extraValue;

  const possibleDebugSources = [
    manifest?.debuggerHost as string | undefined,
    manifest?.hostUri as string | undefined,
    manifest?.bundleUrl as string | undefined,
    manifest?.packagerOpts?.url as string | undefined,
  ];

  for (const source of possibleDebugSources) {
    const host = parseHostFromDebugString(source);
    if (host) {
      const normalizedHost = normalizeDebugHostForPlatform(host);
      return `http://${normalizedHost}:8000`;
    }
  }

  return undefined;
}

const EXPO_BACKEND_URL_RAW = getExpoBackendUrlRaw();

const CANDIDATE_URLS = (() => {
  const raw = EXPO_BACKEND_URL_RAW;
  const envCandidates = raw ? raw.split(',').map((v) => v.trim()).filter(Boolean) : [];
  const fallbackCandidates = [
    'http://10.219.36.248:8000', // PC local IP discovered on this machine
    'http://10.219.37.151:8000',
    'http://10.219.38.214:8000',
    'http://app-backend.local:8000', // mDNS hostname (works across networks)
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://10.0.2.2:8000', // Android emulator to host
    'http://172.20.240.1:8000', // WSL interface
    'http://10.219.39.133:8000',
  ];
  return [...new Set([...envCandidates, ...fallbackCandidates])];
})();

async function resolveBaseUrl(): Promise<string> {
  await loadCachedBaseUrl();
  if (cachedBaseUrl) return cachedBaseUrl;
  if (resolveBaseUrlPromise) return resolveBaseUrlPromise;

  resolveBaseUrlPromise = (async () => {
    if (CANDIDATE_URLS.length === 0) {
      throw new Error(
        'EXPO_PUBLIC_BACKEND_URL não está configurado no FRONTEND. Configure em app-mobile-spm/frontend e reinicie o expo.',
      );
    }

    const triedUrls: string[] = [];
    console.log('[BackendDiscovery] candidates:', CANDIDATE_URLS);

    // First pass: try to find a working backend and get its discovery info
    for (const candidate of CANDIDATE_URLS) {
      triedUrls.push(`${candidate}/api/`);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        console.log(`[BackendDiscovery] trying ${candidate}/api/`);
        const res = await fetch(`${candidate}/api/`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          await saveCachedBaseUrl(candidate);
          console.log('[BackendDiscovery] selected backend:', candidate);

          // Attempt to get discovery info from backend
          try {
            const infoController = new AbortController();
            const infoTimer = setTimeout(() => infoController.abort(), 3000);
            const infoRes = await fetch(`${candidate}/api/info`, { signal: infoController.signal });
            clearTimeout(infoTimer);
            if (infoRes.ok) {
              const info = (await infoRes.json()) as { available_ips?: string[] };
              console.log('[Discovery] Backend info:', info);
            }
          } catch (e) {
            // Discovery info is optional; failure is non-critical
            console.log('[Discovery] Info endpoint failed (optional):', e);
          }

          return candidate;
        }
      } catch {
        // tries next candidate
      }
    }

    throw new Error(
      `Não foi possível conectar ao backend. Verifique a rede/EXPO_PUBLIC_BACKEND_URL. URLs testadas: ${triedUrls.join(', ')}.`,
    );
  })();

  try {
    return await resolveBaseUrlPromise;
  } finally {
    if (!cachedBaseUrl) {
      resolveBaseUrlPromise = null;
    }
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const t = await storage.getItem<string | null>(TOKEN_KEY, null);
    return t as string | null;
  } catch {
    return null;
  }
}

export async function setToken(t: string | null) {
  try {
    if (t) await storage.setItem(TOKEN_KEY, t);
    else await storage.removeItem(TOKEN_KEY);
  } catch {}
}

function unpackApiResponse<T>(payload: any, status: number): T {
  if (payload && typeof payload === 'object' && typeof payload.success === 'boolean') {
    if (payload.success) return payload.data as T;
    const error = Object.assign(
      new Error(payload.error?.message || `Erro ${status}`),
      { code: payload.error?.code, status },
    );
    throw error;
  }
  if (status >= 400) {
    const detail = payload?.detail || payload?.message || `Erro ${status}`;
    throw Object.assign(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)), { status });
  }
  return payload as T;
}

async function request<T = any>(path: string, opts: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  let baseUrl = await resolveBaseUrl();
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as any) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let timer: NodeJS.Timeout | undefined;

  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    
    console.log(`[Request] ${opts.method || 'GET'} ${baseUrl}/api${path}`);
    const res = await fetch(`${baseUrl}/api${path}`, { ...opts, headers, signal: controller.signal });
    clearTimeout(timer);
    
    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    console.log(`[Response] Status ${res.status} from ${baseUrl}/api${path}`);
    
    return unpackApiResponse<T>(data, res.status);
  } catch (e: any) {
    console.log(`[Catch] Error type: ${e?.name}, message: ${e?.message}`);

    // The API supplied a business response (e.g. password change required or
    // a taken slot). Retrying it against another host would be misleading.
    if (e?.code) throw e;
    
    if (e?.name === 'AbortError') {
      throw new Error('Tempo de conexão esgotado. Verifique sua internet.');
    }
    
    // If cached URL fails, invalidate it and try discovering a new one
    if (cachedBaseUrl && baseUrl === cachedBaseUrl && e?.message && !e.message.includes('Erro') && !e.message.includes('Esse horário')) {
      console.log('[Network Change Detected] Cached URL failed, clearing cache and retrying...');
      await clearCachedBaseUrl();
      
      // Retry with fresh discovery
      try {
        baseUrl = await resolveBaseUrl();
        const controller2 = new AbortController();
        const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
        console.log(`[Retry] Attempting ${opts.method || 'GET'} ${baseUrl}/api${path}`);
        const res = await fetch(`${baseUrl}/api${path}`, { ...opts, headers, signal: controller2.signal });
        clearTimeout(timer2);
        const text = await res.text();
        let data: any = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        const unpacked = unpackApiResponse<T>(data, res.status);
        console.log('[Retry Success] Request succeeded on new URL');
        return unpacked;
      } catch (retryError: any) {
        console.log(`[Retry Failed] ${retryError?.message}`);
        throw retryError;
      }
    }
    
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  login: (p: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(p) }),
  changePassword: (p: { email: string; currentPassword: string; newPassword: string }) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(p) }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: (p: any) => request('/auth/me', { method: 'PUT', body: JSON.stringify(p) }),
  dashboard: () => request('/dashboard'),

  specialties: () => request('/specialties'),
  allergiesCatalog: () => request('/allergies/catalog'),
  availableSlots: (specialty: string, doctorName: string, date: string, ignoreAppointmentId?: string) =>
    request(`/doctors/${encodeURIComponent(specialty)}/available_slots?doctor_name=${encodeURIComponent(doctorName)}&date=${encodeURIComponent(date)}${ignoreAppointmentId ? `&ignore_appointment_id=${encodeURIComponent(ignoreAppointmentId)}` : ''}`),

  listAppointments: (statusFilter?: string) =>
    request(`/appointments${statusFilter ? `?status_filter=${statusFilter}` : ''}`),
  getAppointment: (id: string) => request(`/appointments/${id}`),
  createAppointment: (p: any) => request('/appointments', { method: 'POST', body: JSON.stringify(p) }),
  updateAppointment: (id: string, p: any) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  cancelAppointment: (id: string, reason: string) =>
    request(`/appointments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  listExams: () => request('/exams'),
  getExam: (id: string) => request(`/exams/${id}`),

  listMedications: () => request('/medications'),
  getMedication: (id: string) => request(`/medications/${id}`),
  updateMedication: (id: string, p: any) => request(`/medications/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteMedication: (id: string) => request(`/medications/${id}`, { method: 'DELETE' }),
  verifyMedicationPhoto: (id: string, photoBase64: string) =>
    request('/medications/verify-photo', { method: 'POST', body: JSON.stringify({ medication_id: id, photo_base64: photoBase64 }) }),
  takeMedication: (id: string, photoBase64?: string) =>
    request('/medications/take', {
      method: 'POST',
      body: JSON.stringify({ medication_id: id, ...(photoBase64 ? { photo_base64: photoBase64 } : {}) }),
    }),

  notifications: () => request('/notifications'),
  setPushToken: (token: string) => request('/push-token', { method: 'POST', body: JSON.stringify({ token }) }),
  faq: () => request('/help/faq'),
};
