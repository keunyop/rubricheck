// October 21, 2026 Node.js security release, including CVE-2026-111497.
// https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
export const MINIMUM_NODE_VERSION = "24.22.1";

/** @param {string} [version] */
export function assertPatchedNode(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor, patch] = match ? match.slice(1).map(Number) : [];
  if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
    throw new Error(
      `Unsupported Node.js ${version}. RubriCheck requires Node.js >=${MINIMUM_NODE_VERSION} <25. Update Node.js before running this application.`,
    );
  }
}
