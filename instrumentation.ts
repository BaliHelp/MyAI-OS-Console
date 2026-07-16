export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runSeedMigration } = await import("./lib/migrate");
    await runSeedMigration();
  }
}
