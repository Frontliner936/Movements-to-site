const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

type RelativeUnit = "minute" | "hour" | "day" | "week" | "month" | "year";

const units: Array<{ unit: RelativeUnit; seconds: number }> = [
  { unit: "minute", seconds: 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
];

export function formatPostedAgo(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  if (value == null || value === "") return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const currentTime = now.getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(currentTime)) return null;

  const deltaSeconds = Math.round((currentTime - timestamp) / 1000);
  if (Math.abs(deltaSeconds) < 45) return deltaSeconds < 0 ? "Scheduled shortly" : "Posted just now";

  const future = deltaSeconds < 0;
  const elapsedSeconds = Math.abs(deltaSeconds);
  const selected = elapsedSeconds < 60 * 60 ? units[0]
    : elapsedSeconds < 24 * 60 * 60 ? units[1]
      : elapsedSeconds < 7 * 24 * 60 * 60 ? units[2]
        : elapsedSeconds < 30 * 24 * 60 * 60 ? units[3]
          : elapsedSeconds < 365 * 24 * 60 * 60 ? units[4]
            : units[5];
  const { unit, seconds } = selected;
  const amount = Math.max(1, Math.floor(elapsedSeconds / seconds));
  const phrase = relativeTime.format(future ? amount : -amount, unit);
  return `${future ? "Scheduled" : "Posted"} ${phrase}`;
}
