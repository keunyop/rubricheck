import { assertPatchedNode } from "../src/lib/nodeRuntime.mjs";

assertPatchedNode();
console.info(`NODE_RUNTIME_VERIFIED node=${process.versions.node}`);
