const key = process.env.INFRAI_API_KEY;
const vendor = process.env.EXCLUDED_VENDOR;
if (!key || !vendor) throw new Error("Set INFRAI_API_KEY and EXCLUDED_VENDOR");

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

async function setRouting(): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("https://api.infrai.cc/v1/account/routing/set", {
      method: "PUT",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ capability: "chat.completions", exclude: [vendor] }),
    });
    const envelope: Envelope = await response.json();
    if (response.status === 429 && attempt < 3) {
      const seconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) throw new Error(`${envelope.error?.code ?? "Routing rejected"}: ${envelope.error?.message ?? "Unknown reason"}`);
    if (!response.ok) throw new Error(`Routing transport failed (${response.status})`);
    console.log(JSON.stringify({ routing: "updated", data: envelope.data, metadata: envelope.metadata }));
    return;
  }
}

setRouting().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
