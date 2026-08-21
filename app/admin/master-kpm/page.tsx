"use client";

import React, { useState, useEffect } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, set, push, remove, update } from "firebase/database";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";

interface DynamicKPM {
  id?: string;
  nama: string;
  nik: string;
  desa: string;
  status_isi: boolean;
  submission_id?: string | null;
  tgl_update?: string;
  raw_data: Record<string, any>;
}

export default function MasterKpmDynamicPage() {
  const [kpmList, setKpmList] = useState<DynamicKPM[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedKpm, setSelectedKpm] = useState<DynamicKPM | null>(null);

  // Modal Tambah Manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualData, setManualData] = useState<Record<string, string>>({});

  // 1. Baca Data Realtime dari Firebase
  useEffect(() => {
    // Ambil Data Master KPM
    const kpmRef = ref(database, "master_kpm");
    const unsubscribeKpm = onValue(kpmRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list: DynamicKPM[] = Object.keys(val).map((k) => ({
          id: k,
          nama: val[k].nama || val[k].raw_data?.["NAMA"] || val[k].raw_data?.["Nama"] || "Tanpa Nama",
          nik: val[k].nik || val[k].raw_data?.["NIK"] || val[k].raw_data?.["Nik"] || "",
          desa: val[k].desa || val[k].raw_data?.["DESA"] || val[k].raw_data?.["Desa"] || "-",
          status_isi: val[k].status_isi || false,
          submission_id: val[k].submission_id || null,
          tgl_update: val[k].tgl_update || null,
          raw_data: val[k].raw_data || {},
        }));
        setKpmList(list);
      } else {
        setKpmList([]);
      }
    });

    // Ambil Konfigurasi Header Terdaftar
    const headerRef = ref(database, "settings/master_headers");
    const unsubscribeHeader = onValue(headerRef, (snap) => {
      const val = snap.val();
      if (val && Array.isArray(val)) {
        setHeaders(val);
      } else {
        // Default minimal
        setHeaders(["NAMA", "NIK", "DESA", "STATUS"]);
      }
    });

    return () => {
      unsubscribeKpm();
      unsubscribeHeader();
    };
  }, []);

  // 2. FUNGSI PEMBACA HEADER & DATA DINAMIS (SMART PARSER)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Konversi sheet ke matriks baris (array of arrays)
        const sheetMatrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (!sheetMatrix || sheetMatrix.length === 0) {
          throw new Error("File Excel kosong!");
        }

        // Cari baris header secara pintar (baris pertama yang memiliki teks kolom dominan)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(sheetMatrix.length, 10); i++) {
          const row = sheetMatrix[i];
          const hasTextCols = row.filter((cell) => typeof cell === "string" && cell.trim().length > 0);
          // Jika baris memiliki minimal 2 kolom bernama, anggap sebagai baris header
          if (hasTextCols.length >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        // Ambil nama-nama header
        const rawHeaders: string[] = sheetMatrix[headerRowIndex]
          .map((h: any) => String(h || "").trim())
          .filter((h: string) => h.length > 0);

        if (rawHeaders.length === 0) {
          throw new Error("Tidak dapat mendeteksi header pada file Excel.");
        }

        // Parsing baris data di bawah header
        const dataRows = sheetMatrix.slice(headerRowIndex + 1);
        const batchData: Record<string, any> = {};

        dataRows.forEach((row, idx) => {
          // Lewati jika seluruh baris kosong
          const isEmptyRow = row.every((c) => c === "" || c === null || c === undefined);
          if (isEmptyRow) return;

          const rowObject: Record<string, any> = {};
          rawHeaders.forEach((colName, colIdx) => {
            rowObject[colName] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : "";
          });

          // Ekstraksi pintar untuk NAMA, NIK, dan DESA (Case-Insensitive)
          let namaVal = "";
          let nikVal = "";
          let desaVal = "";

          for (const key of Object.keys(rowObject)) {
            const cleanKey = key.toUpperCase();
            if (cleanKey.includes("NAMA") && !namaVal) namaVal = rowObject[key];
            if ((cleanKey.includes("NIK") || cleanKey.includes("NO_KTP") || cleanKey.includes("NO_KK")) && !nikVal) {
              nikVal = rowObject[key];
            }
            if ((cleanKey.includes("DESA") || cleanKey.includes("KELURAHAN") || cleanKey.includes("ALAMAT")) && !desaVal) {
              desaVal = rowObject[key];
            }
          }

          const uniqueKey = `kpm_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`;

          batchData[uniqueKey] = {
            nama: namaVal || `Warga_${idx + 1}`,
            nik: nikVal || "", // Kosong jika tidak ada, sistem tetap aman
            desa: desaVal || "-",
            status_isi: false,
            submission_id: null,
            tgl_update: new Date().toISOString(),
            raw_data: rowObject,
          };
        });

        // Simpan data KPM dan struktur Header ke Firebase RTDB
        await update(ref(database), {
          master_kpm: batchData,
          "settings/master_headers": rawHeaders,
        });

        setHeaders(rawHeaders);
        alert(
          `BERHASIL!\n• Terdeteksi ${rawHeaders.length} Kolom Header: [${rawHeaders.join(", ")}]\n• Total ${Object.keys(batchData).length} Data Warga berhasil disimpan.`
        );
      } catch (err: any) {
        console.error(err);
        alert("Gagal memproses file Excel: " + err.message);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  // 3. EXPORT KEMBALI KE EXCEL SESUAI SEMUA HEADER DINAMIS
  const handleExportExcel = () => {
    if (kpmList.length === 0) {
      alert("Belum ada data untuk diekspor.");
      return;
    }

    const exportRows = kpmList.map((item) => {
      const row: Record<string, any> = { ...item.raw_data };
      row["STATUS_SURVEI"] = item.status_isi ? "SUDAH" : "BELUM";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Target_KPM");
    XLSX.writeFile(wb, "Master_Target_KPM_Dinamis.xlsx");
  };

  // 4. HAPUS & TAMBAH MANUAL
  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (confirm("Hapus data sasaran ini dari database?")) {
      await remove(ref(database, `master_kpm/${id}`));
    }
  };

  const handleResetAll = async () => {
    if (confirm("PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN SELURUH DATA TARGET KPM?")) {
      await remove(ref(database, "master_kpm"));
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRef = push(ref(database, "master_kpm"));

    let namaVal = "";
    let nikVal = "";
    let desaVal = "";

    for (const key of Object.keys(manualData)) {
      const cleanKey = key.toUpperCase();
      if (cleanKey.includes("NAMA") && !namaVal) namaVal = manualData[key];
      if (cleanKey.includes("NIK") && !nikVal) nikVal = manualData[key];
      if (cleanKey.includes("DESA") && !desaVal) desaVal = manualData[key];
    }

    await set(newRef, {
      nama: namaVal || manualData[headers[0]] || "Warga",
      nik: nikVal || "",
      desa: desaVal || "-",
      status_isi: false,
      raw_data: manualData,
      tgl_update: new Date().toISOString(),
    });

    setShowAddModal(false);
    setManualData({});
  };

  // Filter Pencarian di Tabel
  const filteredList = kpmList.filter((kpm) => {
    const q = searchQuery.toLowerCase();
    const matchBasic =
      kpm.nama.toLowerCase().includes(q) ||
      kpm.nik.toLowerCase().includes(q) ||
      kpm.desa.toLowerCase().includes(q);

    const matchRaw = Object.values(kpm.raw_data || {}).some((val) =>
      String(val).toLowerCase().includes(q)
    );

    return matchBasic || matchRaw;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-900 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Master Data KPM (Dinamis)</h2>
              <p className="text-xs text-slate-500">
                Sistem membaca struktur header Excel secara otomatis tanpa batasan format
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Tombol Upload Excel Dinamis */}
          <label className="cursor-pointer flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{uploading ? "Membaca Header..." : "Import Excel Dinamis"}</span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          {/* Tombol Export */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {/* Tombol Tambah Manual */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Header Info Tag & Pencarian */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Header Aktif:
          </span>
          {headers.map((h) => (
            <span
              key={h}
              className="px-2.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg font-mono text-[11px] font-semibold"
            >
              {h}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari data (Nama, NIK, Desa, dsb)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {kpmList.length > 0 && (
            <button
              onClick={handleResetAll}
              className="text-[11px] font-bold text-red-600 hover:text-red-800 underline flex items-center gap-1 self-end sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Target KPM</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabel Tampilan Dinamis Berdasarkan Header Excel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-10 text-center">No</th>
                {/* Render Header Kolom Dinamis TANPA BATAS (Menghapus .slice(0,6) yang ada sebelumnya) */}
                {headers.map((h) => (
                  <th key={h} className="p-3 min-w-[120px]">
                    {h}
                  </th>
                ))}
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 3} className="p-8 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada data target KPM</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Klik <strong>"Import Excel Dinamis"</strong> untuk memasukkan file database Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>

                    {/* Render Nilai Sel Sesuai Header TANPA BATAS */}
                    {headers.map((h) => {
                      const val = item.raw_data?.[h] || (h.toUpperCase().includes("NIK") ? item.nik : item.nama);
                      return (
                        <td key={h} className="p-3 font-medium text-slate-800">
                          {val ? (
                            h.toUpperCase().includes("NIK") ? (
                              <span className="font-mono text-blue-900 font-semibold">{val}</span>
                            ) : (
                              val
                            )
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="p-3 text-center">
                      {item.status_isi ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Sudah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Belum
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => setSelectedKpm(item)}
                        className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        title="Buka Seluruh Kolom"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* Modal Detail Seluruh Kolom KPM */}
      {selectedKpm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase">Detail Lengkap Data</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedKpm.nama}</h3>
              </div>
              <button onClick={() => setSelectedKpm(null)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {Object.keys(selectedKpm.raw_data || {}).map((key) => (
                <div key={key} className="py-2 flex justify-between gap-4">
                  <span className="font-semibold text-slate-500 w-1/3">{key}</span>
                  <span className="font-bold text-slate-800 text-right w-2/3 break-words">
                    {selectedKpm.raw_data[key] || <span className="text-slate-300 italic">Kosong</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-right pt-3 border-t">
              <button
                onClick={() => setSelectedKpm(null)}
                className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Manual Satuan Dinamis */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Tambah Data Warga Manual</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-3 text-xs">
              {headers.map((h) => (
                <div key={h}>
                  <label className="block font-bold text-slate-700 mb-1">{h}:</label>
                  <input
                    type="text"
                    placeholder={`Masukkan ${h}...`}
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none font-medium"
                    value={manualData[h] || ""}
                    onChange={(e) => setManualData({ ...manualData, [h]: e.target.value })}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-xl"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}