"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth } from "@/lib/realtime-store";
import {
  fetchInventoryMovements,
  fetchInventoryRegister,
  recordInventoryMovementOnServer,
  removeInventoryItemOnServer,
  saveInventoryItemOnServer,
  type InventoryItem,
  type InventoryMovement,
} from "@/lib/supabase/db";
import { exportToCSV } from "@/lib/csv-utils";
import {
  ArrowLeft,
  Boxes,
  FileSpreadsheet,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  Trash2,
  X,
} from "lucide-react";

const CONDITIONS = ["New", "Good", "Fair", "Poor", "Damaged", "Unusable", "Lost", "Disposed"];

/** An empty text input is no recorded date, not a fabricated one. */
const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

interface DraftItem {
  id?: string;
  item_name: string;
  asset_ref: string;
  category: string;
  unit: string;
  opening_quantity: string;
  location: string;
  custodian: string;
  condition: string;
  acquired_on: string;
  purchase_value: string;
  reorder_level: string;
  notes: string;
}

const EMPTY_DRAFT: DraftItem = {
  item_name: "",
  asset_ref: "",
  category: "General Stores",
  unit: "piece",
  opening_quantity: "0",
  location: "",
  custodian: "",
  condition: "Good",
  acquired_on: "",
  purchase_value: "",
  reorder_level: "",
  notes: "",
};

function draftFrom(item: InventoryItem): DraftItem {
  return {
    id: item.id,
    item_name: item.item_name,
    asset_ref: item.asset_ref ?? "",
    category: item.category,
    unit: item.unit,
    opening_quantity: String(item.opening_quantity),
    location: item.location,
    custodian: item.custodian,
    condition: item.condition,
    acquired_on: item.acquired_on ?? "",
    purchase_value: item.purchase_value === null || item.purchase_value === undefined ? "" : String(item.purchase_value),
    reorder_level: item.reorder_level === null ? "" : String(item.reorder_level),
    notes: item.notes,
  };
}

/**
 * What the school owns, where it is kept, and every line that moved it.
 *
 * The quantity on this screen is never typed. It is the opening figure the
 * bursary filed plus every receipt minus every issue, added up by the school's
 * own records — so an item cannot be "corrected" to a number that its own
 * movement log contradicts. That is the difference between a register and a wish:
 * if four calculators are missing, the school has to say where they went, and the
 * saying is the line that brings the figure down.
 *
 * Nothing is kept on this browser. A store list held in one machine's storage
 * cannot be checked by the person standing in the store with a clipboard.
 */
