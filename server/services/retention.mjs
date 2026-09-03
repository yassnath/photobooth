export async function runRetention(database, storage) {
  const now = Date.now();
  const expiredAssets = await database.all("SELECT id, object_key FROM photos WHERE expires_at <= ?", now);

  for (const asset of expiredAssets) {
    try {
      await storage.deleteObject(asset.object_key);
      await database.run("DELETE FROM photos WHERE id = ?", asset.id);
    } catch (error) {
      console.error(`Gagal menghapus asset ${asset.id}:`, error.message);
    }
  }

  const expiredOrders = await database.run("UPDATE orders SET status = 'expired', updated_at = ? WHERE status = 'pending' AND expires_at <= ?", now, now);
  await database.run("DELETE FROM admin_sessions WHERE expires_at <= ?", now);
  await database.run("DELETE FROM sessions WHERE expires_at <= ? AND NOT EXISTS (SELECT 1 FROM photos WHERE photos.session_id = sessions.id)", now);

  return { deletedAssets: expiredAssets.length, expiredOrders: expiredOrders.changes };
}

export function startRetentionWorker(database, storage) {
  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    try {
      await runRetention(database, storage);
    } finally {
      running = false;
    }
  };
  void execute();
  if (process.env.VERCEL) {
    return () => {};
  }
  const timer = setInterval(() => void execute(), 30 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
