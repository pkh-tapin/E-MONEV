import React from "react";
import Link from "next/link";
import { ShieldCheck, UserCheck } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-blue-900 leading-tight">
              SURVEI BANSOS & PKH
            </h1>
            <p className="text-xs text-slate-500 font-medium">Kabupaten Tapin • Verifikasi Lapangan</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 rounded-lg transition-colors"
          >
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>Pintu Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
