import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTransactionId,
  isValidTransactionId,
  calculatePaymentBalance,
  checkDuplicateTransaction,
} from "./payment-verification";

describe("Payment Records & Transaction ID Verification", () => {
  describe("Transaction ID Normalization", () => {
    it("trims whitespace and converts to uppercase", () => {
      assert.equal(normalizeTransactionId("  rca-tx-98213  "), "RCA-TX-98213");
      assert.equal(normalizeTransactionId("zenith/2026/abc"), "ZENITH/2026/ABC");
      assert.equal(normalizeTransactionId("1234567890"), "1234567890");
    });

    it("handles empty or falsy inputs safely", () => {
      assert.equal(normalizeTransactionId(""), "");
      assert.equal(normalizeTransactionId("   "), "");
    });

    it("validates transaction ID length bounds", () => {
      assert.equal(isValidTransactionId("AB"), false);
      assert.equal(isValidTransactionId("TX-1"), true);
      assert.equal(isValidTransactionId("  TX-999  "), true);
    });
  });

  describe("Balance & Payment Type Calculation", () => {
    it("identifies FULL payment when amount meets or exceeds balance", () => {
      const res1 = calculatePaymentBalance(150000, 0, 150000);
      assert.equal(res1.balanceRemaining, 0);
      assert.equal(res1.paymentType, "FULL");

      const res2 = calculatePaymentBalance(150000, 50000, 100000);
      assert.equal(res2.balanceRemaining, 0);
      assert.equal(res2.paymentType, "FULL");
    });

    it("identifies PARTIAL payment when remaining balance is positive", () => {
      const res = calculatePaymentBalance(150000, 0, 75000);
      assert.equal(res.balanceRemaining, 75000);
      assert.equal(res.paymentType, "PARTIAL");
    });

    it("prevents negative balance on overpayment", () => {
      const res = calculatePaymentBalance(100000, 0, 120000);
      assert.equal(res.balanceRemaining, 0);
      assert.equal(res.paymentType, "FULL");
    });
  });

  describe("Duplicate Transaction Detection", () => {
    const existing = [
      { transactionId: "GTB/TR/2026/001" },
      { transactionId: "ZENITH-REF-992" },
    ];

    it("detects case-insensitive and whitespace duplicate matches", () => {
      assert.equal(checkDuplicateTransaction("gtb/tr/2026/001", existing), true);
      assert.equal(checkDuplicateTransaction("  ZENITH-REF-992  ", existing), true);
      assert.equal(checkDuplicateTransaction("ZENITH-ref-992", existing), true);
    });

    it("allows unique unseen transaction IDs", () => {
      assert.equal(checkDuplicateTransaction("GTB/TR/2026/002", existing), false);
      assert.equal(checkDuplicateTransaction("UBA-TRANSFER-881", existing), false);
    });
  });
});
