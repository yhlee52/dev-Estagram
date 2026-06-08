const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export const getApiBaseUrl = (): string => {
  const value = import.meta.env.VITE_API_BASE_URL;

  if (typeof value !== "string") {
    return DEFAULT_API_BASE_URL;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : DEFAULT_API_BASE_URL;
};
