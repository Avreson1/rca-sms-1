"use client";

import React from "react";
import { useSchoolConfig } from "@/lib/school-config";
import { SCHOOL_INFO } from "@/lib/constants";

export type SchoolBrandContext = "PRIMARY" | "SECONDARY" | "GROUP";

export interface SchoolLetterheadProps {
  brand?: SchoolBrandContext;
  title?: string;
  subtitle?: string;
  showSignatoryFooter?: boolean;
  signatoryLabel?: string;
  signatoryName?: string;
  className?: string;
  children?: React.ReactNode;
}

export function SchoolLetterhead({
  brand = "GROUP",
  title,
  subtitle,
  showSignatoryFooter = false,
  signatoryLabel = "Principal / Head of School",
  signatoryName = "Dr. Mrs. P. O. Awoniyi",
  className = "",
  children,
}: SchoolLetterheadProps) {
  const { config } = useSchoolConfig();

  // Institution brand resolution
  let institutionName = "ROYAL CROWN GROUP OF SCHOOLS";
  let motto = config?.motto?.trim() || "Excellence, Integrity & Academic Prowess";
  let brandColor = "#1e3a8a"; // Royal Blue
  let crestAccent = "#f59e0b"; // Gold

  if (brand === "PRIMARY") {
    institutionName = "ROYAL CROWN ACADEMY";
    motto = "Excellence and Integrity in Early & Basic Education";
    brandColor = "#1d4ed8";
    crestAccent = "#f59e0b";
  } else if (brand === "SECONDARY") {
    institutionName = "ROYAL CROWN HIGH SCHOOL";
    motto = "Leadership, Academic Rigour & High Moral Standards";
    brandColor = "#0f172a";
    crestAccent = "#e11d48";
  }

  const address = config?.address?.trim() || SCHOOL_INFO.address;
  const phone = config?.phone?.trim() || SCHOOL_INFO.phone;
  const email = config?.email?.trim() || SCHOOL_INFO.email;
  const website = config?.website?.trim() || SCHOOL_INFO.website;
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={`letterhead-container font-sans text-slate-800 ${className}`}>
      {/* Letterhead Header Section */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Vector School Crest */}
          <div className="flex-shrink-0">
            <svg
              width="64"
              height="64"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              className="drop-shadow-xs"
            >
              <path
                d="M16 1.6 28.4 6.1v9.2c0 7.2-5.1 12.4-12.4 15.1C8.7 27.7 3.6 22.5 3.6 15.3V6.1L16 1.6Z"
                fill={brandColor}
                stroke="#0f172a"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path
                d="M9 18.4h14l-1.5-8.2-3.6 3.3L16 8.4l-1.9 5.1-3.6-3.3L9 18.4Z"
                fill={crestAccent}
                stroke="#0f172a"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
              <rect x="9" y="19.6" width="14" height="2.2" rx="1" fill="#ffffff" />
              <circle cx="9.4" cy="9.6" r="1.3" fill="#ffffff" />
              <circle cx="22.6" cy="9.6" r="1.3" fill="#ffffff" />
              <circle cx="16" cy="7.2" r="1.3" fill="#ffffff" />
            </svg>
          </div>

          {/* School Name & Motto */}
          <div className="flex-1 text-center">
            <h1
              className="text-xl sm:text-2xl font-black tracking-wide uppercase leading-tight"
              style={{ color: brandColor }}
            >
              {institutionName}
            </h1>
            <p className="text-[11px] font-bold italic text-slate-600 mt-0.5 tracking-wide">
              &ldquo;{motto}&rdquo;
            </p>
            <div className="text-[10px] text-slate-600 font-medium mt-1 leading-snug">
              <span>{address}</span>
              <span className="mx-1.5">•</span>
              <span>Tel: {phone}</span>
              <span className="mx-1.5">•</span>
              <span>Email: {email}</span>
            </div>
            {website && (
              <p className="text-[10px] text-blue-700 font-bold mt-0.5">
                {website}
              </p>
            )}
          </div>

          {/* Stamp / Clearance Box Placeholder */}
          <div className="hidden sm:block flex-shrink-0 w-24 h-16 border-2 border-dashed border-slate-300 rounded-lg text-center p-1">
            <span className="text-[8px] font-extrabold uppercase text-slate-400 block tracking-wider">
              Official Stamp
            </span>
            <span className="text-[7px] text-slate-400 block mt-1">
              APPROVED &amp; SEALED
            </span>
          </div>
        </div>

        {/* Double Rule Separator */}
        <div className="border-t border-slate-300 mt-2.5 pt-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span>RC / MOE Approval: PL/EDU/REC/2018/0942</span>
          <span>Date Issued: {currentDate}</span>
        </div>
      </div>

      {/* Document Title & Subtitle Banner */}
      {(title || subtitle) && (
        <div className="mb-4 text-center">
          {title && (
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 inline-block px-4">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs text-slate-600 font-medium mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Body content */}
      {children}

      {/* Print Signatory & Stamp Footer */}
      {showSignatoryFooter && (
        <div className="mt-8 pt-4 border-t-2 border-slate-800 break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-6">
                Prepared / Verified By:
              </span>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <strong className="text-slate-900 text-xs block">Registry &amp; Records Office</strong>
              <span className="text-[10px] text-slate-500">Royal Crown Group of Schools</span>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-6">
                Authorized Official Signature:
              </span>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <strong className="text-slate-900 text-xs block">{signatoryName}</strong>
              <span className="text-[10px] text-slate-500">{signatoryLabel}</span>
            </div>
          </div>
          <div className="text-center text-[9px] text-slate-400 mt-4">
            *** This is an official institutional document generated from the Royal Crown Academy portal on {currentDate}. Alteration renders it invalid. ***
          </div>
        </div>
      )}
    </div>
  );
}
