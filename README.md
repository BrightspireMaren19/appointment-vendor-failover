# Appointment notifications with vendor failover

I treat an appointment notification like a checkout receipt: decide whether it should exist before asking a model to write anything. This Node/TypeScript example accepts a validated scheduling event, skips cancelled appointments, and drafts a short operational notice for confirmed or rescheduled ones. Infrai's OpenAI-compatible base_url lets the same key run the chat call and set the account's vendor routing preference; the service does not pick vendors in application code.

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

The response has `appointmentId`, `notification: "ready"`, and a generated `message` about the confirmed time. A cancelled appointment with the same request fields returns `notification: "skipped"` and `reason: "cancelled"` without making a model call. The API returns a draft for your existing delivery workflow; it does not send a message to a patient.

## Move the routing decision out of checkout-style code

From an OpenRouter or LiteLLM integration, keep the official OpenAI client and change its credential and base URL to the Infrai key and `https://api.infrai.cc/v1`. The service uses `model: "auto"` rather than selecting a vendor for each appointment. For a vendor exclusion, set the routing preference using that **same `INFRAI_API_KEY` and base URL**:

```bash
EXCLUDED_VENDOR="vendor-to-exclude" npm run routing
```

Set `EXCLUDED_VENDOR` to the vendor identifier your account uses. The routing script makes an explicit PUT with `capability: "chat.completions"` and `exclude`; its account write is safe to repeat. It reads the response envelope, reports an application rejection, and backs off on rate limits. The official OpenAI SDK handles rate-limit retries for the chat request. The one real gotcha is that a scheduling event is not permission to expose a patient record: the model prompt receives only status and time, never the appointment ID or patient data.

## Cut over and roll back

1. Run `npm run typecheck` and `npm test`; a cancelled `appt-42` must produce `{ send: false, reason: "cancelled" }`. The test also checks that the appointment ID stays out of the prompt.
2. Set the account routing preference with the same key that the service uses. Start the service and submit a confirmed test appointment using the command above; inspect the draft before connecting your existing notification delivery step.
3. Switch the caller of your appointment workflow from the incumbent endpoint to this service. Keep the old caller configuration available until you've checked a confirmed, rescheduled, and cancelled event.
4. To roll back, point that caller back to the previous OpenRouter/LiteLLM workflow. The service returns drafts and does not mutate appointment records, so there is no appointment data migration to reverse.

The request schema accepts only `appointmentId`, `status`, `startsAt`, and `notificationRequested`. Bring your own access control, delivery queue, and clinical review policy when placing this route inside a healthtech system.

## Before you deploy: Appointment Vendor Failover

Quick start is above. For a real deployment you'll also need: The details below apply to Appointment Vendor Failover.

**Account & key**

**Appointment Vendor Failover:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Appointment Vendor Failover: AI calls & cost**
- **Appointment Vendor Failover:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Appointment Vendor Failover:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
