const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const matchLoopbackApiHost = (configuredUrl: string, browserHost: string): string => {
  // Cookies for 127.0.0.1 are not sent to localhost (or the reverse).
  // Follow the browser's loopback hostname for local API requests.
  if (!LOOPBACK_HOSTS.has(browserHost)) {
    return configuredUrl;
  }

  try {
    const apiUrl = new URL(configuredUrl);
    if (LOOPBACK_HOSTS.has(apiUrl.hostname)) {
      apiUrl.hostname = browserHost;
      return apiUrl.toString().replace(/\/$/, "");
    }
  } catch {
    // Keep invalid configuration visible in the request error.
  }

  return configuredUrl;
};

export const getApiBaseUrl = (): string => {
  const value = import.meta.env.VITE_API_BASE_URL;
  const configuredUrl = typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_API_BASE_URL;

  return typeof window === "undefined"
    ? configuredUrl
    : matchLoopbackApiHost(configuredUrl, window.location.hostname);
};
