"use client";

import React, { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, remove, update } from "firebase/database";
import * as XLSX from "xlsx";
import {
  Download,
  Eye,
  Trash2,
  Edit3,
  Printer,
  ExternalLink,
  X,
  MapPin,
  Search,
  ZoomIn,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Save,
  FolderOpen,
  ShieldAlert,
  Sparkles,
  User,
  Fingerprint,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { SurveySubmission } from "@/lib/types";

interface QuestionItem {
  key: string;
  modul: string;
  label: string;
  type: string;
}

// =========================================================================
// KOMPONEN GAMBAR ANTI PECAH & ANTI DIBLOKIR GOOGLE (MENGGUNAKAN CDN LH3)
// =========================================================================
const SafeImage = ({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => { setHasError(false); }, [src]);

  if (hasError || !src) {
    return (
      <div 
        className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-200 transition p-2 text-center"
        onClick={onClick}
      >
        <ImageIcon className="w-8 h-8 mb-2 opacity-40 text-rose-500" />
        <span className="text-[10px] font-bold text-slate-600">Gagal Muat.<br/>Klik Buka Manual</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onClick={onClick}
      onError={() => setHasError(true)}
    />
  );
};

export default function RespondenCRUDPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("SEMUA");

  // Modal Detail & Edit State
  const [detailSub, setDetailSub] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editAnswers, setEditAnswers] = useState<Record<string, any>>({});
  const [editNama, setEditNama] = useState("");
  const [editNik, setEditNik] = useState("");
  const [editDesa, setEditDesa] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // =========================================================================
  // HELPER PENTING: Mengekstrak URL Foto Drive (BYPASS LH3 GOOGLE KUNCI MATI)
  // =========================================================================
  const getDriveImageUrl = (fileObj: any) => {
    if (!fileObj) return "";
    
    // Bypass utama LH3 (anti blokir)
    if (fileObj.directUrl && fileObj.directUrl.includes("lh3.googleusercontent.com")) {
      return fileObj.directUrl;
    }
    
    // Extract ID and force LH3
    let fileId = fileObj.fileId;
    if (!fileId && fileObj.viewUrl) {
      const match = fileObj.viewUrl.match(/\/d\/(.+?)\//);
      if (match) fileId = match[1];
    }
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    return fileObj.viewUrl || "";
  };

  useEffect(() => {
    const subRef = ref(database, "submissions");
    const unsubSub = onValue(subRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: any[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));

        // 1. Urutkan dari data yang paling baru ke paling lama
        list.sort(
          (a, b) =>
            new Date(b.tgl_survei || 0).getTime() - new Date(a.tgl_survei || 0).getTime()
        );

        // 2. SISTEM PEMBERSIH DATA GANDA (Hanya menampilkan 1 data terbaru per KPM)
        const uniqueSubmissions: any[] = [];
        const seenIdentifiers = new Set();

        list.forEach((sub) => {
          // Identifikasi unik bisa pakai KPM_ID, NIK, atau Nama
          const uniqueId = sub.kpm_id || sub.nik || sub.nama;
          
          if (!seenIdentifiers.has(uniqueId)) {
            seenIdentifiers.add(uniqueId);
            uniqueSubmissions.push(sub);
          }
        });

        // Set hanya data yang unik
        setSubmissions(uniqueSubmissions);
      } else {
        setSubmissions([]);
      }
    });

    const qRef = ref(database, "master_pertanyaan");
    const unsubQ = onValue(qRef, (snap) => {
      const val = snap.val();
      if (val) {
        const qList: QuestionItem[] = Object.keys(val).map((k) => ({
          key: k,
          modul: val[k].modul || "Kuesioner",
          label: val[k].label || k,
          type: val[k].type || "text",
        }));
        setQuestions(qList);
      }
    });

    return () => {
      unsubSub();
      unsubQ();
    };
  }, []);

  const villageList = Array.from(new Set(submissions.map((s) => s.desa))).filter(Boolean);

  const filteredSubmissions = submissions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      s.nama?.toLowerCase().includes(q) ||
      s.nik?.toLowerCase().includes(q) ||
      s.desa?.toLowerCase().includes(q);

    const matchVillage = selectedVillage === "SEMUA" || s.desa === selectedVillage;
    return matchQuery && matchVillage;
  });

  const handleOpenDetail = (sub: any, enableEdit = false) => {
    setDetailSub(sub);
    setEditMode(enableEdit);
    setEditAnswers(sub.jawaban || {});
    setEditNama(sub.nama || "");
    setEditNik(sub.nik || "");
    setEditDesa(sub.desa || "");
  };

  const handleToggleLock = async (sub: any) => {
    const newLockState = !sub.is_locked;
    const confirmMsg = newLockState
      ? `KUNCI jawaban survei KPM ${sub.nama}? Warga/Surveyor tidak akan bisa mengubahnya lagi.`
      : `BUKA KUNCI jawaban survei KPM ${sub.nama}?`;

    if (confirm(confirmMsg)) {
      await update(ref(database, `submissions/${sub.id}`), {
        is_locked: newLockState,
        locked_at: newLockState ? new Date().toISOString() : null,
      });

      if (detailSub?.id === sub.id) {
        setDetailSub((prev: any) => ({ ...prev, is_locked: newLockState }));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!detailSub || !detailSub.id) return;
    setSavingEdit(true);

    try {
      await update(ref(database, `submissions/${detailSub.id}`), {
        nama: editNama,
        nik: editNik,
        desa: editDesa,
        jawaban: editAnswers,
        tgl_edit_admin: new Date().toISOString(),
      });

      setDetailSub((prev: any) => ({
        ...prev,
        nama: editNama,
        nik: editNik,
        desa: editDesa,
        jawaban: editAnswers,
      }));

      setEditMode(false);
      alert("Biodata dan jawaban survei berhasil diperbarui!");
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (sub: any) => {
    if (confirm(`Yakin ingin MENGHAPUS data survei KPM: ${sub.nama} (${sub.nik})?`)) {
      if (sub.id) {
        await remove(ref(database, `submissions/${sub.id}`));
      }
      if (sub.kpm_id) {
        await update(ref(database, `master_kpm/${sub.kpm_id}`), {
          status_isi: false,
          submission_id: null,
        });
      }
      if (detailSub?.id === sub.id) setDetailSub(null);
    }
  };

  const exportToExcel = () => {
    if (submissions.length === 0) {
      alert("Belum ada data untuk diekspor.");
      return;
    }

    const dataFormatted = submissions.map((s, idx) => {
      const row: Record<string, any> = {
        No: idx + 1,
        Nama_KPM: s.nama,
        NIK: s.nik,
        Desa: s.desa,
        Status_Kunci: s.is_locked ? "TERKUNCI" : "TERBUKA",
        Waktu_Survei: s.tgl_survei,
        Latitude: s.geolokasi?.lat || "-",
        Longitude: s.geolokasi?.lng || "-",
        Akurasi_GPS: s.geolokasi?.akurasi ? `${s.geolokasi.akurasi}m` : "-",
        Link_Foto_KKS: s.berkas_drive?.foto_pegang_kks?.viewUrl || "-",
        Link_Foto_Tubuh: s.berkas_drive?.foto_kpm_seluruh_tubuh?.viewUrl || "-",
        Link_Foto_Rumah: s.berkas_drive?.foto_rumah_kpm?.viewUrl || "-",
        Link_Foto_Usaha: s.berkas_drive?.foto_usaha_kpm?.viewUrl || "-",
      };

      Object.keys(s.jawaban || {}).forEach((jKey) => {
        const val = s.jawaban[jKey];
        row[jKey] = Array.isArray(val) ? val.join("; ") : val;
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(dataFormatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Responden_PKH");
    XLSX.writeFile(wb, "Rekapitulasi_Lengkap_Survei_PKH_Tapin.xlsx");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm w-full">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Data Responden Survei</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Total <strong>{submissions.length}</strong> KPM terdata • Terhubung ke Google Drive & Firebase
          </p>
        </div>

        <button
          onClick={exportToExcel}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Excel Rekap</span>
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 w-full">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari Nama, NIK, atau Desa KPM..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium outline-none focus:bg-white focus:border-blue-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 outline-none"
          value={selectedVillage}
          onChange={(e) => setSelectedVillage(e.target.value)}
        >
          <option value="SEMUA">Semua Desa ({submissions.length})</option>
          {villageList.map((v) => (
            <option key={v} value={v}>
              Desa {v}
            </option>
          ))}
        </select>
      </div>

      {/* TABEL RESPONSIVE SATU KALI SAJA */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden w-full">
        {/* Tampilan HP (Mobile List Cards) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Tidak ada data responden</div>
          ) : (
            filteredSubmissions.map((s, idx) => (
              <div key={s.id || idx} className="p-4 space-y-3 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{s.nama}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">NIK: {s.nik || "-"}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100">
                        {s.desa}
                      </span>
                      {s.is_locked && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Kunci
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {s.tgl_survei ? new Date(s.tgl_survei).toLocaleDateString("id-ID") : "-"}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleLock(s)}
                    className={`p-2 rounded-xl transition ${
                      s.is_locked ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                    title={s.is_locked ? "Buka Kunci" : "Kunci"}
                  >
                    {s.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleOpenDetail(s, false)}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Profil
                  </button>
                  <button
                    onClick={() => handleOpenDetail(s, true)}
                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition"
                    title="Edit Data"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tampilan Desktop Table */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 text-center w-12">No</th>
                <th className="p-3.5 min-w-[180px]">Nama KPM</th>
                <th className="p-3.5">NIK</th>
                <th className="p-3.5">Desa</th>
                <th className="p-3.5 text-center">Status Kunci</th>
                <th className="p-3.5 text-center">Foto Drive</th>
                <th className="p-3.5 text-right min-w-[200px]">Aksi Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada data responden yang cocok.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3.5 font-bold text-slate-900">{s.nama}</td>
                    <td className="p-3.5 font-mono text-blue-900 font-semibold">{s.nik || "-"}</td>
                    <td className="p-3.5">{s.desa}</td>
                    <td className="p-3.5 text-center">
                      {s.is_locked ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-red-300">
                          <Lock className="w-3 h-3" /> Terkunci
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-emerald-300">
                          <Unlock className="w-3 h-3" /> Terbuka
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {s.berkas_drive?.foto_pegang_kks && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Foto KKS Ada" />
                        )}
                        {s.berkas_drive?.foto_kpm_seluruh_tubuh && (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title="Foto Tubuh Ada" />
                        )}
                        {s.berkas_drive?.foto_rumah_kpm && (
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Foto Rumah Ada" />
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handleToggleLock(s)}
                        className={`p-1.5 rounded-lg transition ${
                          s.is_locked
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        }`}
                        title={s.is_locked ? "Buka Kunci Jawaban" : "Kunci Jawaban"}
                      >
                        {s.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleOpenDetail(s, false)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition"
                      >
                        Profil
                      </button>
                      <button
                        onClick={() => handleOpenDetail(s, true)}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Edit Data"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETAIL BIODATA LENGKAP & EDIT JAWABAN (GRID SIMETRIS TANPA KOSONG)  */}
      {/* ========================================================================= */}
      {detailSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-blue-300 bg-white/10 px-2 py-0.5 rounded">
                    {editMode ? "Mode Edit Jawaban & Biodata" : "Biodata Lengkap Responden"}
                  </span>
                  {detailSub.is_locked && (
                    <span className="text-[10px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Jawaban Dikunci
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mt-1">{detailSub.nama}</h3>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  NIK: {detailSub.nik || "-"} • Desa: {detailSub.desa}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!editMode && (
                  <button
                    onClick={handlePrint}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                  >
                    <Printer className="w-4 h-4" /> Cetak
                  </button>
                )}
                <button
                  onClick={() => handleToggleLock(detailSub)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 transition ${
                    detailSub.is_locked
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {detailSub.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  <span>{detailSub.is_locked ? "Buka Kunci" : "Kunci"}</span>
                </button>
                <button onClick={() => setDetailSub(null)} className="p-2 hover:bg-white/20 rounded-full transition">
                  <X className="w-6 h-6 text-slate-300" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs sm:text-sm">
              
              {/* Form Edit Header Biodata Dasar */}
              {editMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-blue-50/60 border border-blue-200 rounded-2xl">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Lengkap:</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold outline-none focus:border-blue-500"
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor NIK:</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none focus:border-blue-500"
                      value={editNik}
                      onChange={(e) => setEditNik(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Desa:</label>
                    <input
                      type="text"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold outline-none focus:border-blue-500"
                      value={editDesa}
                      onChange={(e) => setEditDesa(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Identitas KPM</p>
                    <p className="text-lg font-black text-slate-900 leading-tight">{detailSub.nama}</p>
                    <div className="flex gap-4 mt-2">
                      <p className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">NIK: {detailSub.nik || "-"}</p>
                      <p className="text-xs text-slate-600 font-bold bg-blue-50 text-blue-800 px-2 py-1 rounded-md">Desa: {detailSub.desa}</p>
                    </div>
                  </div>
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Koordinat & Waktu</p>
                      <p className="font-mono text-xs font-bold text-slate-700">
                        GPS: {detailSub.geolokasi?.lat ? `${detailSub.geolokasi.lat}, ${detailSub.geolokasi.lng}` : "Tidak Tersedia"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Waktu: {detailSub.tgl_survei ? new Date(detailSub.tgl_survei).toLocaleString("id-ID") : "Tidak tercatat"}
                      </p>
                    </div>
                    {detailSub.geolokasi?.lat && (
                      <a
                        href={`https://www.google.com/maps?q=${detailSub.geolokasi.lat},${detailSub.geolokasi.lng}`}
                        target="_blank"
                        className="self-start mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 shadow transition"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Buka Google Maps <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* GALERI FOTO GOOGLE DRIVE (TAMPIL LANGSUNG DENGAN ZOOM INTERNAL)             */}
              {/* ========================================================================= */}
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
                <h4 className="font-extrabold text-slate-900 uppercase text-sm tracking-wider border-l-4 border-amber-500 pl-3 mb-4">
                  Dokumentasi Lapangan
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "foto_pegang_kks", label: "1. Foto KKS" },
                    { key: "foto_kpm_seluruh_tubuh", label: "2. Tubuh Penuh" },
                    { key: "foto_rumah_kpm", label: "3. Foto Rumah" },
                    { key: "foto_usaha_kpm", label: "4. Foto Usaha" },
                  ].map((item) => (
                    <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                      <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-center">
                        <p className="text-[11px] font-bold text-slate-700 truncate">{item.label}</p>
                      </div>
                      <div className="relative group h-36 bg-slate-200 flex-1">
                        {detailSub.berkas_drive?.[item.key] ? (
                          <>
                            <SafeImage 
                              src={getDriveImageUrl(detailSub.berkas_drive[item.key])} 
                              alt={item.label} 
                              onClick={() => setPreviewImage({ 
                                url: getDriveImageUrl(detailSub.berkas_drive[item.key]), 
                                title: `${item.label} - ${detailSub.nama}` 
                              })} 
                            />
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur p-1.5 rounded-xl text-white opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-sm"><ZoomIn className="w-4 h-4" /></div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs"><ImageIcon className="w-6 h-6 mb-1 opacity-30" /> Kosong</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rincian Seluruh Jawaban Kuesioner */}
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <h4 className="font-extrabold text-slate-900 uppercase text-sm tracking-wider border-l-4 border-blue-900 pl-3">
                    Isian Kuesioner ({Object.keys(detailSub.jawaban || {}).length} Butir)
                  </h4>
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{editMode ? "Batal Edit" : "Edit Jawaban"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {Object.keys(detailSub.jawaban || {}).map((qKey, index) => {
                    const qObj = questions.find((q) => q.key === qKey);
                    const labelText = qObj?.label || qKey;
                    const val = editMode ? editAnswers[qKey] : detailSub.jawaban[qKey];

                    return (
                      <div key={qKey} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="font-bold text-slate-700 text-xs leading-snug">
                            <span className="text-slate-400 font-mono mr-1.5">{index + 1}.</span>
                            {labelText}
                          </p>
                        </div>

                        {editMode ? (
                          <input
                            type="text"
                            className="w-full p-2.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            value={Array.isArray(val) ? val.join(", ") : val || ""}
                            onChange={(e) =>
                              setEditAnswers({
                                ...editAnswers,
                                [qKey]: Array.isArray(val)
                                  ? e.target.value.split(",").map((s) => s.trim())
                                  : e.target.value,
                              })
                            }
                          />
                        ) : (
                          <div className="mt-auto">
                            {Array.isArray(val) ? (
                              <div className="flex flex-wrap gap-1.5">
                                {val.map((item: string) => (
                                  <span
                                    key={item}
                                    className="px-2 py-1 bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="font-bold text-slate-900 text-sm bg-white border border-slate-200 px-3 py-2 rounded-xl block">
                                {val || <span className="text-slate-300 italic font-normal text-xs">Kosong</span>}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-900 border-t flex flex-col-reverse sm:flex-row items-center justify-between shrink-0 gap-3 rounded-b-3xl">
              <button
                onClick={() => handleDelete(detailSub)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-red-500 text-slate-300 hover:text-white font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 transition"
              >
                <Trash2 className="w-4 h-4" /> <span>Hapus Data</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                {editMode ? (
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setDetailSub(null)}
                    className="flex-1 sm:flex-none px-8 py-2.5 bg-white hover:bg-slate-200 text-slate-900 font-extrabold rounded-xl text-sm transition"
                  >
                    Tutup Profil
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL ZOOM INTERNAL (TANPA BUKA GOOGLE DRIVE)                             */}
      {/* ========================================================================= */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out animate-in fade-in duration-200"
        >
          <div className="relative max-w-5xl w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Tombol Tutup */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 sm:-top-16 right-0 p-2 sm:p-3 bg-white/10 hover:bg-rose-500 text-white rounded-full transition shadow-xl"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Judul Gambar */}
            <h4 className="text-white font-bold text-xs sm:text-sm mb-4 absolute -top-12 left-0 bg-black/60 px-4 py-2 rounded-xl border border-white/10 shadow-lg tracking-wider">
              {previewImage.title}
            </h4>
            
            {/* Tampilan Gambar Zoom (Bypass Google iframe restriction) */}
            <img
              src={previewImage.url}
              alt="Zoomed Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/5"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      )}
    </div>
  );
}
