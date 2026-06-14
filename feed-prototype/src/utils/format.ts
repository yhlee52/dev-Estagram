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

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Compact relative time for activity signals (v0.2.2): "just now", "5m ago",
 * "3h ago", "2d ago", "4w ago". Beyond ~5 weeks (or future timestamps) it falls
 * back to an absolute date. Invalid input returns the original string.
 */
export function formatRelativeTime(
  value: string,
  now: number = Date.now(),
  locale = "en",
): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return value;
  }

  const diff = now - then;
  if (diff < MINUTE_MS) {
    return "just now";
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)}m ago`;
  }
  if (diff < DAY_MS) {
    return `${Math.floor(diff / HOUR_MS)}h ago`;
  }
  if (diff < WEEK_MS) {
    return `${Math.floor(diff / DAY_MS)}d ago`;
  }
  if (diff < 5 * WEEK_MS) {
    return `${Math.floor(diff / WEEK_MS)}w ago`;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(then),
  );
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
