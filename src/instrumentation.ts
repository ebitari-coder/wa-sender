export async function register() {
  // Disabled: baileys/better-sqlite3 imports crash the standalone server
  // on Railway. The scheduler and sender are initialized on first use instead.
}
