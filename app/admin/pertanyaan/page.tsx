"use client";

import React, { useState, useEffect } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, set, remove, update } from "firebase/database";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  Trash2,
  Plus,
  Edit3,
  HelpCircle,
  FileSpreadsheet,
  FolderOpen,
  Filter,
  Sparkles,
  GitFork,
  X,
  Save,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";

interface QuestionItem {
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

export default function PertanyaanAdminPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterModul, setFilterModul] = useState<string>("SEMUA");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeKey, setActiveKey] = useState("");

  // Form Field State
  const [formNo, setFormNo] = useState<number>(1);
  const [formKey, setFormKey] = useState("");
  const [formModul, setFormModul] = useState("1. Kondisi Rumah & Sosial Ekonomi");
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState("radio");
  const [formRequired, setFormRequired] = useState(true);
  const [formIsHidden, setFormIsHidden] = useState(false);
  const [formIsReadonly, setFormIsReadonly] = useState(false); 
  const [formDefaultValue, setFormDefaultValue] = useState(""); 
  const [formOptions, setFormOptions] = useState("");
  const [formPlaceholder, setFormPlaceholder] = useState("");
  const [formDriveFolder, setFormDriveFolder] = useState("-");

  // Conditional Logic Builder State
  const [enableConditional, setEnableConditional] = useState(false);
  const [condParentKey, setCondParentKey] = useState("");
  const [condTriggerValue, setCondTriggerValue] = useState("");

  useEffect(() => {
    const qRef = ref(database, "master_pertanyaan");
    const unsubscribe = onValue(qRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: QuestionItem[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        list.sort((a, b) => (a.no || 0) - (b.no || 0));
        setQuestions(list);
      } else {
        setQuestions([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setActiveKey("");
    setFormNo(questions.length + 1); // Otomatis taruh di paling bawah
    setFormKey(`q${String(questions.length + 1).padStart(2, "0")}_custom`);
    setFormModul("1. Kondisi Rumah & Sosial Ekonomi");
    setFormLabel("");
    setFormType("radio");
    setFormRequired(true);
    setFormIsHidden(false);
    setFormIsReadonly(false);
    setFormDefaultValue("");
    setFormOptions("Ya; Tidak");
    setFormPlaceholder("-");
    setFormDriveFolder("-");
    setEnableConditional(false);
    setCondParentKey("");
    setCondTriggerValue("");
    setShowModal(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setIsEditing(true);
    setActiveKey(q.key);
    setFormNo(q.no || 1);
    setFormKey(q.key);
    setFormModul(q.modul || "1. Kondisi Rumah & Sosial Ekonomi");
    setFormLabel(q.label || "");
    setFormType(q.type || "radio");
    setFormRequired(q.required ?? true);
    setFormIsHidden(q.is_hidden ?? false);
    setFormIsReadonly(q.is_readonly ?? false);
    setFormDefaultValue(q.default_value || "");
    setFormOptions(q.options?.join("; ") || "");
    setFormPlaceholder(q.placeholder || "-");
    setFormDriveFolder(q.drive_folder || "-");

    if (q.conditional && q.conditional !== "-" && q.conditional.includes("==")) {
      setEnableConditional(true);
      const match = q.conditional.match(/^(\w+)\s*==\s*['"](.+?)['"]$/);
      if (match) {
        setCondParentKey(match[1]);
        setCondTriggerValue(match[2]);
      } else {
        setCondParentKey("");
        setCondTriggerValue(q.conditional);
      }
    } else {
      setEnableConditional(false);
      setCondParentKey("");
      setCondTriggerValue("");
    }

    setShowModal(true);
  };

  const handleToggleHide = async (q: QuestionItem) => {
    const newStatus = !q.is_hidden;
    await update(ref(database, `master_pertanyaan/${q.key}`), {
      is_hidden: newStatus,
    });
  };

  // =========================================================================================
  // SISTEM AUTO-SHIFT (PENGGESERAN OTOMATIS) SAAT TAMBAH / EDIT NOMOR URUT
  // =========================================================================================
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey || !formLabel) {
      alert("Kode DB dan Label Pertanyaan wajib diisi!");
      return;
    }

    const optList = formOptions
      ? formOptions.split(";").map((o) => o.trim()).filter(Boolean)
      : [];

    let conditionalString = "-";
    if (enableConditional && condParentKey && condTriggerValue) {
      conditionalString = `${condParentKey} == '${condTriggerValue}'`;
    }

    const cleanKey = formKey.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const targetNo = Number(formNo) || 1;

    const payload: QuestionItem = {
      no: targetNo,
      key: cleanKey,
      modul: formModul,
      label: formLabel,
      type: formType,
      required: formRequired,
      is_hidden: formIsHidden,
      is_readonly: formIsReadonly,
      default_value: formDefaultValue.trim(),
      options: optList,
      conditional: conditionalString,
      placeholder: formPlaceholder || "-",
      drive_folder: formType.includes("file") ? formDriveFolder : "-",
    };

    const updates: Record<string, any> = {};
    const oldNo = isEditing ? (questions.find((q) => q.key === activeKey)?.no || null) : null;

    // ALGORITMA PENGGESERAN OTOMATIS (AUTO-SHIFT)
    if (!isEditing) {
      // 1. TAMBAH BARU: Semua pertanyaan yang nomornya >= targetNo digeser ke bawah (+1)
      questions.forEach((q) => {
        if (q.no && q.no >= targetNo) {
          updates[`master_pertanyaan/${q.key}/no`] = q.no + 1;
        }
      });
    } else if (oldNo !== null && oldNo !== targetNo) {
      // 2. EDIT SUSUNAN NOMOR URUT
      if (targetNo < oldNo) {
        // Pindah ke Atas: Pertanyaan di antaranya bergeser turun (+1)
        questions.forEach((q) => {
          if (q.key !== activeKey && q.no && q.no >= targetNo && q.no < oldNo) {
            updates[`master_pertanyaan/${q.key}/no`] = q.no + 1;
          }
        });
      } else if (targetNo > oldNo) {
        // Pindah ke Bawah: Pertanyaan di antaranya bergeser naik (-1)
        questions.forEach((q) => {
          if (q.key !== activeKey && q.no && q.no > oldNo && q.no <= targetNo) {
            updates[`master_pertanyaan/${q.key}/no`] = q.no - 1;
          }
        });
      }
    }

    // Eksekusi Hapus Key Lama (jika key diganti saat edit)
    if (isEditing && activeKey && activeKey !== cleanKey) {
      updates[`master_pertanyaan/${activeKey}`] = null; 
    }
    
    // Terapkan Data Pertanyaan Saat Ini
    updates[`master_pertanyaan/${cleanKey}`] = payload;

    // Kirim seluruh update serentak ke database
    await update(ref(database), updates);

    setShowModal(false);
    alert(`Sukses!\nPertanyaan [${cleanKey}] berhasil disimpan dan susunan otomatis disesuaikan!`);
  };

  const handleDelete = async (key: string) => {
    const qToDelete = questions.find((q) => q.key === key);
    if (confirm(`Hapus pertanyaan [${key}] dari database kuesioner?\n\nSistem akan otomatis menaikkan nomor urut pertanyaan di bawahnya agar tetap rapi.`)) {
      const updates: Record<string, any> = {};
      updates[`master_pertanyaan/${key}`] = null; // Eksekusi hapus

      // Geser naik (-1) semua pertanyaan yang posisinya di bawah pertanyaan yang dihapus
      if (qToDelete && qToDelete.no) {
        questions.forEach((q) => {
          if (q.no && q.no > qToDelete.no!) {
            updates[`master_pertanyaan/${q.key}/no`] = q.no - 1;
          }
        });
      }

      await update(ref(database), updates);
    }
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const targetSheet = wb.SheetNames.includes("Master_Kuesioner")
          ? "Master_Kuesioner"
          : wb.SheetNames[0];

        const ws = wb.Sheets[targetSheet];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { range: 3 });

        if (!rawData || rawData.length === 0) {
          throw new Error("File Excel kosong atau header tidak berada di baris ke-4.");
        }

        const questionsObj: Record<string, any> = {};

        rawData.forEach((row, idx) => {
          const key =
            row["Kode Field (DB Key)"] ||
            row["key"] ||
            `q${String(idx + 1).padStart(2, "0")}_custom`;

          const optionsRaw = row["Pilihan Opsi Jawaban (Separator: ; )"] || "-";
          const optionsList =
            optionsRaw && optionsRaw !== "-"
              ? String(optionsRaw)
                  .split(";")
                  .map((opt) => opt.trim())
                  .filter(Boolean)
              : [];

          const isWajib =
            String(row["Wajib"] || "").toUpperCase() === "YA" ||
            row["Wajib"] === true;

          questionsObj[key] = {
            no: parseInt(row["No"] || `${idx + 1}`, 10) || idx + 1,
            key: key,
            modul: row["Kategori Modul"] || "1. Kondisi Rumah & Sosial Ekonomi",
            label: row["Label Pertanyaan Lengkap"] || "",
            type: (row["Tipe Input"] || "radio").toLowerCase().trim(),
            required: isWajib,
            is_hidden: false,
            options: optionsList,
            conditional: row["Logika Bersyarat (Conditional / Show If)"] || "-",
            placeholder: row["Placeholder / Petunjuk Pengisian"] || "-",
            drive_folder: row["Target Penyimpanan Google Drive"] || "-",
            updated_at: new Date().toISOString(),
          };
        });

        await set(ref(database, "master_pertanyaan"), questionsObj);
        alert(`Berhasil mengimpor ${Object.keys(questionsObj).length} pertanyaan ke Firebase!`);
      } catch (err: any) {
        alert("Gagal membaca Excel: " + err.message);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    if (questions.length === 0) return alert("Kuesioner kosong.");
    const dataFormatted = questions.map((q) => ({
      No: q.no || 0,
      "Kode Field (DB Key)": q.key,
      "Kategori Modul": q.modul,
      "Label Pertanyaan Lengkap": q.label,
      "Tipe Input": q.type,
      Wajib: q.required ? "YA" : "TIDAK",
      Status_Publik: q.is_hidden ? "DISEMBUNYIKAN" : "TAMPIL",
      "Pilihan Opsi Jawaban (Separator: ; )": q.options?.join("; ") || "-",
      "Logika Bersyarat (Conditional / Show If)": q.conditional || "-",
      "Placeholder / Petunjuk Pengisian": q.placeholder || "-",
      "Target Penyimpanan Google Drive": q.drive_folder || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataFormatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Kuesioner");
    XLSX.writeFile(wb, "Master_Kuesioner_BANSOS_Tapin.xlsx");
  };

  const uniqueModuls = Array.from(new Set(questions.map((q) => q.modul))).filter(Boolean);
  const filteredQuestions =
    filterModul === "SEMUA" ? questions : questions.filter((q) => q.modul === filterModul);

  const selectedParentQuestion = questions.find((q) => q.key === condParentKey);

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header & Aksi */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-900 rounded-2xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Database & Logika Pertanyaan</h2>
            <p className="text-xs text-slate-500">
              Kelola visibilitas, urutan (Otomatis menyesuaikan), dan syarat ketergantungan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <label className="cursor-pointer flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow transition">
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Mengimpor..." : "Import Excel"}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadExcel} />
          </label>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pertanyaan</span>
          </button>
        </div>
      </div>

      {/* Filter Modul Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-100 p-3.5 rounded-2xl text-xs font-semibold text-slate-700 w-full">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="shrink-0">Kategori Modul:</span>
          <select
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-1.5 outline-none font-medium"
            value={filterModul}
            onChange={(e) => setFilterModul(e.target.value)}
          >
            <option value="SEMUA">Semua Modul ({questions.length} Butir)</option>
            {uniqueModuls.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel Kuesioner dengan Fitur Sembunyikan, Edit & Syarat */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 w-12 text-center">No</th>
                <th className="p-3.5 w-44">Kode DB (Key)</th>
                <th className="p-3.5 min-w-[280px]">Label Pertanyaan & Syarat</th>
                <th className="p-3.5 w-24 text-center">Tipe</th>
                <th className="p-3.5 w-24 text-center">Publik</th>
                <th className="p-3.5 min-w-[180px]">Opsi Pilihan</th>
                <th className="p-3.5 w-28 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada data pertanyaan.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <tr
                    key={q.key}
                    className={`hover:bg-slate-50 transition ${
                      q.is_hidden ? "bg-slate-50/80 opacity-75" : ""
                    }`}
                  >
                    <td className="p-3.5 text-center font-bold text-slate-400">{q.no || idx + 1}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-900">{q.key}</td>
                    <td className="p-3.5 whitespace-normal">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 leading-snug">{q.label}</p>
                        {q.is_hidden && (
                          <span className="shrink-0 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">
                            Disembunyikan
                          </span>
                        )}
                        {q.is_readonly && (
                          <span className="shrink-0 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Kunci
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{q.modul}</span>
                      {q.default_value && (
                        <div className="mt-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-200">
                          Bawaan: {q.default_value}
                        </div>
                      )}
                      {q.conditional && q.conditional !== "-" && (
                        <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                          <GitFork className="w-3 h-3 text-amber-600" />
                          <span>Syarat: {q.conditional}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-block bg-slate-100 text-slate-800 font-mono font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        {q.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleHide(q)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                          q.is_hidden
                            ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        }`}
                        title={q.is_hidden ? "Klik untuk Tampilkan ke Publik" : "Klik untuk Sembunyikan"}
                      >
                        {q.is_hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{q.is_hidden ? "Hidden" : "Tampil"}</span>
                      </button>
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-normal">
                      {q.type.includes("file") ? (
                        <span className="text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Google Drive Target</span>
                        </span>
                      ) : q.options && q.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {q.options.slice(0, 3).map((opt) => (
                            <span key={opt} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              {opt}
                            </span>
                          ))}
                          {q.options.length > 3 && (
                            <span className="text-[10px] text-blue-700 font-bold">+{q.options.length - 3} opsi</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(q)}
                        className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Pertanyaan & Logika"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.key)}
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

      {/* Modal Tambah & Edit Pertanyaan */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base sm:text-lg">
                  {isEditing ? `Edit Pertanyaan [${activeKey}]` : "Tambah Pertanyaan Baru"}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/20 rounded-full">
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Urut:</label>
                  <input
                    type="number"
                    required
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-bold"
                    value={formNo}
                    onChange={(e) => setFormNo(Number(e.target.value))}
                  />
                  <p className="text-[9px] text-slate-400 mt-1">*Sistem otomatis menggeser pertanyaan lain ke bawah.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Kode DB Field (Unique Key):</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: q19_jumlah_pekerja"
                    className="w-full p-2.5 border rounded-xl font-mono font-bold text-blue-900 bg-slate-50 outline-none"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Modul:</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-semibold"
                  value={formModul}
                  onChange={(e) => setFormModul(e.target.value)}
                >
                  <option>1. Kondisi Rumah & Sosial Ekonomi</option>
                  <option>2. Kepesertaan Bansos & Komponen</option>
                  <option>3. KKS & Penyaluran Bansos</option>
                  <option>4. Pemanfaatan Bansos</option>
                  <option>5. Informasi Usaha</option>
                  <option>6. Dokumentasi Foto & Google Drive</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Label / Teks Pertanyaan:</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Tuliskan kalimat pertanyaan lengkap yang akan tampil..."
                  className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-medium text-slate-800"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Input:</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-semibold"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    <option value="radio">Radio (Pilih Satu / Ya-Tidak)</option>
                    <option value="select">Dropdown (Select Box)</option>
                    <option value="multiselect">Multi-select (Pilihan Banyak)</option>
                    <option value="number">Angka (Number)</option>
                    <option value="currency">Mata Uang (Rupiah Rp)</option>
                    <option value="file_image">Upload Foto (Google Drive)</option>
                    <option value="text">Teks Bebas</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wajib Diisi (*):</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-semibold"
                    value={formRequired ? "true" : "false"}
                    onChange={(e) => setFormRequired(e.target.value === "true")}
                  >
                    <option value="true">YA (Wajib)</option>
                    <option value="false">TIDAK (Opsional)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Visibilitas Publik:</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-semibold"
                    value={formIsHidden ? "true" : "false"}
                    onChange={(e) => setFormIsHidden(e.target.value === "true")}
                  >
                    <option value="false">Tampilkan di Form</option>
                    <option value="true">Sembunyikan dari Publik</option>
                  </select>
                </div>
              </div>

              {["radio", "select", "multiselect"].includes(formType) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilihan Opsi Jawaban (Pisahkan dengan titik koma ; ):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ya; Tidak ATAU Pilihan A; Pilihan B; Pilihan C"
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-medium"
                    value={formOptions}
                    onChange={(e) => setFormOptions(e.target.value)}
                  />
                </div>
              )}

              {/* FITUR PENGATURAN KUNCI JAWABAN & NILAI DEFAULT ADMIN */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-2 border-b border-amber-200/50 pb-2">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <h4 className="font-bold text-amber-900 text-sm">Pengaturan Otoritas Jawaban (Opsional)</h4>
                </div>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" id="is_readonly"
                    checked={formIsReadonly}
                    onChange={(e) => setFormIsReadonly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <label htmlFor="is_readonly" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                    Kunci Input (Warga/Surveyor tidak bisa mengubah isian di form)
                  </label>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Jawaban Bawaan (Default Terisi Otomatis):</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-sm font-bold text-blue-900 outline-none focus:border-amber-500"
                    placeholder="Ketik jawaban baku..."
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                  />
                  <p className="text-[10px] text-amber-700 mt-1.5 font-medium italic">
                    * Jika tipe jawaban adalah Pilihan, pastikan teks sama persis dengan opsi di atas.
                  </p>
                </div>
              </div>

              {/* Visual Conditional Logic Builder */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-slate-700" />
                    <span className="font-bold text-slate-900 text-xs">
                      Aturan Logika Bersyarat (Muncul Hanya Jika...)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableConditional}
                      onChange={(e) => setEnableConditional(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-bold text-slate-700 text-[11px]">Aktifkan Syarat</span>
                  </label>
                </div>

                {enableConditional && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 animate-in fade-in">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        1. Pilih Pertanyaan Pemicu:
                      </label>
                      <select
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl outline-none font-semibold text-slate-800"
                        value={condParentKey}
                        onChange={(e) => {
                          setCondParentKey(e.target.value);
                          setCondTriggerValue("");
                        }}
                      >
                        <option value="">-- Pilih Pertanyaan --</option>
                        {questions
                          .filter((q) => q.key !== formKey)
                          .map((q) => (
                            <option key={q.key} value={q.key}>
                              [{q.key}] {q.label.substring(0, 45)}...
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        2. Jika Menjawab Nilai:
                      </label>
                      {selectedParentQuestion?.options && selectedParentQuestion.options.length > 0 ? (
                        <select
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl outline-none font-bold text-blue-900"
                          value={condTriggerValue}
                          onChange={(e) => setCondTriggerValue(e.target.value)}
                        >
                          <option value="">-- Pilih Nilai Jawaban --</option>
                          {selectedParentQuestion.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Contoh: Ya atau Sembako"
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl outline-none font-bold text-blue-900"
                          value={condTriggerValue}
                          onChange={(e) => setCondTriggerValue(e.target.value)}
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2 bg-white/80 p-2 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600">
                      <strong>Hasil Logika Sistem:</strong>{" "}
                      {condParentKey && condTriggerValue
                        ? `${condParentKey} == '${condTriggerValue}'`
                        : "Belum disetel lengkap"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pertanyaan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
