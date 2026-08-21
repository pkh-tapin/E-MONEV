"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import AdminSidebar from "@/components/AdminSidebar";
import { Loader2, Menu, ShieldCheck, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface AdminContextType {
  user: User | null;
}

const AdminContext = createContext<AdminContextType>({ user: null });

// PERBAIKAN: Kata "export" dihapus dari sini agar Vercel tidak error saat Build
const useAdminAuth = () => useContext(AdminContext);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
      } else {
        setUser(currentUser);
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Tutup menu mobile saat berpindah halaman
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Loading hanya muncul SATU KALI saat pertama kali membuka aplikasi
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="flex flex-col items-center gap-3 bg-slate-800/90 border border-slate-700 p-8 rounded-3xl shadow-2xl">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="font-bold text-sm text-slate-200">Menyiapkan Panel Admin PKH...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ user }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 text-slate-900 antialiased">
        {/* Header Mobile (Hanya tampil di Layar Smartphone) */}
        <header className="md:hidden sticky top-0 z-40 bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow">
              PKH
            </div>
            <div>
              <h1 className="font-bold text-sm leading-none">PANEL ADMIN</h1>
              <p className="text-[10px] text-slate-400">Tapin Regency</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
              title="Buka Form Publik"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sidebar Component (Responsif Desktop & Mobile Drawer) */}
        <AdminSidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Konten Halaman Admin */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 overflow-y-auto pb-24 md:pb-8">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}