import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentRequest, notificationDecision } from "../src/appointment_decision.ts";

test("cancelled appointments never produce a notification prompt", () => {
  const input = appointmentRequest.parse({
    appointmentId: "appt-42",
    status: "cancelled",
    startsAt: "2026-10-12T09:00:00+08:00",
    notificationRequested: true,
  });
  assert.deepEqual(notificationDecision(input), { send: false, reason: "cancelled" });
});

test("confirmed appointments expose only scheduling fields to the model", () => {
  const input = appointmentRequest.parse({
    appointmentId: "private-42",
    status: "confirmed",
    startsAt: "2026-10-12T09:00:00+08:00",
    notificationRequested: true,
  });
  const decision = notificationDecision(input);
  assert.equal(decision.send, true);
  if (decision.send) {
    assert.match(decision.prompt, /confirmed/);
    assert.doesNotMatch(decision.prompt, /private-42/);
  }
});
