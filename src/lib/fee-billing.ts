import type { FeeComponentRecord } from "./realtime-store";

/**
 * How the money actually arrived. Filed on the receipt, so a sum counted as
 * collected can be matched to a bank teller, a POS slip or a cash book entry.
 */
export const PAYMENT_CHANNELS = [
  "Bank Direct Deposit / Teller",
  "Electronic Bank Transfer",
  "School Bursary POS",
  "Cash Receipt",
] as const;

export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/**
 * Which fee items apply to which pupil.
 *
 * The schedule is priced per target level: an ICT levy for all classes, a
 * science practical fee for SS only. The billing screen used to add every item
 * on the list together and charge that to every enrolled pupil, so a Nursery 1
 * bill carried the SS 1 - 3 laboratory fee, and the amount printed on the paper
 * had never been set for that child.
 */
const CLASS_BANDS: Record<string, string[]> = {
  "Creche & Playgroup": ["Pre-Play Class", "Play Class"],
  "Nursery 1 & 2": ["Nursery 1", "Nursery 2"],
  "Primary 1 - 5": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"],
  "JSS 1 - 3": ["JSS 1", "JSS 2", "JSS 3"],
  "SS 1 - 3": ["SS 1", "SS 2", "SS 3"],
};

export function feeAppliesToClass(fee: FeeComponentRecord, className: string): boolean {
  const target = (fee.applicableClass ?? "").trim();
  if (target === "" || target.toLowerCase() === "all classes") return true;

  const band = CLASS_BANDS[target];
  if (band) return band.includes(className.trim());

  return target.toLowerCase() === className.trim().toLowerCase();
}

/** The items one pupil is actually charged for, and what that comes to. */
export function billForClass(
  fees: FeeComponentRecord[],
  className: string
): { items: FeeComponentRecord[]; total: number } {
  const items = fees.filter((fee) => feeAppliesToClass(fee, className));
  return { items, total: items.reduce((sum, fee) => sum + fee.amount, 0) };
}
