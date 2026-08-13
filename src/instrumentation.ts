export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startScheduler } = await import("@/lib/scheduler");
      await startScheduler();
      console.info("[wa-sender] Scheduler started");
    } catch (err) {
      console.error("[wa-sender] Failed to start scheduler:", err);
    }
  }
}
