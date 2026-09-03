import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

function localPath(root, key) {
  const target = resolve(root, ...String(key).split("/").filter(Boolean));
  const normalizedRoot = resolve(root);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error("Object key berada di luar storage root.");
  }
  return target;
}

class LocalObjectStorage {
  constructor(root) {
    this.root = root;
    this.label = "local";
  }

  async putObject(key, body, _contentType) {
    const target = localPath(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async getObject(key) {
    return readFile(localPath(this.root, key));
  }

  async deleteObject(key) {
    await rm(localPath(this.root, key), { force: true });
  }
}

class S3ObjectStorage {
  constructor(settings) {
    if (!settings.bucket) throw new Error("S3_BUCKET wajib diisi saat STORAGE_DRIVER=s3.");
    this.label = "s3";
    this.bucket = settings.bucket;
    this.client = new S3Client({
      region: settings.region,
      endpoint: settings.endpoint || undefined,
      forcePathStyle: settings.forcePathStyle,
      credentials: settings.accessKeyId
        ? { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey }
        : undefined,
    });
  }

  async putObject(key, body, contentType) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(key) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error("Object storage mengembalikan body kosong.");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async deleteObject(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class SupabaseObjectStorage {
  constructor(settings) {
    if (!settings.url || !settings.serviceRoleKey) {
      throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi saat STORAGE_DRIVER=supabase.");
    }
    this.label = "supabase";
    this.bucket = settings.storageBucket;
    this.client = createClient(settings.url, settings.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.ready = null;
  }

  async ensureBucket() {
    if (!this.ready) {
      this.ready = (async () => {
        const bucketOptions = {
          public: false,
          fileSizeLimit: 64 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/webm"],
        };
        const { data, error } = await this.client.storage.getBucket(this.bucket);
        if (data && !error) {
          await this.client.storage.updateBucket(this.bucket, bucketOptions).catch(() => undefined);
          return;
        }
        const created = await this.client.storage.createBucket(this.bucket, bucketOptions);
        if (created.error) throw created.error;
      })();
    }
    return this.ready;
  }

  async putObject(key, body, contentType) {
    await this.ensureBucket();
    const uploadBody = body instanceof Blob ? body : new Blob([body], { type: contentType || "application/octet-stream" });
    const { error } = await this.client.storage.from(this.bucket).upload(key, uploadBody, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
  }

  async getObject(key) {
    await this.ensureBucket();
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteObject(key) {
    await this.ensureBucket();
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw error;
  }
}

class MirroredObjectStorage {
  constructor(primary, mirror) {
    this.primary = primary;
    this.mirror = mirror;
    this.label = `${primary.label}+local`;
    this.queueFile = join(mirror.root, ".sync-queue.json");
    this.flushing = false;
    this.retryTimer = setInterval(() => void this.flushQueue(), 60_000);
    this.retryTimer.unref?.();
  }

  async putObject(key, body, contentType) {
    void this.flushQueue();
    const [primaryResult, mirrorResult] = await Promise.allSettled([
      this.primary.putObject(key, body, contentType),
      this.mirror.putObject(key, body, contentType),
    ]);

    if (primaryResult.status === "fulfilled") return;
    if (mirrorResult.status === "fulfilled") {
      console.warn(`Primary object storage failed for ${key}; local mirror saved the file.`, primaryResult.reason);
      await this.queueForRetry(key, contentType);
      return;
    }

    throw primaryResult.reason || mirrorResult.reason || new Error("Object storage gagal menyimpan file.");
  }

  async getObject(key) {
    try {
      return await this.primary.getObject(key);
    } catch (primaryError) {
      try {
        return await this.mirror.getObject(key);
      } catch {
        throw primaryError;
      }
    }
  }

  async deleteObject(key) {
    await this.removeFromQueue(key);
    await Promise.allSettled([
      this.primary.deleteObject(key),
      this.mirror.deleteObject(key),
    ]);
  }

  async readQueue() {
    try {
      const payload = await readFile(this.queueFile, "utf8");
      const parsed = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async writeQueue(items) {
    await mkdir(dirname(this.queueFile), { recursive: true });
    await writeFile(this.queueFile, JSON.stringify(items, null, 2));
  }

  async queueForRetry(key, contentType) {
    const existing = await this.readQueue();
    const next = existing.filter((item) => item?.key !== key);
    next.push({ key, contentType: contentType || "application/octet-stream", queuedAt: new Date().toISOString() });
    await this.writeQueue(next.slice(-1000));
  }

  async removeFromQueue(key) {
    const existing = await this.readQueue();
    const next = existing.filter((item) => item?.key !== key);
    if (next.length !== existing.length) await this.writeQueue(next);
  }

  async flushQueue() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const existing = await this.readQueue();
      if (existing.length === 0) return;

      const remaining = [];
      for (const item of existing) {
        if (!item?.key) continue;
        try {
          const body = await this.mirror.getObject(item.key);
          await this.primary.putObject(item.key, body, item.contentType);
        } catch {
          remaining.push(item);
        }
      }
      await this.writeQueue(remaining);
    } finally {
      this.flushing = false;
    }
  }
}

export function createObjectStorage(config) {
  const local = new LocalObjectStorage(config.localObjectDir);
  const primary = config.storageDriver === "s3"
    ? new S3ObjectStorage(config.s3)
    : config.storageDriver === "supabase"
      ? new SupabaseObjectStorage(config.supabase)
      : local;

  if (primary !== local && config.localStorageMirror) {
    return new MirroredObjectStorage(primary, local);
  }

  return primary;
}
