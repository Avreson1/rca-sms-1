"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings2,
  GraduationCap,
  Laptop,
  Receipt,
  Mail,
  FileBarChart,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  School,
  Sparkles,
  LogOut,
  ShieldAlert,
  UserCheck,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth, useRealtimeCBTConfig } from "@/lib/realtime-store";
import { isRouteAllowed } from "@/lib/rbac";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  badge?: string;
  children?: { title: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Setup",
    icon: Settings2,
    children: [
      { title: "Calendar & Activities", href: "/setup/calendar" },
      { title: "Sections", href: "/setup/sections" },
      { title: "Classes", href: "/setup/classes" },
      { title: "Subjects", href: "/setup/subjects" },
      { title: "Subject Templates", href: "/setup/subject-templates" },
      { title: "Fees", href: "/setup/fees" },
      { title: "CA Structure", href: "/setup/ca-structure" },
      { title: "Grading Criteria", href: "/setup/grading" },
      { title: "Minimum Pass Score", href: "/setup/pass-scores" },
      { title: "Traits", href: "/setup/traits" },
      { title: "Houses", href: "/setup/houses" },
      { title: "Report Templates", href: "/setup/report-templates" },
    ],
  },
  {
    title: "Operations",
    icon: GraduationCap,
    children: [
      { title: "Students", href: "/operations/students" },
      { title: "Staff", href: "/operations/staff" },
      { title: "Academics", href: "/operations/academics" },
      { title: "Update CA", href: "/operations/update-ca" },
      { title: "Traits Assessments", href: "/operations/traits-assessments" },
      { title: "Publish Results", href: "/operations/publish-results" },
      { title: "Score Card", href: "/operations/score-card" },
      { title: "Promotion", href: "/operations/promotion" },
      { title: "End Term", href: "/operations/end-term" },
      { title: "Send Email", href: "/operations/send-email" },
      { title: "Send SMS", href: "/operations/send-sms" },
    ],
  },
  {
    title: "CBT Portal",
    href: "/cbt",
    icon: Laptop,
    badge: "Active",
  },
  {
    title: "Accounts & Bursary",
    icon: Receipt,
    children: [
      { title: "Invoicing", href: "/accounts/invoicing" },
      { title: "Payment", href: "/accounts/payment" },
      { title: "Transactions", href: "/accounts/transactions" },
    ],
  },
  {
    title: "Inmail Desk",
    href: "/inmail",
    icon: Mail,
  },
  {
    title: "Executive Reports",
    href: "/reports",
    icon: FileBarChart,
  },
  {
    title: "SOP Manual",
    href: "/video-guides",
    icon: BookOpen,
  },
  {
    title: "System Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useRealtimeAuth();
  const { cbtConfig } = useRealtimeCBTConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentRole = mounted ? currentUser?.role ?? null : null;
  const activeCBT = mounted ? cbtConfig : { isOpen: true };

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Setup: pathname.startsWith("/setup"),
    Operations: pathname.startsWith("/operations"),
    "Accounts & Bursary": pathname.startsWith("/accounts"),
  });

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out of the Royal Crown Academy portal?")) {
      logout();
      router.push("/login");
    }
  };

  // Filter navigation items strictly based on the current user's role
  const visibleNavItems = navItems
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => isRouteAllowed(currentRole, child.href));
        if (filteredChildren.length === 0) return null;
        return {
          ...item,
          children: filteredChildren,
        };
      }
      if (item.href && !isRouteAllowed(currentRole, item.href)) {
        return null;
      }
      if (item.title === "CBT Portal") {
        return {
          ...item,
          badge: activeCBT.isOpen ? "Active" : "Closed",
        };
      }
      return item;
    })
    .filter(Boolean) as NavItem[];

  return (
    <aside className="w-64 bg-[#0a1128] text-slate-100 flex flex-col flex-shrink-0 min-h-screen border-r border-blue-950/80 select-none shadow-2xl">
      {/* Brand Header - Royal Blue with Cyan accent */}
      <div className="p-4 border-b border-blue-900/40 flex items-center gap-3 bg-gradient-to-r from-[#0000FF]/25 via-[#000080]/30 to-[#0a1128]">
        <div className="bg-[#0000FF] p-2.5 rounded-xl text-white shadow-lg shadow-blue-700/40 ring-1 ring-cyan-400/40">
          <School className="w-5 h-5 text-cyan-200" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-extrabold text-sm leading-tight text-white tracking-wider drop-shadow-sm">{SCHOOL_INFO.shortName}</h1>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-400/40 uppercase tracking-wider">SMS</span>
          </div>
          <p className="text-[11px] text-blue-200/80 truncate w-40 mt-0.5 font-medium">{SCHOOL_INFO.name}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-sm scrollbar-thin scrollbar-thumb-blue-900">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = openMenus[item.title];
          const isActive = item.href ? pathname === item.href : false;

          if (hasChildren) {
            const isChildActive = item.children?.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.title} className="space-y-0.5">
                <button
                  onClick={() => toggleMenu(item.title)}
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-all text-slate-300 hover:bg-blue-950/70 hover:text-cyan-300 cursor-pointer",
                    isChildActive && "text-cyan-300 bg-blue-900/40 font-semibold border border-blue-800/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4", isChildActive ? "text-cyan-400" : "text-slate-400")} />
                    <span className="text-xs font-semibold tracking-wide">{item.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {isExpanded && (
                  <div className="pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-cyan-500/30 ml-4">
                    {item.children?.map((child) => {
                      const isCurrentChild = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block px-2.5 py-1.5 rounded-lg text-xs transition-all tracking-wide",
                            isCurrentChild
                              ? "text-white bg-[#0000FF] font-bold shadow-md shadow-blue-900/50 border border-cyan-400/40 text-cyan-50"
                              : "text-slate-400 hover:text-cyan-200 hover:bg-blue-950/50"
                          )}
                        >
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href || "#"}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-all text-xs tracking-wide",
                isActive
                  ? "bg-[#0000FF] text-white font-bold shadow-md shadow-blue-900/50 border border-cyan-400/40"
                  : "text-slate-300 hover:bg-blue-950/70 hover:text-cyan-300"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("w-4 h-4", isActive ? "text-cyan-200" : "text-slate-400")} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    "font-black text-[10px] px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shadow-sm uppercase tracking-wider",
                    item.badge === "Active"
                      ? "bg-cyan-400 text-[#0a1128]"
                      : "bg-amber-400 text-amber-950 font-bold"
                  )}
                >
                  {item.badge === "Active" ? (
                    <Sparkles className="w-2.5 h-2.5 text-[#0000FF]" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-900" />
                  )}
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Active Session Info Card */}
        <div className="pt-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-950/70 to-slate-950/90 border border-cyan-500/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Active Session
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                {currentRole}
              </span>
            </div>
            <p className="text-white font-bold truncate text-[11px]">{currentUser?.fullName || "Staff Member"}</p>
            <p className="text-slate-400 font-mono text-[10px] truncate">{currentUser?.staffId || "RCA/PERS/001"}</p>
          </div>
        </div>

        {/* Sign Out / Log Out Button - Scheme 1 Vivid Red Accent */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-xl font-bold text-rose-300 hover:bg-[#FF0000]/15 hover:text-white transition-all text-xs cursor-pointer border border-[#FF0000]/30 shadow-sm"
        >
          <LogOut className="w-4 h-4 text-[#FF0000]" />
          <span>Sign Out / Log Out</span>
        </button>
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-blue-900/40 text-[11px] text-slate-400 bg-slate-950/60">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Academic Session:</span>
          <span className="text-cyan-300 font-bold">{SCHOOL_INFO.currentSession}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-slate-400">Current Term:</span>
          <span className="text-cyan-300 font-bold">{SCHOOL_INFO.currentTerm}</span>
        </div>
      </div>
    </aside>
  );
}
