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
  UserCheck,
  Lock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SCHOOL_INFO } from "@/lib/constants";
import { useSchoolConfig } from "@/lib/school-config";
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
      { title: "ID Cards", href: "/operations/id-cards" },
      { title: "Duty Roster", href: "/operations/duties" },
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
    badge: "Open here",
  },
  {
    title: "Accounts & Bursary",
    icon: Receipt,
    children: [
      { title: "Invoicing", href: "/accounts/invoicing" },
      { title: "Payment", href: "/accounts/payment" },
      { title: "Transactions", href: "/accounts/transactions" },
      { title: "Inventory", href: "/accounts/inventory" },
    ],
  },
  {
    title: "Memo Drafts",
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

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useRealtimeAuth();
  // The school and term shown to every member of staff, read from the
  // school's own record rather than the text compiled into the portal.
  const { config: school } = useSchoolConfig();
  const { cbtConfig, configSource } = useRealtimeCBTConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // With no role read from the session yet the menu used to draw the whole
  // SUPER_ADMIN navigation, so a browser that had just been handed over — or had
  // its storage cleared — listed every office screen to the next person who looked
  // at it. An unknown role now lists nothing; the screen beside it says why.
  const knownRole = mounted ? currentUser?.role ?? null : null;
  const currentRole = knownRole ?? "Not signed in on this browser";

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Setup: pathname.startsWith("/setup"),
    Operations: pathname.startsWith("/operations"),
    "Accounts & Bursary": pathname.startsWith("/accounts"),
  });

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    if (confirm(`Are you sure you want to log out of the ${school?.school_name || SCHOOL_INFO.name} portal?`)) {
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
        // "here" is the difference that matters: until the school's switch row has
        // been read, this machine only knows what it is holding itself.
        return {
          ...item,
          badge: mounted
            ? cbtConfig.isOpen
              ? configSource === "server"
                ? "Open"
                : "Open here"
              : configSource === "server"
                ? "Closed"
                : "Closed here"
            : undefined,
        };
      }
      return item;
    })
    .filter(Boolean) as NavItem[];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-950 text-white select-none shadow-2xl transition-transform duration-300 ease-out",
        "border-r border-white/10 lg:visible lg:translate-x-0",
        open ? "visible translate-x-0" : "invisible -translate-x-full"
      )}
    >
      <div
        aria-hidden="true"
        className="texture-grid-light pointer-events-none absolute inset-0 opacity-60"
      />

      {/* Brand */}
      <div className="relative flex items-center gap-3 border-b border-white/10 bg-gradient-to-br from-brand-800 to-brand-950 px-4 py-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/20">
          <School className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-sm font-extrabold uppercase tracking-[0.14em] text-white">
              {school?.short_name || SCHOOL_INFO.shortName}
            </h1>
            <span className="rounded-md bg-accent-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
              SMS
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] font-medium text-white/60">
            {school?.school_name || SCHOOL_INFO.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="-mr-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-dark relative flex-1 min-h-0 space-y-1 overflow-y-auto p-3">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = openMenus[item.title];
          const isActive = item.href ? pathname === item.href : false;
          const badgeIsOpen = item.badge?.startsWith("Open") ?? false;

          if (hasChildren) {
            const isChildActive = item.children?.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.title} className="space-y-1">
                <button
                  onClick={() => toggleMenu(item.title)}
                  type="button"
                  aria-expanded={isExpanded}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left transition-colors duration-150 lg:min-h-9",
                    isChildActive
                      ? "bg-white/10 text-white ring-1 ring-inset ring-white/15"
                      : "text-white/70 hover:bg-white/6 hover:text-white"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      className={cn("h-4 w-4 flex-shrink-0", isChildActive ? "text-accent-300" : "text-white/45")}
                      strokeWidth={1.75}
                    />
                    <span className="truncate font-display text-[13px] font-bold tracking-tight">
                      {item.title}
                    </span>
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/50" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-white/35" strokeWidth={2} />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-[26px] space-y-0.5 border-l border-white/12 pl-3">
                    {item.children?.map((child) => {
                      const isCurrentChild = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          aria-current={isCurrentChild ? "page" : undefined}
                          className={cn(
                            "relative flex min-h-10 items-center rounded-lg px-2.5 text-[13px] transition-colors duration-150 lg:min-h-8",
                            isCurrentChild
                              ? "bg-white/12 font-semibold text-white"
                              : "font-medium text-white/58 hover:bg-white/6 hover:text-white"
                          )}
                        >
                          {isCurrentChild && (
                            <span
                              aria-hidden="true"
                              className="absolute -left-[13px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500"
                            />
                          )}
                          <span className="truncate">{child.title}</span>
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
              onClick={onClose}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 transition-colors duration-150 lg:min-h-9",
                isActive
                  ? "bg-white/12 text-white ring-1 ring-inset ring-white/18"
                  : "text-white/70 hover:bg-white/6 hover:text-white"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500"
                />
              )}
              <span className="flex min-w-0 items-center gap-3">
                <Icon
                  className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-accent-300" : "text-white/45")}
                  strokeWidth={1.75}
                />
                <span className="truncate font-display text-[13px] font-bold tracking-tight">
                  {item.title}
                </span>
              </span>
              {item.badge && (
                <span
                  className={cn(
                    "flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset",
                    badgeIsOpen
                      ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/25"
                      : "bg-white/8 text-white/60 ring-white/15"
                  )}
                >
                  {badgeIsOpen ? (
                    <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
                  ) : (
                    <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                  )}
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Active session */}
        <div className="pt-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
                <UserCheck className="h-3 w-3" strokeWidth={2} />
                Active session
              </span>
            </div>
            <p className="mt-2 truncate font-display text-[13px] font-bold tracking-tight text-white">
              {currentUser?.fullName || "Staff Member"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-white/45">
              {currentUser?.staffId || "RCA/PERS/001"}
            </p>
            <p className="mt-2 border-t border-white/10 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-300">
              {currentRole}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 px-3 font-display text-[13px] font-bold tracking-tight text-accent-300 transition-colors duration-150 hover:border-accent-500/40 hover:bg-accent-600 hover:text-white lg:min-h-9"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          <span>Sign out</span>
        </button>
      </nav>

      {/* Term footer */}
      <div className="relative flex-shrink-0 space-y-1.5 border-t border-white/10 bg-brand-950/80 px-4 py-3 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-white/45">Academic session</span>
          <span className="font-mono font-semibold tabular-nums text-white">
            {school?.current_session || SCHOOL_INFO.currentSession}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-white/45">Current term</span>
          <span className="font-semibold text-white">
            {school?.current_term || SCHOOL_INFO.currentTerm}
          </span>
        </div>
      </div>
    </aside>
  );
}