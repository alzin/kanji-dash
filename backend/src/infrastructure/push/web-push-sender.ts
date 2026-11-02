import webpush from "web-push";
import type { PushResult, PushSender } from "../../application/ports.js";
import type { PushTarget, ReminderMessage } from "../../domain/reminders.js";

export type VapidDetails = { subject: string; publicKey: string; privateKey: string };

export class WebPushSender implements PushSender {
  constructor(private readonly vapid: VapidDetails) {}

  async send(target: PushTarget, message: ReminderMessage): Promise<PushResult> {
    try {
      await webpush.sendNotification(target, JSON.stringify(message), {
        vapidDetails: this.vapid,
        TTL: 6 * 60 * 60,
        urgency: "normal",
        topic: "daily-reminder",
        timeout: 10_000,
      });
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (status === 404 || status === 410) return "gone";
      // Refused outright, for example a subscription made with another VAPID key (FCM sends 403).
      if (status === 400 || status === 401 || status === 403 || status === 413) return "rejected";
      return "failed";
    }
  }
}
