import type { MetadataValue } from "../types/feed";

export function formatDateTime(
  value: string,
  locale = "en",
  timeZone?: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatMetadataValue(value: MetadataValue): string {
  if (value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(formatMetadataValue).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
