"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  Shield,
  ArrowLeft,
  Users,
  Trophy,
  Plus,
} from "lucide-react";

interface SportsHouse {
  id: string;
  name: string;
  colorName: string;
  colorHex: string;
  houseMaster: string;
  studentCount: number;
  motto: string;
  points: number;
}

const initialHouses: SportsHouse[] = [
  {
    id: "h-1",
    name: "Sapphire House",
    colorName: "Blue",
    colorHex: "bg-blue-600 text-white",
    houseMaster: "Mr. Dominic Mark",
    studentCount: 78,
    motto: "Bravery and Diligence",
    points: 420,
  },
  {
    id: "h-2",
    name: "Ruby House",
    colorName: "Red",
    colorHex: "bg-red-600 text-white",
    houseMaster: "Mrs. Sarah Danjuma",
    studentCount: 82,
    motto: "Passion and Victory",
    points: 450,
  },
  {
    id: "h-3",
    name: "Emerald House",
    colorName: "Green",
    colorHex: "bg-emerald-600 text-white",
    houseMaster: "Mr. John Paul Gyang",
    studentCount: 75,
    motto: "Growth and Resilience",
    points: 395,
  },
  {
    id: "h-4",
    name: "Topaz House",
    colorName: "Yellow / Gold",
    colorHex: "bg-amber-500 text-slate-950",
    houseMaster: "Mr. Emmanuel Pam",
    studentCount: 75,
    motto: "Shine with Honor",
    points: 410,
  },
];

export default function SetupHousesPage() {
  const [houses, setHouses] = useState<SportsHouse[]>(initialHouses);

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
              <span className="text-slate-800 font-semibold">Sports Houses</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Institutional Sports Houses
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage extracurricular sports houses, House Masters, and annual Inter-House points for {SCHOOL_INFO.name}.
            </p>
          </div>
        </div>

        {/* Houses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {houses.map((h) => (
            <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.colorHex}`}>
                    {h.colorName}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    {h.points} Pts
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-2">{h.name}</h3>
                <p className="text-xs italic text-slate-500">&ldquo;{h.motto}&rdquo;</p>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
                <p className="text-slate-500">Master: <strong className="text-slate-800">{h.houseMaster}</strong></p>
                <p className="text-slate-500">Membership: <strong className="text-blue-700">{h.studentCount} Students</strong></p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </DashboardShell>
  );
}
