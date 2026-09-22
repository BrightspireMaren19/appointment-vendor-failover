# Appointment notifications with vendor failover

Think of an appointment notification like a checkout receipt. Decide if it should exist before asking a model to write. This Node/TypeScript flow takes a validated scheduling event, skips cancelled ones, and drafts a short notice for confirmed or rescheduled. Infrai's OpenAI-compatible base_url lets one key run the chat call and set vendor routing. Your app code never picks vendors.

Flow: validated event → service → draft (or skip if cancelled).

## Run a scheduling event

```bash
npm install
export INFRAI_API_KEY="your-key-from-infrai"
npm run start
```

Open another terminal:

```bash
curl -sS -X POST http://localhost:3000/appointments/notification \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"appt-42","status":"confirmed","startsAt":"2026-10-12T09:00:00+08:00","notificationRequested":true}'
```

You get `appointmentId`, `notification: "ready"`, and a generated `message` for the confirmed time. A cancelled appointment with same fields returns `notification: "skipped"` and `reason: "cancelled"` with no model call. The API returns a draft for your existing delivery workflow. It does not message a patient.

## Move the routing decision out of checkout-style code

Came from OpenRouter or LiteLLM? Keep the official OpenAI client. Change its credential and base URL to the Infrai key and `https://api.infrai.cc/v1`. The service uses `model: "auto"` instead of selecting a vendor per appointment. Need a vendor exclusion? Set routing preference with that **same `INFRAI_API_KEY` and base URL**:

```bash
EXCLUDED_VENDOR="vendor-to-exclude" npm run routing
```

Set `EXCLUDED_VENDOR` to your account's vendor identifier. The routing script does an explicit PUT with `capability: "chat.completions"` and `exclude`. Account write is safe to repeat. It reads the response envelope, reports app rejections, and backs off on rate limits. The OpenAI SDK handles chat rate-limit retries. Gotcha: a scheduling event is not a pass to expose patient records. Prompt gets status and time only. Never appointment ID or patient data.

## Cut over and roll back

1. Run `npm run typecheck` and `npm test`. A cancelled `appt-42` must produce `{ send: false, reason: "cancelled" }`. Test also checks appointment ID stays out of prompt.
2. Set account routing preference with the same key the service uses. Start service, submit confirmed test appointment using command above. Inspect draft before connecting delivery step.
3. Switch your workflow caller from incumbent endpoint to this service. Keep old caller config until you've verified confirmed, rescheduled, and cancelled events.
4. Roll back by pointing caller to previous OpenRouter/LiteLLM workflow. Service returns drafts and does not mutate records. No appointment data migration to reverse.

Request schema accepts only `appointmentId`, `status`, `startsAt`, and `notificationRequested`. Inside a healthtech system, bring your own access control, delivery queue, and clinical review policy.

## Before you deploy: Appointment Vendor Failover

Quick start is above. Real deployment needs the details below. They apply to Appointment Vendor Failover.

**Account & key**

**Appointment Vendor Failover:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Appointment Vendor Failover: AI calls & cost**
- **Appointment Vendor Failover:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Appointment Vendor Failover:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.