/** booking.ts / cancel / panel → bildirim planlama köprüsü (döngüsel import olmasın diye tembel). */
import { logger } from "./logger";

export type AppointmentEvent = "created" | "moved" | "cancelled_by_salon" | "cancelled_by_customer" | "status";

export async function appointmentChanged(appointmentId: string, event?: AppointmentEvent): Promise<void> {
  try {
    const m = await import("./messaging/schedule");
    await m.onAppointmentChanged(appointmentId, event);
  } catch (err) {
    logger.error({ err, appointmentId, event }, "randevu bildirimi planlanamadı");
  }
}
