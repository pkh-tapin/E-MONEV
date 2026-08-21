"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import PublicDashboard from "@/components/PublicDashboard";
import LiveSearchKPM from "@/components/LiveSearchKPM";
import SurveyForm from "@/components/SurveyForm";
import { KPM } from "@/lib/types";

export default function HomePage() {
  const [selectedKpm, setSelectedKpm] = useState<KPM | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Dashboard Publik Realtime + List Sudah/Belum dengan Tombol Isi Langsung */}
        <PublicDashboard onSelectKpm={(kpm) => setSelectedKpm(kpm)} />

        {/* Pencarian Autocomplete NIK/Nama */}
        <LiveSearchKPM
          onSelectKpm={(kpm) => setSelectedKpm(kpm)}
          selectedKpm={selectedKpm}
        />

        {/* Form Survei Dinamis (Otomatis terbuka saat KPM dipilih) */}
        {selectedKpm && (
          <div id="survey-form-container" className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <SurveyForm
              kpm={selectedKpm}
              onResetSelection={() => setSelectedKpm(null)}
            />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Portal Survei BANSOS PKH Kab. Tapin • Terintegrasi Firebase Realtime DB & Google Drive API
      </footer>
    </div>
  );
}