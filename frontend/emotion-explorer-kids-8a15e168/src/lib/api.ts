const FALLBACK_BACKEND_URL = "http://127.0.0.1:5000";

const sanitizeBaseUrl = (raw?: string) => {
  const trimmed = raw?.trim();
  if (!trimmed) return FALLBACK_BACKEND_URL;
  return trimmed.replace(/\/$/, "");
};

export const backendBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_BACKEND_URL);

export const buildBackendUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${backendBaseUrl}${normalizedPath}`;
};
