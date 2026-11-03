"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeFees, FeeComponentRecord, useRealtimeClasses } from "@/lib/realtime-store";
import {
  CreditCard,
  Plus,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Trash2,
  Sparkles,
} from "lucide-react";

export default function SetupFeesPage() {
  const { fees, addFeeComponent, deleteFeeComponent, clearAllFees } = useRealtimeFees();
  const { classes } = useRealtimeClasses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FeeComponentRecord["category"]>("Tuition");
  const [applicableClass, setApplicableClass] = useState("All Classes");
  const [amount, setAmount] = useState<number>(0);
  const [isMandatory, setIsMandatory] = useState(true);

  const totalTermFee = fees.reduce((sum, f) => sum + f.amount, 0);

  const handleAddFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || amount <= 0) return;

    addFeeComponent({
      name: name.trim(),
      category,
      applicableClass,
      amount,
      isMandatory,
      session: SCHOOL_INFO.currentSession,
      term: SCHOOL_INFO.currentTerm,
    });

    setIsModalOpen(false);
    setName("");
    setAmount(0);
    setIsMandatory(true);
  };

  const handleSeedStandardFees = () => {
    const defaultFees: Omit<FeeComponentRecord, "id">[] = [
      {
        name: "Term Tuition & Instructional Fee",
        category: "Tuition",
        applicableClass: "All Classes",
        amount: 90000,
        isMandatory: true,
        session: SCHOOL_INFO.currentSession,
        term: SCHOOL_INFO.currentTerm,
      },
      {
        name: "ICT Lab & Computer Systems Levy",
        category: "Levy",
        applicableClass: "All Classes",
        amount: 20000,
        isMandatory: true,
        session: SCHOOL_INFO.currentSession,
        term: SCHOOL_INFO.currentTerm,
      },
      {
        name: "Science Practical & Chemical Reagents Fee",
        category: "Laboratory",
        applicableClass: "SS 1 - SS 3",
        amount: 15000,
        isMandatory: true,
        session: SCHOOL_INFO.currentSession,
        term: SCHOOL_INFO.currentTerm,
      },
      {
        name: "Terminal Examination & CBT Testing Levy",
        category: "Examination",
        applicableClass: "All Classes",
        amount: 10000,
        isMandatory: true,
        session: SCHOOL_INFO.currentSession,
        term: SCHOOL_INFO.currentTerm,
      },
      {
        name: "School Development & Infrastructure Fund",
        category: "Levy",
        applicableClass: "All Classes",
        amount: 10000,
        isMandatory: true,
        session: SCHOOL_INFO.currentSession,
        term: SCHOOL_INFO.currentTerm,
      },
    ];

    defaultFees.forEach((f) => addFeeComponent(f));
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Fee Structure</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Institutional Fee Schedule &amp; Levies
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Dynamic termly billing structure applied to student invoices for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {fees.length === 0 && (
              <button
                onClick={handleSeedStandardFees}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Populate Standard Fee Schedule
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Fee Component
            </button>
            <Link
              href="/accounts/invoicing"
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              Generate Invoices
            </Link>
          </div>
        </div>

        {/* Total Fee Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              Standard Cumulative Term Bill
            </span>
            <h2 className="text-3xl font-black text-white mt-1">
              ₦{totalTermFee.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">/ Student (Termly Cumulative)</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Session: <strong className="text-white">{SCHOOL_INFO.currentSession}</strong> • Term:{" "}
              <strong className="text-emerald-400">{SCHOOL_INFO.currentTerm}</strong>
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl text-xs space-y-1">
            <p className="text-slate-400">
              Active Components: <strong className="text-white">{fees.length} Items</strong>
            </p>
            <p className="text-slate-400">
              Currency: <strong className="text-emerald-400">Nigerian Naira (NGN - ₦)</strong>
            </p>
          </div>
        </div>

        {/* Fee Items Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Itemized Fee Components</h3>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
              {fees.length} Fee Items Active
            </span>
          </div>

          {fees.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <div className="text-sm font-semibold text-slate-600">No Fee Components Configured</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No fee items currently configured. Click &apos;Add Fee Component&apos; or &apos;Populate Standard Fee Schedule&apos; to begin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4">Fee Item Name</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Target Level</th>
                    <th className="py-3 px-4 text-right">Amount (₦)</th>
                    <th className="py-3 px-3 text-center">Requirement</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fees.map((f) => (
                    <tr key={f.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{f.name}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {f.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{f.applicableClass}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        ₦{f.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            f.isMandatory
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-slate-600 bg-slate-100 border-slate-200"
                          }`}
                        >
                          {f.isMandatory ? "Mandatory" : "Optional"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Remove fee item ${f.name}?`)) {
                              deleteFeeComponent(f.id);
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Delete fee item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Add Fee Component */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Add Institutional Fee Component
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddFee} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fee Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tuition Fee, ICT Lab Levy, Sports Levy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="Tuition">Tuition</option>
                      <option value="Levy">Levy</option>
                      <option value="Examination">Examination</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Extracurricular">Extracurricular</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Level / Class</label>
                    <select
                      value={applicableClass}
                      onChange={(e) => setApplicableClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="All Classes">All Classes</option>
                      <option value="Creche & Playgroup">Creche &amp; Playgroup</option>
                      <option value="Nursery 1 & 2">Nursery 1 &amp; 2</option>
                      <option value="Primary 1 - 5">Primary 1 - 5</option>
                      <option value="JSS 1 - 3">JSS 1 - 3</option>
                      <option value="SS 1 - 3">SS 1 - 3</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₦ NGN)</label>
                  <input
                    type="number"
                    min="100"
                    required
                    placeholder="e.g. 50000"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono font-bold"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="mandatoryCheck"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300"
                  />
                  <label htmlFor="mandatoryCheck" className="text-slate-700 font-medium">
                    Compulsory / Mandatory for all enrolled students
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Save Fee Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
