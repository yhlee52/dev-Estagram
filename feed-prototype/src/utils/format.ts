import type { MetadataValue } from "../types/feed";
import { ko } from "../i18n/ko";

export const UI_LOCALE = 'ko-KR';
export const UI_TIME_ZONE = 'Asia/Seoul';

/** API timestamps without an offset follow the backend's UTC interpretation. */
function parseApiTimestamp(value: string): Date {
  const hasTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTime && !hasOffset ? `${value}Z` : value);
}

export function formatDateTime(
  value: string,
  locale = UI_LOCALE,
  timeZone = UI_TIME_ZONE,
): string {
  const date = parseApiTimestamp(value);

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
  locale = UI_LOCALE,
): string {
  const then = parseApiTimestamp(value).getTime();
  if (Number.isNaN(then)) {
    return value;
  }

  const diff = now - then;
  if (diff < 0) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: UI_TIME_ZONE }).format(new Date(then));
  }
  if (diff < MINUTE_MS) {
    return ko.justNow;
  }
  if (diff < HOUR_MS) {
    return ko.minutesAgo(Math.floor(diff / MINUTE_MS));
  }
  if (diff < DAY_MS) {
    return ko.hoursAgo(Math.floor(diff / HOUR_MS));
  }
  if (diff < WEEK_MS) {
    return ko.daysAgo(Math.floor(diff / DAY_MS));
  }
  if (diff < 5 * WEEK_MS) {
    return ko.weeksAgo(Math.floor(diff / WEEK_MS));
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: UI_TIME_ZONE }).format(
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
