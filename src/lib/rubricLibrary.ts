import { createHash, randomUUID } from "node:crypto";
import { RubricSchema, type Rubric } from "../../lib/schema";
import { ownerHash, recoveryRedis } from "./evaluationRecovery";
import { RUBRIC_LIBRARY_LIMIT, type SavedRubric } from "./rubricLibraryTypes";

type RubricRecord = { text: string; rubric: Rubric; chunks: number[] };
const CHUNK_BYTES = 192 * 1024;
export const validRubricId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{64}$/.test(id);
export const rubricLibraryKey = (email: string) => `rubricheck:rubrics:{${ownerHash(email)}}`;
const dataKey = (email: string, id: string) => `${rubricLibraryKey(email)}:data:${id}`;

export async function listRubrics(email: string): Promise<SavedRubric[]> {
  const items = await recoveryRedis().hgetall<{ [id: string]: SavedRubric }>(rubricLibraryKey(email)) ?? {};
  // Redis Lua cjson encodes empty arrays as objects when metadata is edited.
  return Object.values(items).map(item => ({ ...item, files: Array.isArray(item.files) ? item.files : [] })).sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.id.localeCompare(b.id));
}

export async function getSavedRubric(email: string, id: string) {
  if (!validRubricId(id)) return null;
  const redis = recoveryRedis();
  const [item, record] = await Promise.all([
    redis.hget<SavedRubric>(rubricLibraryKey(email), id),
    redis.hget<RubricRecord>(dataKey(email, id), "record"),
  ]);
  if (!item || !record || !RubricSchema.safeParse(record.rubric).success) return null;
  return { ...item, files: Array.isArray(item.files) ? item.files : [], ...record };
}

export async function editSavedRubric(email: string, id: string, action: "touch" | "rename" | "delete", name = "") {
  if (!validRubricId(id)) return false;
  return Boolean(await recoveryRedis().eval(`
    local raw = redis.call('HGET', KEYS[1], ARGV[1])
    if not raw then return 0 end
    if ARGV[2] == 'delete' then
      redis.call('HDEL', KEYS[1], ARGV[1]); redis.call('DEL', KEYS[2]); return 1
    end
    local item = cjson.decode(raw)
    if ARGV[2] == 'rename' then item.name = ARGV[3] else item.lastUsedAt = tonumber(ARGV[4]) end
    redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(item))
    return 1
  `, [rubricLibraryKey(email), dataKey(email, id)], [id, action, name, Date.now()]));
}

export async function saveRubric(email: string, text: string, rubric: Rubric, files: File[]) {
  const buffers = await Promise.all(files.map(async file => Buffer.from(await file.arrayBuffer())));
  const hash = createHash("sha256").update(JSON.stringify([text, files.map(file => [file.name, file.type, file.size])]));
  for (const buffer of buffers) hash.update(buffer);
  const id = hash.digest("hex");
  if (await editSavedRubric(email, id, "touch")) return id;
  const item: SavedRubric = {
    id, name: (files[0]?.name || text.trim().split(/\r?\n/)[0] || "Untitled rubric").slice(0, 80),
    lastUsedAt: Date.now(), files: files.map(file => ({ name: file.name, size: file.size, type: file.type })),
  };
  const redis = recoveryRedis();
  const stagingKey = `${rubricLibraryKey(email)}:pending:${randomUUID()}`;
  const record: RubricRecord = { text, rubric, chunks: buffers.map(buffer => Math.ceil(buffer.length / CHUNK_BYTES)) };
  // Incomplete uploads expire; only fully written records become visible.
  await redis.eval("redis.call('HSET',KEYS[1],'record',ARGV[1]); redis.call('EXPIRE',KEYS[1],3600); return 1", [stagingKey], [JSON.stringify(record)]);
  try {
    for (let file = 0; file < buffers.length; file++) {
      for (let chunk = 0; chunk < record.chunks[file]; chunk++) {
        await redis.hset(stagingKey, { [`f:${file}:${chunk}`]: JSON.stringify(buffers[file].subarray(chunk * CHUNK_BYTES, (chunk + 1) * CHUNK_BYTES).toString("base64")) });
      }
    }
    await redis.eval(`
      local existing = redis.call('HGET', KEYS[1], ARGV[1])
      local item = cjson.decode(ARGV[2])
      if existing then
        local previous = cjson.decode(existing); previous.lastUsedAt = item.lastUsedAt
        redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(previous)); redis.call('DEL', KEYS[2])
      else
        redis.call('RENAME', KEYS[2], KEYS[3]); redis.call('PERSIST', KEYS[3])
        redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
      end
      while redis.call('HLEN', KEYS[1]) > tonumber(ARGV[3]) do
        local entries = redis.call('HGETALL', KEYS[1]); local oldest; local oldestTime
        for i = 1, #entries, 2 do
          local used = cjson.decode(entries[i + 1]).lastUsedAt
          if entries[i] ~= ARGV[1] and (not oldestTime or used < oldestTime) then oldest = entries[i]; oldestTime = used end
        end
        redis.call('HDEL', KEYS[1], oldest); redis.call('DEL', KEYS[1] .. ':data:' .. oldest)
      end
      return 1
    `, [rubricLibraryKey(email), stagingKey, dataKey(email, id)], [id, JSON.stringify(item), RUBRIC_LIBRARY_LIMIT]);
    return id;
  } finally {
    await redis.del(stagingKey).catch(() => {});
  }
}

export async function downloadRubricFile(email: string, id: string, index: number) {
  const record = await getSavedRubric(email, id);
  if (!record || !Number.isInteger(index) || index < 0 || !record.files[index]) return null;
  const redis = recoveryRedis();
  const buffers: Buffer[] = [];
  for (let chunk = 0; chunk < record.chunks[index]; chunk++) {
    const part = await redis.hget<string>(dataKey(email, id), `f:${index}:${chunk}`);
    if (typeof part !== "string") throw new Error("RUBRIC_FILE_UNAVAILABLE");
    buffers.push(Buffer.from(part, "base64"));
  }
  const bytes = Buffer.concat(buffers);
  if (bytes.length !== record.files[index].size) throw new Error("RUBRIC_FILE_UNAVAILABLE");
  return { file: record.files[index], bytes };
}
