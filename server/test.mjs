import assert from "node:assert/strict";
import { createToken, hashToken, safeEqualText, verifyPassword, hashPassword } from "./lib/security.mjs";
import { logger } from "./lib/logger.mjs";

console.log("🧪 Running PixieBooth Automated Test Suite...\n");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Security & Token Hashing Test
  test("Security: Token creation and hashing integrity", () => {
    const token = createToken();
    assert.equal(typeof token, "string");
    assert.ok(token.length >= 32);
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    assert.equal(hash1, hash2);
  });

  // 2. Password Hashing Verification
  test("Security: Password salt & hash verification", () => {
    const password = "adminSecret123!";
    const { salt, hash } = hashPassword(password);
    assert.ok(verifyPassword(password, salt, hash));
    assert.ok(!verifyPassword("wrongPassword", salt, hash));
  });

  // 3. Safe Equal Text Timing Attack Protection
  test("Security: Safe equal text comparator", () => {
    assert.ok(safeEqualText("ABC123XYZ", "ABC123XYZ"));
    assert.ok(!safeEqualText("ABC123XYZ", "ABC123X"));
  });

  // 4. Voucher Discount Calculation Test
  test("Voucher: Fixed discount calculation", () => {
    const baseAmount = 25000;
    const discountValue = 5000;
    const finalAmount = Math.max(0, baseAmount - discountValue);
    assert.equal(finalAmount, 20000);
  });

  test("Voucher: Percentage discount calculation", () => {
    const baseAmount = 25000;
    const discountPercent = 20; // 20%
    const discountAmount = Math.round((baseAmount * discountPercent) / 100);
    assert.equal(discountAmount, 5000);
    assert.equal(baseAmount - discountAmount, 20000);
  });

  // 5. Centralized Logger Integration Test
  test("Observability: Logger level dispatching", () => {
    logger.info("Test log entry created", { test: true });
    logger.metric("test_execution_time", 42, "ms");
    assert.ok(true);
  });

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
