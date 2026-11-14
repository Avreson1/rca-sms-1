"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MoreVertical,
  ChevronDown,
  Pencil,
  FileText,
  KeyRound,
  CreditCard,
  Shield,
  Trash2,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

export interface RowActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger" | "brand";
  disabled?: boolean;
  title?: string;
}

export interface RowActionsDropdownProps {
  label?: string;
  items: RowActionItem[];
  align?: "left" | "right";
  className?: string;
}

export function RowActionsDropdown({
  label = "Actions",
  items,
  align = "right",
  className = "",
}: RowActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Auto-flip upward when near viewport bottom
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedMenuHeight = Math.min(items.length * 36 + 16, 260);
    setFlipUp(spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight);
  }, [items.length]);

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-md shadow-2xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-100"
        title="Open record actions menu"
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 min-w-[175px] py-1 bg-white border border-slate-200 rounded-lg shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          } ${flipUp ? "bottom-full mb-1 origin-bottom-right" : "top-full mt-1 origin-top-right"}`}
        >
          {items.map((item) => {
            const isDanger = item.variant === "danger";
            const isBrand = item.variant === "brand";

            const itemClass = `w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
              item.disabled
                ? "opacity-40 cursor-not-allowed pointer-events-none text-slate-400"
                : isDanger
                ? "text-red-700 hover:bg-red-50 hover:text-red-800"
                : isBrand
                ? "text-blue-700 hover:bg-blue-50 font-semibold"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`;

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  title={item.title}
                  onClick={() => setIsOpen(false)}
                  className={itemClass}
                >
                  {item.icon && <span className="w-3.5 h-3.5 shrink-0 text-slate-500">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                title={item.title}
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                className={itemClass}
              >
                {item.icon && (
                  <span
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDanger ? "text-red-600" : isBrand ? "text-blue-600" : "text-slate-500"
                    }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
