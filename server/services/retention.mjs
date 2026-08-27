export async function runRetention(database, storage) {
  const now = Date.now();
  const expiredAssets = await database.all("SELECT id, object_key FROM media_assets WHERE expires_at <= ?", now);

  for (const asset of expiredAssets) {
    try {
      await storage.deleteObject(asset.object_key);
      await database.run("DELETE FROM media_assets WHERE id = ?", asset.id);
    } catch (error) {
      console.error(`Gagal menghapus asset ${asset.id}:`, error.message);
    }
  }

  const expiredReservations = await database.all(`
    SELECT vr.id, vr.payment_id
    FROM voucher_redemptions vr
    JOIN payments p ON p.id = vr.payment_id
    WHERE vr.status = 'reserved' AND p.expires_at <= ?
  `, now);
  for (const reservation of expiredReservations) {
    await database.transaction(async (transaction) => {
      await transaction.run("UPDATE voucher_redemptions SET status = 'released' WHERE id = ?", reservation.id);
      await transaction.run("UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending'", now, reservation.payment_id);
    });
  }

  await database.run("UPDATE payments SET status = 'expired', updated_at = ? WHERE status = 'pending' AND expires_at <= ?", now, now);
  await database.run("DELETE FROM admin_sessions WHERE expires_at <= ?", now);
  await database.run("DELETE FROM photo_sessions WHERE expires_at <= ? AND NOT EXISTS (SELECT 1 FROM media_assets WHERE media_assets.session_id = photo_sessions.id)", now);

  return { deletedAssets: expiredAssets.length, releasedVouchers: expiredReservations.length };
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
