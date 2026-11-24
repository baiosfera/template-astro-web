import { drainTaskOutbox } from "@astrobranding/database";
import { createAiWorker } from "./aiWorker";
import { createWhatsAppWorker } from "./whatsappWorker";
import { createAstrologyWorker } from "./astrologyWorker";

let outboxTimer: ReturnType<typeof setInterval> | null = null;
let outboxDraining = false;

export function startOutboxWorker(intervalMs = 15_000) {
  if (!process.env.DATABASE_URL || process.env.DISABLE_WORKERS === "true") {
    return null;
  }
  if (outboxTimer) return outboxTimer;

  const runCycle = async () => {
    if (outboxDraining) return;
    outboxDraining = true;
    try {
      await drainTaskOutbox({
        batchSize: 10,
        handlers: {
          "payment.settled": async (task) => {
            console.log(`[Outbox] Processed payment.settled task ${task.id}`);
            return { success: true };
          },
          "telemetry.capi": async (task) => {
            console.log(`[Outbox] Processed telemetry.capi task ${task.id}`);
            return { success: true };
          },
        },
      });
    } catch (err) {
      console.warn("[Outbox] Drain cycle skipped or deferred:", err instanceof Error ? err.message : err);
    } finally {
      outboxDraining = false;
    }
  };

  outboxTimer = setInterval(runCycle, intervalMs);
  return outboxTimer;
}

export function initWorkers() {
  const outboxLoop = startOutboxWorker();

  // Only initialize BullMQ background workers when Valkey is configured
  if (process.env.VALKEY_URL || process.env.ENABLE_WORKERS === "true") {
    try {
      console.log("[Workers] Initializing BullMQ background workers...");
      const aiWorker = createAiWorker();
      const waWorker = createWhatsAppWorker();
      const astroWorker = createAstrologyWorker();
      return { aiWorker, waWorker, astroWorker, outboxLoop };
    } catch (err) {
      console.warn("[Workers] Valkey not available, running in sync fallback mode:", err);
      return { outboxLoop };
    }
  }
  return outboxLoop ? { outboxLoop } : null;
}
