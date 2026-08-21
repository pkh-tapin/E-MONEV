"use client";

import React, { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import {
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  UserCheck,
  ChevronRight,
  Filter,
  Sparkles,
} from "lucide-react";
import { KPM, VillageStat } from "@/lib/types";

// Extend interface KPM lokal agar TypeScript mengenali raw_data
interface ExtendedKPM extends KPM {
  raw_data?: Record<string, any>;
}

interface Props {
  onSelectKpm: (kpm: KPM) => void;
}

export default function PublicDashboard({ onSelectKpm }: Props) {
  const [kpmList, setKpmList] = useState<ExtendedKPM[]>([]);
  const [villageStats, setVillageStats] = useState<VillageStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Tab State
  const [activeTab, setActiveTab] = useState<"SEMUA" | "BELUM" | "SUDAH">("BELUM");
  const [selectedVillage, setSelectedVillage] = useState<string>("SEMUA");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const kpmRef = ref(database, "master_kpm");
    const subRef = ref(database, "submissions");

    // Sinkronisasi ganda: mencocokkan master_kpm dengan data submissions yang aktif
    const unsubSub = onValue(subRef, (subSnap) => {
      const subVal = subSnap.val() || {};
      // Kumpulkan seluruh NIK / KPM ID yang benar-benar ada di submissions
      const activeSubmissionNiks = new Set<string>();
      const activeSubmissionKpmIds = new Set<string>();

      Object.values(subVal).forEach((sub: any) => {
        if (sub.nik) activeSubmissionNiks.add(String(sub.nik).trim());
        if (sub.kpm_id) activeSubmissionKpmIds.add(String(sub.kpm_id).trim());
      });

      const unsubKpm = onValue(kpmRef, (kpmSnap) => {
        const kpmVal = kpmSnap.val() || {};
        const list: ExtendedKPM[] = Object.keys(kpmVal).map((key) => {
          const raw = kpmVal[key];
          const nik = String(raw.nik || "").trim();
          // Status OTOMATIS TRUE hanya jika datanya BENAR-BENAR ADA di node submissions
          const isFilled =
            (nik && activeSubmissionNiks.has(nik)) || activeSubmissionKpmIds.has(key);

          return {
            id: key,
            nama: raw.nama || "Tanpa Nama",
            nik: nik,
            desa: raw.desa || "Desa Lainnya",
            status_isi: isFilled,
            submission_id: isFilled ? raw.submission_id : null,
            raw_data: raw.raw_data || {}, // MENGAMBIL DATA DINAMIS
          };
        });

        setKpmList(list);

        // Hitung statistik per desa secara real-time
        const grouped: Record<string, { total: number; sudah: number }> = {};
        list.forEach((k) => {
          const d = k.desa || "Lainnya";
          if (!grouped[d]) grouped[d] = { total: 0, sudah: 0 };
          grouped[d].total += 1;
          if (k.status_isi) grouped[d].sudah += 1;
        });

        const stats: VillageStat[] = Object.keys(grouped).map((desa) => {
          const t = grouped[desa].total;
          const s = grouped[desa].sudah;
          return {
            desa,
            total: t,
            sudah: s,
            belum: t - s,
            persentase: t > 0 ? Math.round((s / t) * 100) : 0,
          };
        });

        setVillageStats(stats.sort((a, b) => b.total - a.total));
        setLoading(false);
      });

      return () => unsubKpm();
    });

    return () => unsubSub();
  }, []);

  const totalKpm = kpmList.length;
  const sudahMengisi = kpmList.filter((k) => k.status_isi).length;
  const belumMengisi = totalKpm - sudahMengisi;
  const persentaseTotal = totalKpm > 0 ? Math.round((sudahMengisi / totalKpm) * 100) : 0;

  // Filter daftar KPM
  const villageList = Array.from(new Set(kpmList.map((k) => k.desa))).filter(Boolean);

  const filteredKpmList = kpmList.filter((k) => {
    const matchTab =
      activeTab === "SEMUA"
        ? true
        : activeTab === "SUDAH"
        ? k.status_isi
        : !k.status_isi;

    const matchVillage = selectedVillage === "SEMUA" || k.desa === selectedVillage;

    const q = searchQuery.toLowerCase();
    
    // Pencarian mencakup Nama, NIK, Desa, DAN Data Dinamis (RT, RW, dll)
    const matchBasic = k.nama.toLowerCase().includes(q) || k.nik.includes(q) || k.desa.toLowerCase().includes(q);
    const matchRaw = Object.values(k.raw_data || {}).some(val => String(val).toLowerCase().includes(q));

    return matchTab && matchVillage && (matchBasic || matchRaw);
  });

  return (
    <section className="mb-8 space-y-6">
      {/* 1. Counter Realtime */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab("SEMUA")}
          className={`cursor-pointer p-4 sm:p-5 bg-white border rounded-2xl shadow-sm transition hover:border-blue-500 ${
            activeTab === "SEMUA" ? "border-2 border-blue-600 bg-blue-50/40" : "border-slate-200"
          }`}
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 mb-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Target</p>
          <h3 className="text-xl sm:text-3xl font-bold text-slate-800">{loading ? "..." : totalKpm}</h3>
        </div>

        <div
          onClick={() => setActiveTab("SUDAH")}
          className={`cursor-pointer p-4 sm:p-5 bg-white border rounded-2xl shadow-sm transition hover:border-emerald-500 ${
            activeTab === "SUDAH" ? "border-2 border-emerald-600 bg-emerald-50/40" : "border-slate-200"
          }`}
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 mb-2">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Terverifikasi</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-xl sm:text-3xl font-bold text-emerald-700">{loading ? "..." : sudahMengisi}</h3>
            <span className="text-xs font-bold text-emerald-600">({persentaseTotal}%)</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("BELUM")}
          className={`col-span-2 sm:col-span-1 cursor-pointer p-4 sm:p-5 bg-white border rounded-2xl shadow-sm transition hover:border-amber-500 ${
            activeTab === "BELUM" ? "border-2 border-amber-600 bg-amber-50/40" : "border-slate-200"
          }`}
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 mb-2">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Belum Mengisi</p>
          <h3 className="text-xl sm:text-3xl font-bold text-amber-700">{loading ? "..." : belumMengisi}</h3>
        </div>
      </div>

      {/* 2. Rekap Progres Capaian Per Desa */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-900" />
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">Progres Verifikasi Per Desa</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-y">
              <tr>
                <th className="py-2.5 px-3">Nama Desa</th>
                <th className="py-2.5 px-2 text-center">Target</th>
                <th className="py-2.5 px-2 text-center text-emerald-700">Sudah</th>
                <th className="py-2.5 px-2 text-center text-amber-700">Belum</th>
                <th className="py-2.5 px-3 min-w-[120px]">Capaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {villageStats.map((v) => (
                <tr key={v.desa} className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-semibold text-slate-800">{v.desa}</td>
                  <td className="py-2 px-2 text-center font-medium">{v.total}</td>
                  <td className="py-2 px-2 text-center font-bold text-emerald-600">{v.sudah}</td>
                  <td className="py-2 px-2 text-center font-medium text-amber-600">{v.belum}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${v.persentase}%` }}
                        ></div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">{v.persentase}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. DAFTAR SIAPA YANG SUDAH & BELUM MENGISI (KLIK LANGSUNG ISI) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Daftar Target Warga (Klik Langsung Isi)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredKpmList.length} warga sesuai filter aktif
            </p>
          </div>

          {/* Tab Filter Cepat */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab("BELUM")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "BELUM" ? "bg-amber-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Belum ({belumMengisi})
            </button>
            <button
              onClick={() => setActiveTab("SUDAH")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "SUDAH" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sudah ({sudahMengisi})
            </button>
            <button
              onClick={() => setActiveTab("SEMUA")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === "SEMUA" ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({totalKpm})
            </button>
          </div>
        </div>

        {/* Search & Desa Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama, NIK, RT, RW..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-xl text-xs sm:text-sm font-medium outline-none focus:bg-white focus:border-blue-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
            >
              <option value="SEMUA">Semua Wilayah Desa</option>
              {villageList.map((d) => (
                <option key={d} value={d}>
                  Desa {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List Kartu KPM (Dibatasi Info Tampil) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredKpmList.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs">
              Tidak ada data warga yang cocok dengan filter.
            </div>
          ) : (
            filteredKpmList.map((kpm) => (
              <div
                key={kpm.id || kpm.nik}
                className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 transition shadow-sm"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{kpm.nama}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">NIK: {kpm.nik || "-"}</p>
                  
                  {/* RENDER HANYA DESA, RT, DAN RW */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="inline-block text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 shadow-sm">
                      Desa {kpm.desa}
                    </span>
                    
                    {Object.keys(kpm.raw_data || {})
                      .filter(key => 
                        ["RT", "RW"].includes(key.toUpperCase()) && 
                        kpm.raw_data![key] && 
                        String(kpm.raw_data![key]).trim() !== ""
                      )
                      .map((key) => (
                        <span key={key} className="inline-block text-[10px] font-medium bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded text-slate-600 uppercase">
                          {key}: <strong className="text-slate-800">{kpm.raw_data![key]}</strong>
                        </span>
                      ))}
                  </div>
                </div>

                <div>
                  {kpm.status_isi ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sudah
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectKpm(kpm as KPM);
                        // Scroll otomatis ke bawah menuju form
                        window.scrollTo({ top: 900, behavior: "smooth" });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 active:scale-95 px-3.5 py-2 rounded-xl shadow transition"
                    >
                      <span>Isi Form</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}