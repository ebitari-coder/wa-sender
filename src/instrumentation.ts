export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { initSender } = await import("@/lib/sender");
    const { startScheduler } = await import("@/lib/scheduler");
    initSender();
    startScheduler();
    console.info("[wa-sender] Scheduler started");
  }
}
