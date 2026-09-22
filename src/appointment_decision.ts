import { z } from "zod";

export const appointmentRequest = z.strictObject({
  appointmentId: z.string().min(1),
  status: z.enum(["confirmed", "rescheduled", "cancelled"]),
  startsAt: z.iso.datetime({ offset: true }),
  notificationRequested: z.boolean(),
});

export type AppointmentRequest = z.infer<typeof appointmentRequest>;

export function notificationDecision(input: AppointmentRequest):
  | { send: false; reason: "cancelled" | "not_requested" }
  | { send: true; prompt: string } {
  if (!input.notificationRequested) return { send: false, reason: "not_requested" };
  if (input.status === "cancelled") return { send: false, reason: "cancelled" };
  return {
    send: true,
    prompt: `Write one short operational appointment ${input.status} notice for ${input.startsAt}. Include only the appointment status and time. Do not add names, diagnoses, clinical advice, or invented details.`,
  };
}
