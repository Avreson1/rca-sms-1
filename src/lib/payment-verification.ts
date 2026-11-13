/**
 * Payment Records & Transaction ID Verification Engine
 * Pure helpers for normalization, duplicate detection, and fee balancing.
 */

export type PaymentType = "PARTIAL" | "FULL";
export type VerificationStatus = "VERIFIED" | "FLAGGED";

export interface PaymentInput {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  session: string;
  term: string;
  transactionId: string;
  amountPaid: number;
  totalFeeExpected: number;
  previouslyPaid?: number;
  payeeName: string;
  narration?: string;
  paymentMethod?: string;
  paymentDate?: string;
  recordedBy?: string;
}

export interface PaymentRecordResult {
  transactionId: string;
  normalizedTransactionId: string;
  amountPaid: number;
  balanceRemaining: number;
  paymentType: PaymentType;
  payeeName: string;
  narration: string;
  paymentMethod: string;
  paymentDate: string;
  verificationStatus: VerificationStatus;
}

export interface ExistingTransactionMatch {
  transactionId: string;
  studentName: string;
  className: string;
  admissionNo: string;
  amountPaid: number;
  payeeName: string;
  narration: string;
  paymentDate: string;
  recordedBy: string;
  paymentMethod?: string;
}

/**
 * Normalizes a transaction reference string for deterministic, case-insensitive comparison.
 * Trims whitespace and converts to upper-case.
 */
export function normalizeTransactionId(transactionId: string): string {
  if (!transactionId || typeof transactionId !== "string") return "";
  return transactionId.trim().toUpperCase();
}

/**
 * Validates transaction reference format.
 * Rejects empty strings or strings shorter than 3 characters.
 */
export function isValidTransactionId(transactionId: string): boolean {
  const norm = normalizeTransactionId(transactionId);
  return norm.length >= 3 && norm.length <= 150;
}

/**
 * Calculates balance remaining and infers payment type (FULL vs PARTIAL).
 */
export function calculatePaymentBalance(
  totalFeeExpected: number,
  previouslyPaid: number,
  newPaymentAmount: number
): { balanceRemaining: number; paymentType: PaymentType } {
  const safeTotal = Math.max(0, totalFeeExpected);
  const safePrev = Math.max(0, previouslyPaid);
  const safeNew = Math.max(0, newPaymentAmount);

  const cumulativePaid = safePrev + safeNew;
  const balanceRemaining = Math.max(0, safeTotal - cumulativePaid);
  const paymentType: PaymentType = balanceRemaining <= 0 ? "FULL" : "PARTIAL";

  return { balanceRemaining, paymentType };
}

/**
 * Checks an incoming transaction ID against an in-memory or database collection.
 */
export function checkDuplicateTransaction(
  incomingId: string,
  existingRecords: Array<{ normalizedTransactionId?: string; transactionId: string }>
): boolean {
  const target = normalizeTransactionId(incomingId);
  if (!target) return false;

  return existingRecords.some((r) => {
    const existingNorm = r.normalizedTransactionId || normalizeTransactionId(r.transactionId);
    return existingNorm === target;
  });
}
