import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collect(path) : entry.name.endsWith(".test.ts") ? [path] : [];
  });
}
const result = spawnSync(process.execPath, [
  "--import", "./scripts/register-test-resolver.mjs", "--test", "--test-concurrency=1",
  "--experimental-strip-types", "--experimental-test-module-mocks", ...["lib", "src", "app"].flatMap(collect).map(path =>
    Array.from(path.replaceAll("\\", "/"), char => char === "[" ? "[[]" : char === "]" ? "[]]" : char).join("")),
], { stdio: "inherit", env: { ...process.env, OPENAI_API_KEY: "test-only-no-network" } });
process.exitCode = result.status ?? 1;
