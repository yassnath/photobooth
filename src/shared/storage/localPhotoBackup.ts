import type { PhotoSession } from "../../app/types/photobooth";

const DATABASE_NAME = "pixiebooth-local-backup";
const DATABASE_VERSION = 3;
const SESSION_STORE = "sessions";
const RESULT_STORE = "results";
const RECOVERY_STORE = "recovery";
const QUEUE_STORE = "upload_queue";
const LOCAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredSession extends PhotoSession {
  backedUpAt: string;
  deleteAfter: number;
}

interface StoredResult {
  id: string;
  sessionId: string;
  format: string;
  blob: Blob;
  backedUpAt: string;
  deleteAfter: number;
}

function openBackupDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB tidak dapat dibuka."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = database.createObjectStore(SESSION_STORE, { keyPath: "id" });
        sessions.createIndex("deleteAfter", "deleteAfter");
      }
      if (!database.objectStoreNames.contains(RESULT_STORE)) {
        const results = database.createObjectStore(RESULT_STORE, { keyPath: "id" });
        results.createIndex("deleteAfter", "deleteAfter");
      }
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
        database.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Transaksi backup lokal gagal."));
    transaction.onabort = () => reject(transaction.error || new Error("Transaksi backup lokal dibatalkan."));
  });
}

export async function saveLocalSessionBackup(session: PhotoSession) {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const record: StoredSession = {
    ...session,
    backedUpAt: new Date().toISOString(),
    deleteAfter: Date.now() + LOCAL_RETENTION_MS,
  };
  transaction.objectStore(SESSION_STORE).put(record);
  await transactionDone(transaction);
  database.close();
}

export async function saveLocalResultBackup(sessionId: string, format: string, blob: Blob) {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(RESULT_STORE, "readwrite");
  const record: StoredResult = {
    id: `${sessionId}-${format}`,
    sessionId,
    format,
    blob,
    backedUpAt: new Date().toISOString(),
    deleteAfter: Date.now() + LOCAL_RETENTION_MS,
  };
  transaction.objectStore(RESULT_STORE).put(record);
  await transactionDone(transaction);
  database.close();
}

export async function listLocalSessionBackups(): Promise<PhotoSession[]> {
  if (!("indexedDB" in window)) return [];
  const database = await openBackupDatabase();
  const transaction = database.transaction(SESSION_STORE, "readonly");
  const request = transaction.objectStore(SESSION_STORE).getAll();
  const records = await new Promise<StoredSession[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as StoredSession[]);
    request.onerror = () => reject(request.error || new Error("Backup lokal tidak dapat dibaca."));
  });
  await transactionDone(transaction);
  database.close();
  return records
    .filter((record) => record.deleteAfter > Date.now())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function cleanupLocalBackups() {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  for (const storeName of [SESSION_STORE, RESULT_STORE]) {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (Number(cursor.value?.deleteAfter || 0) <= Date.now()) cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
  }
  database.close();
}

export async function saveKioskRecovery<T>(snapshot: T) {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(RECOVERY_STORE, "readwrite");
  transaction.objectStore(RECOVERY_STORE).put({ id: "active", snapshot, updatedAt: Date.now() });
  await transactionDone(transaction);
  database.close();
}

export async function loadKioskRecovery<T>(): Promise<T | null> {
  if (!("indexedDB" in window)) return null;
  const database = await openBackupDatabase();
  const transaction = database.transaction(RECOVERY_STORE, "readonly");
  const request = transaction.objectStore(RECOVERY_STORE).get("active");
  const record = await new Promise<{ snapshot?: T } | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as { snapshot?: T } | undefined);
    request.onerror = () => reject(request.error || new Error("Recovery state tidak dapat dibaca."));
  });
  await transactionDone(transaction);
  database.close();
  return record?.snapshot || null;
}

export async function clearKioskRecovery() {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(RECOVERY_STORE, "readwrite");
  transaction.objectStore(RECOVERY_STORE).delete("active");
  await transactionDone(transaction);
  database.close();
}

// ─── Upload Retry Queue ───────────────────────────────────────────────────────

interface QueuedUpload {
  id: string;
  session: PhotoSession;
  queuedAt: number;
  attempts: number;
}

/**
 * Persist a session to the upload queue so it can be retried
 * if the initial server upload fails (network outage, timeout, etc).
 */
export async function queueSessionUpload(session: PhotoSession): Promise<void> {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  const record: QueuedUpload = { id: session.id, session, queuedAt: Date.now(), attempts: 0 };
  transaction.objectStore(QUEUE_STORE).put(record);
  await transactionDone(transaction);
  database.close();
}

/**
 * Dequeue a successfully uploaded session so it is not retried.
 */
async function dequeueSessionUpload(id: string): Promise<void> {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  transaction.objectStore(QUEUE_STORE).delete(id);
  await transactionDone(transaction);
  database.close();
}

/**
 * Attempt to upload all queued sessions to the server.
 * Pass the same `savePhotoSession` function used elsewhere to keep
 * this module free of circular imports.
 */
export async function flushUploadQueue(
  uploadFn: (session: PhotoSession) => Promise<unknown>,
): Promise<void> {
  if (!("indexedDB" in window)) return;
  const database = await openBackupDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readonly");
  const request = transaction.objectStore(QUEUE_STORE).getAll();
  const records = await new Promise<QueuedUpload[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as QueuedUpload[]);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(transaction);
  database.close();

  for (const record of records) {
    // Give up after 10 attempts or after 48 hours
    if (record.attempts >= 10 || Date.now() - record.queuedAt > 48 * 60 * 60 * 1000) {
      await dequeueSessionUpload(record.id).catch(() => undefined);
      continue;
    }
    try {
      await uploadFn(record.session);
      await dequeueSessionUpload(record.id);
    } catch {
      // Increment attempts
      const db2 = await openBackupDatabase();
      const tx2 = db2.transaction(QUEUE_STORE, "readwrite");
      tx2.objectStore(QUEUE_STORE).put({ ...record, attempts: record.attempts + 1 });
      await transactionDone(tx2);
      db2.close();
    }
  }
}
