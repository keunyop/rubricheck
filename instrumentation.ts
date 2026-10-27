export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertPatchedNode } = await import("./src/lib/nodeRuntime.mjs");
    assertPatchedNode();
    console.info(`NODE_RUNTIME_VERIFIED node=${process.versions.node}`);
  }
}
