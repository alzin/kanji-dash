export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type ReminderRegistration = PushTarget & {
  timeZone: string;
  hour: number;
  lastPlayedOn: string | null;
  streak: number;
  freezes: number;
};

export type ReminderSubscription = ReminderRegistration & { lastSentOn: string | null; rejectedSince: string | null };

export type ReminderMessage = { title: string; body: string; tag: string };

export const REMINDER_GIVE_UP_DAYS = 30;

export const REMINDER_REJECTED_GIVE_UP_DAYS = 7;

export function localClock(timeZone: string, now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return { day: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function reminderDay(sub: ReminderSubscription, now: Date): string | null {
  const { day, hour } = localClock(sub.timeZone, now);
  if (hour < sub.hour) return null;
  if (sub.lastPlayedOn !== null && sub.lastPlayedOn >= day) return null;
  if (sub.lastSentOn !== null && sub.lastSentOn >= day) return null;
  if (sub.lastPlayedOn !== null && daysBetween(sub.lastPlayedOn, day) > REMINDER_GIVE_UP_DAYS) return null;
  return day;
}

export function reminderMessage(sub: ReminderSubscription, day: string): ReminderMessage {
  const missed = sub.lastPlayedOn === null ? -1 : daysBetween(sub.lastPlayedOn, day) - 1;
  if (sub.streak >= 2 && missed >= 0 && missed <= sub.freezes) {
    const cover = missed === 0 ? "" : missed === 1 ? "A freeze is covering the day you missed. " : `Freezes are covering the ${missed} days you missed. `;
    const body = `${cover}One short run today keeps the flame lit.`;
    return { title: `Keep your ${sub.streak}-day streak alive 🔥`, body, tag: "daily-reminder" };
  }
  return { title: "Your kanji are waiting 🏮", body: "A few minutes today keeps them fresh. Ready for a quick run?", tag: "daily-reminder" };
}

export function rejectedTooLong(sub: ReminderSubscription, day: string): boolean {
  return sub.rejectedSince !== null && daysBetween(sub.rejectedSince, day) >= REMINDER_REJECTED_GIVE_UP_DAYS;
}
