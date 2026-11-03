"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Send } from "lucide-react";

interface EmailBannerProps {
  email: string;
}

export function EmailBanner({ email }: EmailBannerProps) {
  const [sent, setSent] = useState(false);

  const handleResend = () => {
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="bg-amber-500 text-white p-2 rounded-lg mt-0.5 sm:mt-0 flex-shrink-0 shadow-xs">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-950">Email Confirmation Required</h4>
          <p className="text-xs text-amber-800 mt-0.5">
            Your staff account requires email verification (<span className="font-semibold underline">{email}</span>) to unlock result publishing and continuous assessment broadcasts.
          </p>
        </div>
      </div>

      <button
        onClick={handleResend}
        disabled={sent}
        className="self-start sm:self-center bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
      >
        {sent ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmation Sent!
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            Resend Confirmation
          </>
        )}
      </button>
    </div>
  );
}
