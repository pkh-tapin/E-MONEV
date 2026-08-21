"use client";

import React, { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Users, CheckCircle2, Clock, MapPin, Search, ChevronRight, Eye } from "lucide-react";
import { KPM, VillageStat } from "@/lib/types";
import Link from "next/link";

export default function AdminDashboard() {
  const [kpmList, setKpmList] = useState<KPM[]>([]);
  const [stats, setStats] = useState<VillageStat[]>([]);
  const [filterTab, setFilterTab] = useState<"SEMUA" | "SUDAH" | "BELUM">("SEMUA");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const kpmRef = ref(database, "master_kpm");
    const subRef = ref(database, "submissions");

    // Sinkronisasi realtime dua arah
    const unsubSub = onValue(subRef, (subSnap) => {
      const subVal = subSnap.val() || {};
      const activeNiks = new Set<string>();
      const activeKpmIds = new Set<string>();

      Object.values(subVal).forEach((sub: any) => {
        if (sub.nik) activeNiks.add(String(sub.nik).trim());
        if (sub.kpm_id) activeKpmIds.add(String(sub.kpm_id).trim());
      });

      const unsubKpm = onValue(kpmRef, (kpmSnap) => {
        const kpmVal = kpmSnap.val() || {};
        const list: KPM[] = Object.keys(kpmVal).map((key) => {
          const raw = kpmVal[key];
          const nik = String(raw.nik || "").trim();
          const isFilled = (nik && activeNiks.has(nik)) || activeKpmIds.has(key);

          return {
            id: key,
            nama: raw.nama || "Tanpa Nama",
            nik: nik,
            desa: raw.desa || "Lainnya",
            status_isi: isFilled,
            submission_id: isFilled ? raw.submission_id : null,
          };
        });

        setKpmList(list);

        const grouped: Record<string, { total: number; sudah: number }> = {};
        list.forEach((k) => {
          const d = k.desa || "Lainnya";
          if (!grouped[d]) grouped[d] = { total: 0, sudah: 0 };
          grouped[d].total += 1;
          if (k.status_isi) grouped[d].sudah += 1;
        });

        const vStats = Object.keys(grouped).map((desa) => {
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
        setStats(vStats.sort((a, b) => b.total - a.total));
      });

      return () => unsubKpm();
    });

    return () => unsubSub();
  }, []);

  const total = kpmList.length;
  const sudah = kpmList.filter((k) => k.status_isi).length;
  const belum = total - sudah;

  const filteredList = kpmList.filter((k) => {
    const matchTab =
      filterTab === "SEMUA" ? true : filterTab === "SUDAH" ? k.status_isi : !k.status_isi;
    const q = search.toLowerCase();
    const matchQ = k.nama.toLowerCase().includes(q) || k.nik.includes(q) || k.desa.toLowerCase().includes(q);
    return matchTab && matchQ;
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Utama</h2>
        <p className="text-xs text-slate-500">Ringkasan real-time survei lapangan dan pencapaian per desa</p>
      </div>

      {/* 3 Counter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterTab("SEMUA")}
          className={`cursor-pointer p-5 bg-white border rounded-2xl shadow-sm transition ${
            filterTab === "SEMUA" ? "border-2 border-blue-600 bg-blue-50/30" : ""
          }`}
        >
          <p className="text-xs font-bold text-slate-400 uppercase">Target KPM</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">{total}</h3>
        </div>

        <div
          onClick={() => setFilterTab("SUDAH")}
          className={`cursor-pointer p-5 bg-white border rounded-2xl shadow-sm transition ${
            filterTab === "SUDAH" ? "border-2 border-emerald-600 bg-emerald-50/30" : ""
          }`}
        >
          <p className="text-xs font-bold text-slate-400 uppercase">Terverifikasi (Sudah)</p>
          <h3 className="text-3xl font-bold text-emerald-700 mt-1">{sudah}</h3>
        </div>

        <div
          onClick={() => setFilterTab("BELUM")}
          className={`cursor-pointer p-5 bg-white border rounded-2xl shadow-sm transition ${
            filterTab === "BELUM" ? "border-2 border-amber-600 bg-amber-50/30" : ""
          }`}
        >
          <p className="text-xs font-bold text-slate-400 uppercase">Sisa Belum Mengisi</p>
          <h3 className="text-3xl font-bold text-amber-700 mt-1">{belum}</h3>
        </div>
      </div>

      {/* Rekapitulasi Desa */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-base">Rekapitulasi Capaian Desa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((item) => (
            <div key={item.desa} className="p-3.5 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{item.desa}</h4>
                <p className="text-xs text-slate-500">
                  Target: {item.total} | Sudah: <span className="text-emerald-700 font-bold">{item.sudah}</span> | Belum: <span className="text-amber-700 font-bold">{item.belum}</span>
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                {item.persentase}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rincian Status Per Warga */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-bold text-slate-800 text-base">Daftar Status Warga Sasaran</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Cari nama/NIK..."
              className="p-2 border rounded-xl text-xs bg-slate-50 outline-none w-full sm:w-60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {filteredList.map((kpm) => (
            <div key={kpm.id || kpm.nik} className="py-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{kpm.nama}</h4>
                <p className="text-xs text-slate-500 font-mono">
                  NIK: {kpm.nik || "-"} • Desa: {kpm.desa}
                </p>
              </div>

              <div>
                {kpm.status_isi ? (
                  <Link
                    href="/admin/responden"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Lihat Hasil
                  </Link>
                ) : (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                    Belum Mengisi
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}