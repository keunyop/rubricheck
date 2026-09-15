// Match Next.js extensionless imports when running TypeScript tests directly in Node.
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
      const candidates = specifier.startsWith(".") || specifier.startsWith("file:")
        ? [specifier + ".ts", specifier + ".js"] : specifier === "next/server" ? ["next/server.js"] : [];
      for (const candidate of candidates) {
        try { return nextResolve(candidate, context); } catch {}
      }
      throw error;
    }
  },
});
