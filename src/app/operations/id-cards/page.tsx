import { IdCardDesk } from "@/components/id-cards/id-card-desk";
import type { IdCardHolderType } from "@/lib/id-cards";

export default async function OperationsIdCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const holder = typeof params.holder === "string" ? params.holder : "";
  const ref = typeof params.ref === "string" ? params.ref.trim() : "";
  const asked =
    ref && (holder === "student" || holder === "staff")
      ? { type: holder as IdCardHolderType, ref }
      : null;

  return <IdCardDesk asked={asked} />;
}