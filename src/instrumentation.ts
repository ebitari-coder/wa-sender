export async function register() {
  // Scheduler disabled: baileys import causes OOM on Railway trial plan.
  // Scheduled campaigns and report emails are handled via API triggers instead.
}
