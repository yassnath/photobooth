import { randomBytes, scryptSync } from "node:crypto";
import readline from "node:readline/promises";

function createId(prefix) {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("=== Generate SQL Tambah Admin ===");

const username = (await rl.question("Masukkan Username baru: ")).trim().toLowerCase();
const displayName = (await rl.question("Masukkan Nama Tampilan (Display Name): ")).trim();
const password = await rl.question("Masukkan Password: ");

rl.close();

if (!username || !password) {
  console.error("Error: Username dan Password wajib diisi!");
  process.exit(1);
}

const { salt, hash } = hashPassword(password);
const id = createId("admin");
const now = Date.now();

const sql = `
INSERT INTO admins (id, username, display_name, password_hash, password_salt, active, created_at, updated_at)
VALUES (
  '${id}',
  '${username}',
  '${displayName}',
  '${hash}',
  '${salt}',
  1,
  ${now},
  ${now}
);
`;

console.log("\n✅ Berhasil membuat data admin!");
console.log("\nSilakan jalankan perintah SQL berikut di [Supabase Dashboard -> SQL Editor] untuk menambahkan admin ini:\n");
console.log("-".repeat(50));
console.log(sql.trim());
console.log("-".repeat(50));
console.log("\nSetelah SQL dieksekusi, admin baru bisa langsung login di dashboard.");
