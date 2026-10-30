import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { GRADING_FAILURE_RETENTION_DAYS, type GradingFailureDetail, type GradingFailurePage, type GradingFailureSummary } from "./gradingFailureTypes";

const TTL = GRADING_FAILURE_RETENTION_DAYS * 86400;
const PREFIX = "rubricheck:{grading-failures}";
const INDEX = PREFIX + ":index";
const CHUNK_SIZE = 192 * 1024;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const PAGE_SIZE = 25;
const recordKey = (id: string) => `${PREFIX}:record:${id}`;
const ownerKey = (email: string) => `${PREFIX}:owner:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
export const validFailureId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);

export type GradingFailureInput = Omit<GradingFailureSummary, "id" | "createdAt" | "expiresAt" | "captureStatus"> & {
  inputs: GradingFailureDetail["inputs"];
  files: { field: "rubric" | "assignment"; file: File }[];
  // Used only for a keyed rate-limit hash; never retained with the record.
  clientIp: string;
};
type FailureArchive = GradingFailureDetail & { fileContents: string[] };
type Manifest = { item: GradingFailureSummary; chunks: number };

function encryptionKey() {
  const secret = process.env.ENTITLEMENT_SESSION_SECRET?.trim();
  if (!secret) throw new Error("FAILURE_STORAGE_KEY_MISSING");
  return Buffer.from(hkdfSync("sha256", secret, "rubricheck", "grading-failure-archive-v1", 32));
}
function encrypt(value: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
function decrypt(value: string, context: string): string {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}
function redis(timeout = 20000) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("FAILURE_STORAGE_UNAVAILABLE");
  return new Redis({ url, token, retry: { retries: 0 }, signal: AbortSignal.timeout(timeout) });
}
function decodeManifest(raw: string | null, id: string): Manifest | null {
  if (!raw) return null;
  const manifest = JSON.parse(decrypt(raw, id + ":manifest")) as Manifest;
  return manifest.item.id === id && manifest.item.expiresAt > Date.now() ? manifest : null;
}

export async function saveGradingFailure(input: GradingFailureInput): Promise<string | null> {
  const client = redis();
  const now = Date.now();
  const actor = createHmac("sha256", encryptionKey()).update(input.accountEmail ? "account:" + input.accountEmail.trim().toLowerCase() : "ip:" + input.clientIp).digest("hex");
  const allowed = await client.eval<unknown[], number>(`-- failure:limit
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
    return count <= 5 and 1 or 0`, [`${PREFIX}:limit:${actor}:${Math.floor(now / 3600000)}`], []);

  const id = randomUUID();
  const size = Object.values(input.inputs).reduce<number>((sum, value) => sum + (typeof value === "string" ? Buffer.byteLength(value) : 0), 0)
    + input.files.reduce((sum, { file }) => sum + file.size, 0);
  const complete = Boolean(allowed) && size <= MAX_INPUT_BYTES;
  const item: GradingFailureSummary = {
    id, requestId: input.requestId.slice(0, 200), createdAt: now, expiresAt: now + TTL * 1000,
    stage: input.stage, code: input.code, accountEmail: input.accountEmail,
    mode: input.mode, language: input.language, captureStatus: complete ? "complete" : "metadata_only",
  };
  const archive: FailureArchive = {
    ...item,
    inputs: complete ? input.inputs : { rubricSource: input.inputs.rubricSource, rubricId: input.inputs.rubricId, rubricText: null, assignmentText: null, assignmentInstructions: "", extractedRubricText: null, extractedAssignmentText: null },
    files: input.files.map(({ field, file }) => ({ field, name: file.name, type: file.type, size: file.size })),
    fileContents: [],
    structureModel: process.env.STRUCTURE_MODEL?.trim() || null,
    evaluationModel: process.env.EVALUATION_MODEL?.trim() || null,
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
    captureNote: complete ? null : !allowed ? "The five-originals-per-hour collection limit was reached; only metadata was retained." : "Input exceeded the 64 MiB diagnostic archive limit; only metadata was retained.",
  };
  if (complete) {
    for (const { file } of input.files) archive.fileContents.push(Buffer.from(await file.arrayBuffer()).toString("base64"));
  }
  const encrypted = encrypt(JSON.stringify(archive), id + ":archive");
  const chunks = Math.ceil(encrypted.length / CHUNK_SIZE);
  const key = recordKey(id);
  const expires = Math.floor(item.expiresAt / 1000);
  let committed = false;
  try {
    // Every partial record expires even if the worker is interrupted mid-write.
    await client.eval(`-- failure:init
      redis.call('HSET', KEYS[1], 'pending', '1')
      redis.call('EXPIREAT', KEYS[1], ARGV[1]); return 1`, [key], [expires]);
    for (let offset = 0; offset < chunks; offset += 8) {
      const args: string[] = [];
      for (let i = offset; i < Math.min(chunks, offset + 8); i++) args.push("c:" + i, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      const written = await client.eval(`-- failure:chunks
        if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
        redis.call('HSET', KEYS[1], unpack(ARGV)); return 1`, [key], args);
      if (!written) throw new Error("FAILURE_ARCHIVE_EXPIRED");
    }
    const manifest = encrypt(JSON.stringify({ item, chunks } satisfies Manifest), id + ":manifest");
    const owner = input.accountEmail ? ownerKey(input.accountEmail) : INDEX;
    const saved = await client.eval(`-- failure:commit
      if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
      redis.call('HSET', KEYS[1], 'manifest', ARGV[1]); redis.call('HDEL', KEYS[1], 'pending')
      for i = 2, 3 do
        redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', ARGV[5])
        redis.call('ZADD', KEYS[i], ARGV[3], ARGV[2]); redis.call('EXPIRE', KEYS[i], ARGV[4])
      end
      return 1`, [key, INDEX, owner], [manifest, id, now, TTL, now - TTL * 1000]);
    if (!saved) throw new Error("FAILURE_ARCHIVE_EXPIRED");
    committed = true;
    return id;
  } finally {
    if (!committed) await redis(2000).del(key).catch(() => {});
  }
}

export async function listGradingFailures(offset = 0): Promise<GradingFailurePage> {
  const client = redis();
  await client.zremrangebyscore(INDEX, "-inf", Date.now() - TTL * 1000);
  const ids = await client.zrange<string[]>(INDEX, offset, offset + PAGE_SIZE, { rev: true });
  const records = await Promise.all(ids.slice(0, PAGE_SIZE).map(async id => decodeManifest(await client.hget<string>(recordKey(id), "manifest"), id)));
  return { items: records.flatMap(record => record ? [record.item] : []), nextOffset: ids.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
}

export async function getGradingFailure(id: string): Promise<FailureArchive | null> {
  if (!validFailureId(id)) return null;
  const client = redis();
  const manifest = decodeManifest(await client.hget<string>(recordKey(id), "manifest"), id);
  if (!manifest) return null;
  const parts: string[] = [];
  for (let offset = 0; offset < manifest.chunks; offset += 8) {
    const batch = await Promise.all(Array.from({ length: Math.min(8, manifest.chunks - offset) }, (_, i) => client.hget<string>(recordKey(id), "c:" + (offset + i))));
    if (batch.some(part => typeof part !== "string")) throw new Error("FAILURE_ARCHIVE_INCOMPLETE");
    parts.push(...batch as string[]);
  }
  if (manifest.item.expiresAt <= Date.now()) return null;
  return JSON.parse(decrypt(parts.join(""), id + ":archive")) as FailureArchive;
}

export async function deleteGradingFailure(id: string): Promise<void> {
  if (!validFailureId(id)) return;
  const client = redis();
  const manifest = decodeManifest(await client.hget<string>(recordKey(id), "manifest"), id);
  await client.eval(`-- failure:delete
    redis.call('DEL', KEYS[1]); redis.call('ZREM', KEYS[2], ARGV[1]); redis.call('ZREM', KEYS[3], ARGV[1]); return 1`,
  [recordKey(id), INDEX, manifest?.item.accountEmail ? ownerKey(manifest.item.accountEmail) : INDEX], [id]);
}

export async function deleteGradingFailuresForAccount(email: string): Promise<void> {
  const client = redis();
  const index = ownerKey(email);
  const ids = await client.zrange<string[]>(index, 0, -1);
  for (const id of ids) await deleteGradingFailure(id);
  await client.del(index);
}
