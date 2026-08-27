import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

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
  }

  async putObject(key, body) {
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
    this.bucket = settings.storageBucket;
    this.client = createClient(settings.url, settings.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.ready = null;
  }

  async ensureBucket() {
    if (!this.ready) {
      this.ready = (async () => {
        const { data, error } = await this.client.storage.getBucket(this.bucket);
        if (data && !error) return;
        const created = await this.client.storage.createBucket(this.bucket, {
          public: false,
          fileSizeLimit: 64 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/webm"],
        });
        if (created.error) throw created.error;
      })();
    }
    return this.ready;
  }

  async putObject(key, body, contentType) {
    await this.ensureBucket();
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, {
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

export function createObjectStorage(config) {
  if (config.storageDriver === "s3") return new S3ObjectStorage(config.s3);
  if (config.storageDriver === "supabase") return new SupabaseObjectStorage(config.supabase);
  return new LocalObjectStorage(config.localObjectDir);
}
