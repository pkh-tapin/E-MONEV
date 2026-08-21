"use client";

import React, { useState, useEffect, useRef } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Search, UserCheck, AlertCircle, CheckCircle2, X, Fingerprint, User } from "lucide-react";
import { KPM } from "@/lib/types";

interface Props {
  onSelectKpm: (kpm: KPM | null) => void;
  selectedKpm: KPM | null;
}

export default function LiveSearchKPM({ onSelectKpm, selectedKpm }: Props) {
  const [query, setQuery] = useState("");
  const [allKpm, setAllKpm] = useState<KPM[]>([]);
  const [results, setResults] = useState<KPM[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Ambil data master target KPM dari Firebase Realtime Database
  useEffect(() => {
    const kpmRef = ref(database, "master_kpm");
    const unsubscribe = onValue(kpmRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: KPM[] = Object.keys(val).map((key) => ({
          id: key,
          ...val[key],
        }));
        setAllKpm(list);
      } else {
        setAllKpm([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Tutup dropdown jika klik di luar area input
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handler Pencarian Cerdas (Nama ATAU NIK)
  const handleSearch = (text: string) => {
    setQuery(text);
    const cleanText = text.trim().toLowerCase();

    if (!cleanText) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filtered = allKpm.filter((kpm) => {
      const matchNama = kpm.nama?.toLowerCase().includes(cleanText);
      const matchNik = kpm.nik ? String(kpm.nik).includes(cleanText) : false;
      const matchDesa = kpm.desa?.toLowerCase().includes(cleanText);
      return matchNama || matchNik || matchDesa;
    });

    setResults(filtered.slice(0, 10)); // Batasi 10 hasil teratas agar ringan di HP
    setIsOpen(true);
  };

  const handleSelect = (kpm: KPM) => {
    onSelectKpm(kpm);
    setQuery(`${kpm.nama} - ${kpm.nik}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onSelectKpm(null);
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-sm p-4 sm:p-6 mb-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Judul & Petunjuk */}
        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Langkah 1: Identifikasi Sasaran
          </span>
          <h2 className="text-base sm:text-xl font-bold text-slate-800 pt-1">Cari KPM (Nama atau NIK)</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Ketik minimal 2-3 huruf Nama atau angka NIK warga penerima
          </p>
        </div>

        {/* Input Pencarian Mobile First */}
        <div ref={searchContainerRef} className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 sm:left-4 pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>

            <input
              type="text"
              inputMode="search"
              className="w-full pl-11 sm:pl-12 pr-11 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-700 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              placeholder="Contoh: ALAMAH atau 630501..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (query.trim() && results.length > 0) setIsOpen(true);
              }}
            />

            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3.5 p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* List Dropdown Hasil Autocomplete */}
          {isOpen && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b">
                Ditemukan {results.length} KPM yang cocok
              </div>

              {results.map((kpm) => (
                <button
                  key={kpm.id || kpm.nik}
                  type="button"
                  onClick={() => handleSelect(kpm)}
                  className="w-full text-left p-3.5 sm:p-4 hover:bg-blue-50/80 active:bg-blue-100 flex items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-700 shrink-0" />
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                        {kpm.nama}
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                        {kpm.nik}
                      </span>
                      <span>•</span>
                      <span className="text-slate-700 font-sans font-medium">{kpm.desa}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {kpm.status_isi ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sudah
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm">
                        <UserCheck className="w-4 h-4" /> Pilih
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {isOpen && query.trim().length >= 2 && results.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-6 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Data KPM tidak ditemukan</p>
              <p className="text-xs text-slate-400 mt-0.5">Pastikan ejaan nama atau digit NIK yang dimasukkan benar.</p>
            </div>
          )}
        </div>

        {/* Banner KPM Terpilih */}
        {selectedKpm && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-indigo-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-800 bg-blue-200/60 px-2 py-0.5 rounded">
                Target Sasaran Terpilih
              </span>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">{selectedKpm.nama}</h3>
              <p className="text-xs text-slate-600 font-mono">
                NIK: {selectedKpm.nik} • Desa: {selectedKpm.desa}
              </p>
            </div>

            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-blue-200/60">
              {selectedKpm.status_isi ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs border border-amber-300">
                  <AlertCircle className="w-4 h-4" /> Data Sudah Pernah Masuk
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow">
                  <CheckCircle2 className="w-4 h-4" /> Formulir Terbuka di Bawah
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}