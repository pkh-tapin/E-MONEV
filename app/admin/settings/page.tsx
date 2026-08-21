"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [folderId, setFolderId] = useState("1oc1xZvHTbXKwB16w6PHTVP3437w6TZkg");
  const [appName, setAppName] = useState("Portal Survei Lapangan BANSOS & PKH Tapin");
  const [formOpen, setFormOpen] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Konfigurasi tersimpan!");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Pengaturan Sistem</h2>
        <p className="text-xs text-slate-500">Konfigurasi integrasi Google Drive dan status akses formulir</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Judul Aplikasi</label>
          <input
            type="text"
            className="w-full p-2.5 border rounded-xl text-xs bg-slate-50"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Target Google Drive Folder ID</label>
          <input
            type="text"
            className="w-full p-2.5 border rounded-xl text-xs font-mono bg-slate-50"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="formOpenToggle"
            checked={formOpen}
            onChange={(e) => setFormOpen(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="formOpenToggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Buka penerimaan formulir survei publik
          </label>
        </div>

        <div className="pt-4">
          <button type="submit" className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-900 text-white font-bold rounded-xl text-xs">
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
