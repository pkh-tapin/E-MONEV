"use client";

import React, { useState, useEffect } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, push, set, update } from "firebase/database";
import {
  Camera,
  MapPin,
  Send,
  Loader2,
  RefreshCw,
  HelpCircle,
  FolderOpen,
  RotateCcw,
  Check,
  Lock,
} from "lucide-react";
import { KPM } from "@/lib/types";

interface QuestionSchema {
  id?: string;
  no?: number;
  key: string;
  modul: string;
  label: string;
  type: string;
  required: boolean;
  is_hidden?: boolean;
  is_readonly?: boolean;
  default_value?: string;
  options?: string[];
  conditional?: string;
  placeholder?: string;
  drive_folder?: string;
}

// Extend KPM untuk bisa menerima submission_id & is_locked
interface ExtendedKPM extends KPM {
  submission_id?: string | null;
  is_locked?: boolean;
}

interface Props {
  kpm: ExtendedKPM;
  onResetSelection: () => void;
}

export default function SurveyForm({ kpm, onResetSelection }: Props) {
  const draftKey = `pkh_draft_${kpm.id || kpm.nik}`;

  const [questions, setQuestions] = useState<QuestionSchema[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // State Jawaban Dinamis
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({});
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string | null>>({});

  // State Geolocation
  const [coords, setCoords] = useState<{
    lat: number | null;
    lng: number | null;
    akurasi: number | null;
    waktu: string;
  }>({
    lat: null,
    lng: null,
    akurasi: null,
    waktu: "",
  });

  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draftSavedAlert, setDraftSavedAlert] = useState(false);

  // 1. Muat Pertanyaan & Cache Draft
  useEffect(() => {
    const qRef = ref(database, "master_pertanyaan");
    const unsubscribe = onValue(qRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: QuestionSchema[] = Object.keys(val)
          .map((k) => ({
            id: k,
            ...val[k],
          }))
          .filter((q) => !q.is_hidden);

        list.sort((a, b) => (a.no || 0) - (b.no || 0));
        setQuestions(list);

        let savedDraft: Record<string, any> = {};
        if (typeof window !== "undefined") {
          try {
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) savedDraft = JSON.parse(rawDraft);
          } catch (e) {
            console.warn("Gagal membaca draft localstorage:", e);
          }
        }

        setAnswers((prev) => {
          // Jangan timpa jika sedang proses load dari Firebase Existing
          if (Object.keys(prev).length > 0 && kpm.submission_id) return prev;

          const initAnswers: Record<string, any> = { ...savedDraft };
          list.forEach((q) => {
            if (initAnswers[q.key] === undefined) {
              if (q.default_value) {
                if (q.type === "multiselect" && typeof q.default_value === "string") {
                  initAnswers[q.key] = q.default_value.split(",").map((s) => s.trim());
                } else {
                  initAnswers[q.key] = q.default_value;
                }
              } else if (q.type === "multiselect") {
                initAnswers[q.key] = [];
              } else if (q.type === "radio" && q.options && q.options.length > 0) {
                initAnswers[q.key] = q.options[0];
              } else {
                initAnswers[q.key] = "";
              }
            }
          });
          return initAnswers;
        });
      } else {
        setQuestions([]);
      }
      setLoadingQuestions(false);
    });

    return () => unsubscribe();
  }, [draftKey, kpm.submission_id]);

  // 2. Jika Statusnya EDIT, Tarik Jawaban dan Foto Sebelumnya dari Database
  useEffect(() => {
    if (kpm.submission_id) {
      const subRef = ref(database, `submissions/${kpm.submission_id}`);
      onValue(
        subRef,
        (snap) => {
          const val = snap.val();
          if (val) {
            if (val.jawaban) {
              setAnswers((prev) => ({ ...prev, ...val.jawaban }));
            }
            if (val.berkas_drive) {
              const previews: Record<string, string> = {};
              Object.keys(val.berkas_drive).forEach((k) => {
                previews[k] = val.berkas_drive[k].directUrl || val.berkas_drive[k].viewUrl;
              });
              setPhotoPreviews((prev) => ({ ...prev, ...previews }));
            }
          }
        },
        { onlyOnce: true }
      );
    }
  }, [kpm.submission_id]);

  // 3. Simpan Otomatis ke LocalStorage Setiap Ada Perubahan
  useEffect(() => {
    if (Object.keys(answers).length > 0 && typeof window !== "undefined") {
      localStorage.setItem(draftKey, JSON.stringify(answers));
      setDraftSavedAlert(true);
      const timer = setTimeout(() => setDraftSavedAlert(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [answers, draftKey]);

  // 4. Ambil Geolocation GPS
  useEffect(() => {
    ambilLokasi();
  }, []);

  const ambilLokasi = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setLoadingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            akurasi: Number(pos.coords.accuracy.toFixed(1)),
            waktu: new Date().toLocaleTimeString("id-ID"),
          });
          setLoadingGps(false);
        },
        () => {
          setLoadingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const formatRupiah = (val: any) => {
    const num = String(val || "").replace(/\D/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("id-ID").format(parseInt(num, 10));
  };

  const isQuestionVisible = (conditional?: string) => {
    if (!conditional || conditional === "-" || conditional.trim() === "") return true;
    try {
      const match = conditional.match(/^(\w+)\s*==\s*['"](.+?)['"]$/);
      if (match) {
        const [, fieldKey, expectedVal] = match;
        return String(answers[fieldKey] || "").trim() === expectedVal.trim();
      }
    } catch {
      return true;
    }
    return true;
  };

  const handleAnswerChange = (key: string, value: any, isReadonly?: boolean) => {
    if (isReadonly) return;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleCurrencyChange = (key: string, rawText: string, isReadonly?: boolean) => {
    if (isReadonly) return;
    const cleanNum = rawText.replace(/\D/g, "");
    setAnswers((prev) => ({ ...prev, [key]: cleanNum }));
  };

  const handleMultiselectToggle = (key: string, option: string, isReadonly?: boolean) => {
    if (isReadonly) return;
    const current: string[] = Array.isArray(answers[key]) ? answers[key] : [];
    const exists = current.includes(option);
    const updated = exists ? current.filter((item) => item !== option) : [...current, option];
    setAnswers((prev) => ({ ...prev, [key]: updated }));
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxWidth = 1200;
          const scale = maxWidth / Math.max(img.width, maxWidth);
          const width = img.width * (scale < 1 ? scale : 1);
          const height = img.height * (scale < 1 ? scale : 1);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.75
          );
        };
      };
    });
  };

  const handlePhotoSelect = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const rawFile = e.target.files[0];
      const compressed = await compressImage(rawFile);
      setPhotoFiles((prev) => ({ ...prev, [key]: compressed }));
      setPhotoPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(compressed) }));
    }
  };

  const handleResetDraft = () => {
    if (confirm(`Hapus draf isian tersimpan khusus untuk warga ${kpm.nama}?`)) {
      localStorage.removeItem(draftKey);
      setAnswers({});
      setPhotoFiles({});
      setPhotoPreviews({});
      alert("Draf isian warga ini telah direset.");
    }
  };

  const uploadPhotoToDrive = async (category: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("nik", kpm.nik || "NO_NIK");
    fd.append("nama", kpm.nama || "WARGA");

    const res = await fetch("/api/upload-drive", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Gagal mengunggah foto ke Google Drive");
    }
    return data;
  };

  // FUNGSI SUBMIT (VALIDASI CERDAS: BISA MEMBACA FOTO EXISTING)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (kpm.is_locked) {
      alert("⚠️ DITOLAK!\n\nSurvei untuk KPM ini telah dikunci oleh Admin dan tidak dapat diubah lagi.");
      return;
    }

    // VALIDASI KETAT WAJIB ISI (Tolak Simpan Jika Kosong)
    for (const q of questions) {
      if (q.required && isQuestionVisible(q.conditional) && !q.is_hidden) {
        
        if (q.type.includes("file")) {
          // Validasi akan Lolos jika Foto Baru (Files) ATAU Foto Lama (Previews) Ada
          if (!photoFiles[q.key] && !photoPreviews[q.key]) {
            alert(`⚠️ PERHATIAN!\n\nDokumen foto wajib belum diunggah:\n"${q.label}"`);
            return;
          }
          continue;
        }

        const ans = answers[q.key];
        const isEmpty =
          ans === undefined ||
          ans === null ||
          String(ans).trim() === "" ||
          (Array.isArray(ans) && ans.length === 0);

        if (isEmpty) {
          alert(`⚠️ PERHATIAN!\n\nPertanyaan wajib belum diisi:\n"${q.label}"`);
          return;
        }
      }
    }

    // Pengecekan Foto Dasar PKH
    if (!photoFiles["foto_pegang_kks"] && !photoPreviews["foto_pegang_kks"]) return alert("Foto 1: Foto KKS wajib diambil!");
    if (!photoFiles["foto_kpm_seluruh_tubuh"] && !photoPreviews["foto_kpm_seluruh_tubuh"]) return alert("Foto 2: Foto Tubuh wajib diambil!");
    if (!photoFiles["foto_rumah_kpm"] && !photoPreviews["foto_rumah_kpm"]) return alert("Foto 3: Foto Rumah wajib diambil!");

    setSubmitting(true);
    let currentSubmissionId = kpm.submission_id;

    try {
      setStatusMessage("Mengamankan isian kuesioner ke database...");
      const submissionsRef = ref(database, "submissions");
      let subRef;

      // UPDATE DATA ATAU BUAT BARU
      if (currentSubmissionId) {
        subRef = ref(database, `submissions/${currentSubmissionId}`);
        await update(subRef, {
          jawaban: answers,
          geolokasi: coords,
          tgl_update: new Date().toISOString() // Update Waktu Saja
        });
      } else {
        const newSub = push(submissionsRef);
        subRef = newSub;
        currentSubmissionId = newSub.key;

        await set(subRef, {
          kpm_id: kpm.id || kpm.nik || "KPM_DATA",
          nik: kpm.nik || "",
          nama: kpm.nama || "",
          desa: kpm.desa || "",
          tgl_survei: new Date().toISOString(),
          geolokasi: coords,
          jawaban: answers,
          status: "MENUNGGU_FOTO",
          is_locked: false,
        });

        if (kpm.id) {
          await update(ref(database, `master_kpm/${kpm.id}`), {
            status_isi: true,
            submission_id: currentSubmissionId,
            tgl_update: new Date().toISOString(),
          });
        }
      }

      setStatusMessage("Memeriksa dan mengunggah foto baru...");
      const photoUpdates: Record<string, any> = {};
      let hasNewPhotos = false;

      // Hanya upload file yang BARU saja diambil (TIDAK MERUSAK FOTO LAMA)
      for (const photoKey of Object.keys(photoFiles)) {
        const file = photoFiles[photoKey];
        if (file) {
          photoUpdates[`berkas_drive/${photoKey}`] = await uploadPhotoToDrive(photoKey, file);
          hasNewPhotos = true;
        }
      }

      if (hasNewPhotos) {
        setStatusMessage("Menyelesaikan sinkronisasi...");
        await update(subRef, photoUpdates);
      }

      await update(subRef, { status: "SELESAI" });

      if (typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
      }

      alert("SEMPURNA! Seluruh data survei dan perubahan berhasil tersimpan.");
      onResetSelection();
    } catch (err: any) {
      console.error(err);
      alert(
        `INFO PENTING:\n\nIsian kuesioner BERHASIL DIAMANKAN, namun Upload Foto GAGAL.\nAlasan: ${err.message}`
      );
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  if (loadingQuestions) {
    return (
      <div className="bg-white border rounded-2xl p-8 text-center space-y-3 shadow-sm">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin mx-auto" />
        <p className="font-bold text-slate-700 text-sm">Memuat kuesioner...</p>
      </div>
    );
  }

  const groupedQuestions: Record<string, QuestionSchema[]> = {};
  questions.forEach((q) => {
    const mod = q.modul || "Kuesioner Umum";
    if (!groupedQuestions[mod]) groupedQuestions[mod] = [];
    groupedQuestions[mod].push(q);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28 sm:pb-8 max-w-5xl mx-auto">
      {/* Header Info Geotagging & Status Draft Perangkat */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-3xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300 bg-white/10 px-2 py-0.5 rounded border border-blue-400/20">
                {kpm.submission_id ? "Mode Edit Data" : `Formulir (${questions.length} Butir)`}
              </span>
              {draftSavedAlert && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <Check className="w-3 h-3" /> Draf Aman
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">{kpm.nama}</h2>
            <p className="text-xs text-slate-300 font-mono">NIK: {kpm.nik || "-"} • Desa: {kpm.desa}</p>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <div className="flex-1 sm:flex-none bg-black/30 backdrop-blur border border-white/10 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-mono text-xs">{coords.lat ? `${coords.lat}, ${coords.lng}` : "GPS..."}</p>
                  <p className="text-[10px] text-slate-400">{coords.akurasi ? `±${coords.akurasi}m Akurasi` : "Aktifkan Lokasi"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={ambilLokasi}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGps ? "animate-spin" : ""}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetDraft}
              className="p-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/20 rounded-2xl text-rose-300 transition"
              title="Reset Isian Warga Ini"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Render Pertanyaan Dinamis (Desain Grid Simetris Tanpa Ruang Kosong) */}
      {Object.keys(groupedQuestions).map((modulName) => {
        const modulQuestions = groupedQuestions[modulName].filter((q) => isQuestionVisible(q.conditional));
        if (modulQuestions.length === 0) return null;

        return (
          <div
            key={modulName}
            className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm w-full"
          >
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base border-l-4 border-blue-900 pl-3 mb-5 uppercase tracking-wide">
              {modulName}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-stretch">
              {modulQuestions.map((q) => {
                
                const labelElement = (
                  <div className="flex justify-between items-start mb-2 min-h-[24px]">
                    <label className="text-xs sm:text-sm font-bold text-slate-700 leading-tight pr-2">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                    </label>
                    {q.is_readonly && (
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest flex items-center gap-0.5 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Tetap
                      </span>
                    )}
                  </div>
                );

                // FOTO GOOGLE DRIVE
                if (q.type.includes("file")) {
                  const preview = photoPreviews[q.key];
                  return (
                    <div
                      key={q.key}
                      className="col-span-1 md:col-span-2 p-5 bg-amber-50/70 border-2 border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                          {q.label} {q.required && <span className="text-red-500">*</span>}
                        </span>
                        <p className="text-xs text-slate-600">
                          {preview ? "Tersimpan di sistem. Klik Ubah Foto jika ingin mengganti." : q.placeholder || "Ambil foto menggunakan kamera HP"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {preview && (
                          <img
                            src={preview}
                            alt="Preview"
                            className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-xl border border-amber-300 shadow-inner"
                          />
                        )}
                        <label className={`cursor-pointer flex-1 sm:flex-none py-3 px-5 text-white font-bold text-xs sm:text-sm rounded-xl text-center flex items-center justify-center gap-2 shadow transition ${q.is_readonly ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 active:scale-95'}`}>
                          <Camera className="w-4 h-4" />
                          <span>{preview ? "Ubah Foto" : "Ambil Foto"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoSelect(q.key, e)}
                            disabled={q.is_readonly}
                          />
                        </label>
                      </div>
                    </div>
                  );
                }

                // RADIO BUTTONS
                if (q.type === "radio") {
                  return (
                    <div key={q.key} className={`p-4 border rounded-2xl flex flex-col justify-between h-full ${q.is_readonly ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      {labelElement}
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {(q.options || ["Ya", "Tidak"]).map((opt) => {
                          const isSelected = answers[q.key] === opt;
                          return (
                            <button
                              type="button" key={opt}
                              onClick={() => handleAnswerChange(q.key, opt, q.is_readonly)}
                              className={`flex-1 min-w-[80px] p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition ${
                                isSelected ? "bg-blue-900 text-white border-blue-900 shadow-sm" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              } ${q.is_readonly && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // DROPDOWN SELECT
                if (q.type === "select") {
                  return (
                    <div key={q.key} className={`p-4 border rounded-2xl flex flex-col justify-between h-full ${q.is_readonly ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      {labelElement}
                      <select
                        className={`w-full mt-auto p-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none ${q.is_readonly ? 'cursor-not-allowed bg-slate-50' : 'focus:border-blue-700 focus:ring-1 focus:ring-blue-700'}`}
                        value={answers[q.key] || ""}
                        onChange={(e) => handleAnswerChange(q.key, e.target.value, q.is_readonly)}
                        disabled={q.is_readonly}
                      >
                        <option value="">-- Silakan Pilih --</option>
                        {(q.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  );
                }

                // MULTISELECT
                if (q.type === "multiselect") {
                  const currentSelected: string[] = Array.isArray(answers[q.key]) ? answers[q.key] : [];
                  return (
                    <div key={q.key} className={`col-span-1 md:col-span-2 p-4 border rounded-2xl flex flex-col justify-between h-full ${q.is_readonly ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      {labelElement}
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {(q.options || []).map((opt) => {
                          const isSelected = currentSelected.includes(opt);
                          return (
                            <button
                              type="button" key={opt}
                              onClick={() => handleMultiselectToggle(q.key, opt, q.is_readonly)}
                              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition ${
                                isSelected ? "bg-blue-900 text-white border-blue-900 shadow-sm" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              } ${q.is_readonly && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // CURRENCY RUPIAH
                if (q.type === "currency") {
                  return (
                    <div key={q.key} className={`p-4 border rounded-2xl flex flex-col justify-between h-full ${q.is_readonly ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      {labelElement}
                      <div className={`flex items-center mt-auto border border-slate-300 bg-white rounded-xl px-3 py-2 ${!q.is_readonly && 'focus-within:border-blue-700 focus-within:ring-1 focus-within:ring-blue-700'}`}>
                        <span className="text-slate-400 font-bold text-xs sm:text-sm mr-2">Rp</span>
                        <input
                          type="text" inputMode="numeric"
                          className={`w-full outline-none text-xs sm:text-sm font-bold text-slate-800 bg-transparent ${q.is_readonly ? 'cursor-not-allowed text-slate-500' : ''}`}
                          placeholder="0"
                          value={formatRupiah(answers[q.key])}
                          onChange={(e) => handleCurrencyChange(q.key, e.target.value, q.is_readonly)}
                          disabled={q.is_readonly}
                        />
                      </div>
                    </div>
                  );
                }

                // TEXT & NUMBER DEFAULT
                return (
                  <div key={q.key} className={`p-4 border rounded-2xl flex flex-col justify-between h-full ${q.is_readonly ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                    {labelElement}
                    <input
                      type={q.type === "number" ? "number" : "text"}
                      placeholder={q.placeholder || "Silahkan isi..."}
                      className={`w-full mt-auto p-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none ${q.is_readonly ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-blue-700 focus:ring-1 focus:ring-blue-700'}`}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleAnswerChange(q.key, e.target.value, q.is_readonly)}
                      disabled={q.is_readonly}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Floating Action Button */}
      <div className="fixed sm:static bottom-0 left-0 right-0 z-40 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none border-t sm:border-t-0 border-slate-200 p-4 sm:p-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] sm:shadow-none w-full">
        <button
          type="button"
          onClick={onResetSelection}
          className="hidden sm:inline-block text-sm font-bold text-slate-500 hover:text-slate-800 underline-offset-4 hover:underline transition"
        >
          Batalkan & Ganti Warga
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-2xl text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition disabled:opacity-70 disabled:cursor-wait"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{statusMessage || "Memproses..."}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{kpm.submission_id ? "SIMPAN PERUBAHAN" : "KIRIM & SIMPAN SURVEI"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