export default function AccountsInventoryPage() {
  const { currentUser } = useRealtimeAuth();
  const { config: school } = useSchoolConfig();
  // Reading is the bursary, the head office and QA; only the first two may write.
  const canWrite = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ACCOUNTANT";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [readProblem, setReadProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [movementFor, setMovementFor] = useState<InventoryItem | null>(null);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "warn"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const register = await fetchInventoryRegister({ category, location, q: search });
    const log = await fetchInventoryMovements();

    if (register.rows === null) {
      // A failed read is not an empty store. Listing nothing under a title that
      // says "the school's property" would let an office order duplicates — or
      // believe a theft never happened — off the back of a network blip.
      setItems([]);
      setReadProblem(register.reason);
    } else {
      setItems(register.rows);
      setReadProblem(null);
    }
    setMovements(log.rows ?? []);
    setLoading(false);
  }, [category, location, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (lowOnly ? items.filter((item) => item.reorder_level !== null && item.quantity_on_hand <= item.reorder_level) : items),
    [items, lowOnly]
  );

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items]);
  const locations = useMemo(() => Array.from(new Set(items.map((item) => item.location).filter(Boolean))).sort(), [items]);

  const totalOnHand = visible.reduce((sum, item) => sum + item.quantity_on_hand, 0);
  const belowReorder = items.filter((item) => item.reorder_level !== null && item.quantity_on_hand <= item.reorder_level);
  // Items with no recorded value are counted separately instead of being added in
  // as zero, which would understate the school's property and look like a fact.
  const valued = visible.filter((item) => item.purchase_value !== null && item.purchase_value !== undefined);
  const recordedValue = valued.reduce((sum, item) => sum + Number(item.purchase_value), 0);

  const handleSaveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);

    const result = await saveInventoryItemOnServer({
      ...(draft.id ? { id: draft.id } : {}),
      item_name: draft.item_name,
      asset_ref: blankToNull(draft.asset_ref),
      category: draft.category,
      unit: draft.unit,
      opening_quantity: blankToNull(draft.opening_quantity),
      location: draft.location,
      custodian: draft.custodian,
      condition: draft.condition,
      acquired_on: blankToNull(draft.acquired_on),
      purchase_value: blankToNull(draft.purchase_value),
      reorder_level: blankToNull(draft.reorder_level),
      notes: draft.notes,
    });

    if (result.ok) {
      setOutcome({
        tone: "ok",
        message: `${draft.item_name} is on the school's register${draft.id ? " (corrected)" : ""}.`,
      });
      setDraft(null);
      await load();
    } else {
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not take the item." });
    }
    setBusy(false);
  };

  const handleRemoveItem = async (item: InventoryItem) => {
    if (!window.confirm(`Remove ${item.item_name} from the register?`)) return;
    const result = await removeInventoryItemOnServer(item.id);
    if (result.ok) {
      setOutcome({ tone: "ok", message: `${item.item_name} was removed from the register.` });
      await load();
    } else {
      // The server refuses when the line has a history; its sentence explains why
      // the item must be written off instead of deleted.
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not remove the item." });
    }
  };

  const handleExportCSV = () => {
    exportToCSV(
      `RCA_Inventory_Register_${new Date().toISOString().slice(0, 10)}`,
      ["Item", "Label", "Category", "Location", "Custodian", "On Hand", "Unit", "Received", "Issued", "Opening", "Reorder Level", "Condition", "Acquired", "Value Recorded", "Filed By"],
      visible.map((item) => [
        item.item_name,
        item.asset_ref ?? "",
        item.category,
        item.location,
        item.custodian,
        item.quantity_on_hand,
        item.unit,
        item.quantity_in,
        item.quantity_out,
        item.opening_quantity,
        item.reorder_level ?? "",
        item.condition,
        item.acquired_on ?? "not recorded",
        item.purchase_value === null || item.purchase_value === undefined ? "not recorded" : item.purchase_value,
        item.created_by || "not recorded",
      ])
    );
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Accounts</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Inventory</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-6 h-6 text-blue-600" />
              Stores Register &amp; Stock Movements
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              What {school?.school_name?.trim() || SCHOOL_INFO.name} owns, where it is kept, and every item received or
              issued — read from the school&apos;s records, never from this browser.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Reading…" : "Refresh"}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={visible.length === 0}
              className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export This Register (CSV)
            </button>
            {canWrite && (
              <button
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add To The Register
              </button>
            )}
          </div>
        </div>

        {/* Who may change the register at all. */}
        {!canWrite && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] leading-snug text-sky-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>You are reading the register.</strong> Only a Bursary or Head of School login may add an item,
              record a movement or remove a line, because every one of those acts changes what the school says it owns.
            </p>
          </div>
        )}

        {readProblem && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-xs font-semibold flex items-start gap-2" role="status">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              The stores register could not be read: {readProblem}. Nothing is listed below in place of it — an
              inventory screen that showed an empty store when the read failed would send the school out to buy what it
              already has. Run <code className="font-mono">supabase/inventory.sql</code> if this project has never had
              the ledger set up.
            </p>
          </div>
        )}

        {outcome && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold flex items-start gap-2 ${
              outcome.tone === "ok"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-amber-50 border-amber-300 text-amber-950"
            }`}
            role="status"
          >
            <TriangleAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${outcome.tone === "ok" ? "text-emerald-600" : "text-amber-700"}`} />
            <p>{outcome.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Register Lines Shown</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">{visible.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">of {items.length} on the school&apos;s records</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Units On Hand</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1 font-mono">{totalOnHand.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Opening figure, plus receipts, minus issues.</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">At Or Below Reorder Level</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1 font-mono">{belowReorder.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {items.filter((item) => item.reorder_level === null).length} items have no reorder level set, so they are
              never counted here.
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Value Recorded</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1 font-mono">₦{recordedValue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {valued.length === visible.length
                ? "Every line shown carries a recorded value."
                : `Only ${valued.length} of ${visible.length} shown lines have a value recorded; the rest are left out rather than counted as free.`}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the register by item name…"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Every category</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Every location</option>
              {locations.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setLowOnly((current) => !current)}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                lowOnly ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {lowOnly ? "Showing items to reorder" : "Only items to reorder"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Kept Where</th>
                <th className="px-3 py-2.5 text-right">On Hand</th>
                <th className="px-3 py-2.5 text-right">In / Out</th>
                <th className="px-3 py-2.5">Condition</th>
                <th className="px-3 py-2.5">Custodian</th>
                {canWrite && <th className="px-3 py-2.5 text-right">Act</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((item) => {
                const needsReorder = item.reorder_level !== null && item.quantity_on_hand <= item.reorder_level;
                return (
                  <tr key={item.id} className={`text-xs hover:bg-slate-50 ${needsReorder ? "bg-amber-50/60" : ""}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-800">{item.item_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.asset_ref ?? "no label recorded"} · opened at {item.opening_quantity} {item.unit}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{item.category}</td>
                    <td className="px-3 py-2.5 text-slate-600">{item.location || <span className="text-slate-400">not stated</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                      {item.quantity_on_hand}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">{item.unit}</span>
                      {needsReorder && <p className="text-[10px] font-bold text-amber-700">reorder at {item.reorder_level}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-500">
                      +{item.quantity_in} / −{item.quantity_out}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.condition === "Disposed" || item.condition === "Unusable" || item.condition === "Lost"
                            ? "bg-rose-100 text-rose-800"
                            : item.condition === "Poor" || item.condition === "Damaged"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{item.custodian || <span className="text-slate-400">nobody named</span>}</td>
                    {canWrite && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setMovementFor(item)}
                            title="Receive stock into the store, or issue it out"
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDraft(draftFrom(item))}
                            title="Correct the description of this line"
                            className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleRemoveItem(item)}
                            title="Remove the line — refused if anything has ever moved"
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {visible.length === 0 && !loading && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="px-3 py-8 text-center text-xs text-slate-500">
                    {readProblem
                      ? "Nothing can be listed while the register cannot be read."
                      : items.length === 0
                        ? "The register is empty. Nothing has been filed on the school's records yet — this is the school's real position, not a filter hiding the stock."
                        : "No item on the register matches this search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <PackageMinus className="w-4 h-4 text-slate-500" />
            The last {Math.min(movements.length, 500)} movements
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Every line here is a quantity that actually moved, filed by the login that moved it. The register above is
            these lines added up — not a figure someone kept alongside them.
          </p>
          <div className="mt-3 overflow-x-auto">
            {movements.length === 0 ? (
              <p className="text-xs text-slate-500">No stock has been received or issued since the ledger was opened.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-slate-200">
                  <tr className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-2 py-1.5">When</th>
                    <th className="px-2 py-1.5">Item</th>
                    <th className="px-2 py-1.5">Moved</th>
                    <th className="px-2 py-1.5">To / From</th>
                    <th className="px-2 py-1.5">For what</th>
                    <th className="px-2 py-1.5">Filed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.slice(0, 60).map((movement) => (
                    <tr key={movement.id} className="text-xs">
                      <td className="px-2 py-1.5 font-mono text-slate-500">{movement.moved_on.slice(0, 10)}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-800">{movement.inventory_items?.item_name ?? "line since removed"}</td>
                      <td className={`px-2 py-1.5 font-mono font-bold ${movement.direction === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                        {movement.direction === "in" ? "+" : "−"}
                        {movement.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{movement.party || <span className="text-slate-400">not stated</span>}</td>
                      <td className="px-2 py-1.5 text-slate-600">{movement.purpose || <span className="text-slate-400">not stated</span>}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{movement.recorded_by || "not recorded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {draft && (
        <ItemForm
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSubmit={handleSaveItem}
        />
      )}

      {movementFor && canWrite && (
        <MovementForm
          item={movementFor}
          busy={busy}
          onClose={() => setMovementFor(null)}
          onSubmit={async (payload) => {
            setBusy(true);
            const result = await recordInventoryMovementOnServer({ item_id: movementFor.id, ...payload });
            if (result.ok) {
              setOutcome({
                tone: "ok",
                message: `${movementFor.item_name}: ${payload.direction === "in" ? "received" : "issued"} ${payload.quantity} — the register now shows ${result.quantityOnHand ?? "unknown"} on hand.`,
              });
              setMovementFor(null);
              await load();
            } else {
              setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not take the movement." });
            }
            setBusy(false);
          }}
        />
      )}
    </DashboardShell>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  );
}

const inputClass = "w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

function ItemForm({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: DraftItem;
  busy: boolean;
  onChange: (next: DraftItem) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const set = (key: keyof DraftItem) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...draft, [key]: event.target.value });

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-5 my-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{draft.id ? "Correct this register line" : "Add to the school's register"}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              The opening quantity is what the store held when the school began counting. Stock after that only changes
              through a recorded movement, so it cannot be retyped to match a shelf.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Item">
            <input value={draft.item_name} onChange={set("item_name")} required className={inputClass} placeholder="24-seating wooden desk" />
          </Field>
          <Field label="Label or asset number" hint="Leave blank if the school never painted one on it.">
            <input value={draft.asset_ref} onChange={set("asset_ref")} className={inputClass} placeholder="RCA-FA-0142" />
          </Field>
          <Field label="Category">
            <input value={draft.category} onChange={set("category")} className={inputClass} placeholder="Furniture" />
          </Field>
          <Field label="Unit" hint="piece, box, ream, litre, set…">
            <input value={draft.unit} onChange={set("unit")} className={inputClass} placeholder="piece" />
          </Field>
          <Field label="Opening quantity" hint="Only meaningful for a line being started fresh.">
            <input type="number" min={0} value={draft.opening_quantity} onChange={set("opening_quantity")} className={inputClass} />
          </Field>
          <Field label="Kept where">
            <input value={draft.location} onChange={set("location")} className={inputClass} placeholder="Stores B" />
          </Field>
          <Field label="Custodian" hint="The person answerable for it, named as the school names them.">
            <input value={draft.custodian} onChange={set("custodian")} className={inputClass} placeholder="Mrs Okon" />
          </Field>
          <Field label="Condition">
            <select value={draft.condition} onChange={set("condition")} className={inputClass}>
              {CONDITIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Acquired on" hint="Blank means the school does not know, which the register prints as it is.">
            <input type="date" value={draft.acquired_on} onChange={set("acquired_on")} className={inputClass} />
          </Field>
          <Field label="Value paid" hint="Blank is left out of totals rather than added as zero.">
            <input type="number" min={0} step="0.01" value={draft.purchase_value} onChange={set("purchase_value")} className={inputClass} />
          </Field>
          <Field label="Reorder level" hint="Blank means the school has set none, so nothing is flagged.">
            <input type="number" min={0} value={draft.reorder_level} onChange={set("reorder_level")} className={inputClass} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea value={draft.notes} onChange={set("notes")} rows={2} className={inputClass} />
        </Field>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg cursor-pointer"
          >
            {busy ? "Filing…" : "File on the school's register"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MovementForm({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { direction: "in" | "out"; quantity: number; party: string; purpose: string; moved_on?: string }) => void;
}) {
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [quantity, setQuantity] = useState("1");
  const [party, setParty] = useState("");
  const [purpose, setPurpose] = useState("");
  const [movedOn, setMovedOn] = useState("");

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ direction, quantity: Number(quantity), party, purpose, ...(movedOn ? { moved_on: movedOn } : {}) });
        }}
        className="bg-white rounded-xl shadow-lg w-full max-w-lg p-5 my-8"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Move {item.item_name}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {item.quantity_on_hand} {item.unit}{item.quantity_on_hand === 1 ? "" : "s"} on the shelf now. Issuing more
              than that is refused rather than allowed to go negative.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {(["out", "in"] as const).map((way) => (
            <button
              key={way}
              type="button"
              onClick={() => setDirection(way)}
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                direction === way
                  ? way === "out"
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-emerald-600 text-white border-emerald-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {way === "out" ? "Issue out of stores" : "Receive into stores"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} required className={inputClass} />
          </Field>
          <Field label="Date moved" hint="Blank is today. A future date is refused.">
            <input type="date" value={movedOn} onChange={(event) => setMovedOn(event.target.value)} className={inputClass} />
          </Field>
          <Field label={direction === "out" ? "Issued to" : "Received from"}>
            <input
              value={party}
              onChange={(event) => setParty(event.target.value)}
              className={inputClass}
              placeholder={direction === "out" ? "Primary 3 art lesson / Mrs Okon" : "Alfa Stationers, invoice 8821"}
            />
          </Field>
          <Field label="Purpose">
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} className={inputClass} placeholder="Inter-house sports prizes" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg cursor-pointer"
          >
            {busy ? "Filing…" : "File this movement"}
          </button>
        </div>
      </form>
    </div>
  );
}
