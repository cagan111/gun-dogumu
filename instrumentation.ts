export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapNode } = await import("./instrumentation-node");
    await bootstrapNode();
  }
}
