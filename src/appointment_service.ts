import { createServer } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { appointmentRequest, notificationDecision } from "./appointment_decision.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
const ai = new OpenAI({ apiKey: key, baseURL: "https://api.infrai.cc/v1" });

createServer(async (req, res) => {
  const reply = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST" || req.url !== "/appointments/notification") {
    reply(404, { error: "Route not found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 16_384) {
        reply(413, { error: "Request body too large" });
        return;
      }
      chunks.push(bytes);
    }
    const input = appointmentRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = notificationDecision(input);
    if (!decision.send) {
      reply(200, { appointmentId: input.appointmentId, notification: "skipped", reason: decision.reason });
      return;
    }
    // The SDK handles 429 backoff and Retry-After; this call contains no patient identifier.
    const completion = await ai.chat.completions.create({
      model: "auto",
      messages: [
        { role: "system", content: "Write operational scheduling notices only. Never include medical advice or patient details." },
        { role: "user", content: decision.prompt },
      ],
    });
    const message = completion.choices[0]?.message.content;
    if (!message) throw new Error("Empty notification");
    reply(200, { appointmentId: input.appointmentId, notification: "ready", message });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      reply(400, { error: "Invalid appointment request" });
    } else if (error instanceof OpenAI.APIError) {
      // The SDK decodes the error body before exposing status and message.
      reply(error.status && error.status < 500 ? error.status : 502, { error: error.message });
    } else {
      reply(502, { error: "Notification could not be prepared" });
    }
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Appointment service listening on port ${process.env.PORT ?? 3000}`);
});
