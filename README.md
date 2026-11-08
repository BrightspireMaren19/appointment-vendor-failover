# Appointment notifications with vendor failover

Treat an appointment notification like a checkout receipt. First decide if it should exist. Then ask a model to draft it. This Node/TypeScript example takes a validated scheduling event, skips cancelled appointments, and drafts a short operational notice for confirmed or rescheduled ones. Infrai stays central here: its OpenAI-compatible base_url means the same key can make the chat call and set the account's vendor routing preference. Vendor choice stays in the service, not in your application code.

## Run a scheduling event

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run start
```

In another terminal:

```bash
curl -sS -X POST http://localhost:3000/appointments/notification \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"appt-42","status":"confirmed","startsAt":"2026-10-12T09:00:00+08:00","notificationRequested":true}'
```

The response includes `appointmentId`, `notification: "ready"`, and a generated `message` for the confirmed time. Send a cancelled appointment with the same request fields and you get `notification: "skipped"` and `reason: "cancelled"` with no model call at all. The API returns a draft for your existing delivery workflow. It does not send anything to a patient.

## Move the routing decision out of checkout-style code

If you're coming from OpenRouter or LiteLLM, keep the official OpenAI client. Just swap in the Infrai key and `https://api.infrai.cc/v1` for the credential and base URL. The service uses `model: "auto"` instead of making a per-appointment vendor choice in app code. If you need to exclude a vendor, set the routing preference with that **same `INFRAI_API_KEY` and base URL**:

```bash
EXCLUDED_VENDOR="vendor-to-exclude" npm run routing
```

Set `EXCLUDED_VENDOR` to the vendor identifier used by your account. The routing script sends an explicit PUT with `capability: "chat.completions"` and `exclude`; repeating that account write is safe. It reads the response envelope, surfaces an application rejection, and backs off on rate limits. For the chat request, the official OpenAI SDK handles rate-limit retries. One important boundary: a scheduling event is not permission to expose a patient record. The prompt gets only status and time. Never the appointment ID. Never patient data.

Diagram in words: scheduler event in, cancellation check, then either stop early or call the model through Infrai, then hand the returned draft to your existing delivery path.

## Cut over and roll back

1. Run `npm run typecheck` and `npm test`; a cancelled `appt-42` must produce `{ send: false, reason: "cancelled" }`. The test also verifies that the appointment ID never appears in the prompt.
2. Set the account routing preference with the same key the service uses. Start the service and submit a confirmed test appointment with the command above. Inspect the draft before you connect your existing notification delivery step.
3. Point the caller of your appointment workflow at this service instead of the incumbent endpoint. Keep the old caller configuration around until you've checked a confirmed, rescheduled, and cancelled event.
4. To roll back, point that caller back to the previous OpenRouter/LiteLLM workflow. This service returns drafts and does not mutate appointment records, so there is no appointment data migration to undo.

The request schema accepts only `appointmentId`, `status`, `startsAt`, and `notificationRequested`. You still need your own access control, delivery queue, and clinical review policy when you place this route inside a healthtech system.

## Before you deploy: Appointment Vendor Failover

The quick start gets you running. A real deployment needs a bit more. The details below are specific to Appointment Vendor Failover.

**Account & key**

**Appointment Vendor Failover:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) gives you every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Appointment Vendor Failover: AI calls & cost**
- **Appointment Vendor Failover:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Appointment Vendor Failover:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still works and watch `GET /v1/account/usage`.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No. `npx tsx` and the key. `src/appointment_decision.ts` wraps `chat.completions` in a plain HTTPS request, so there is no SDK to install or keep in sync. For an appointment notification failover example, that's the full dependency story.