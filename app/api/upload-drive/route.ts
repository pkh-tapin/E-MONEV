import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Menerima kiriman FormData dari aplikasi (kamera/galeri HP)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string || "FOTO_UMUM";
    const nik = formData.get("nik") as string || "NONIK";
    const nama = formData.get("nama") as string || "WARGA";

    // Pengecekan apakah file benar-benar terbawa
    if (!file) {
      return NextResponse.json(
        { error: "File foto gagal diterima oleh server aplikasi." },
        { status: 400 }
      );
    }

    // 2. Memanggil URL Google Apps Script dari variabel Vercel (.env)
    const gasUrl = process.env.GAS_URL;
    if (!gasUrl || gasUrl.trim() === "") {
      return NextResponse.json(
        { error: "Konfigurasi Vercel: Variabel GAS_URL belum diatur atau kosong." },
        { status: 500 }
      );
    }

    // 3. Konversi format file fisik menjadi Base64 (Syarat mutlak Google Apps Script)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64String = buffer.toString("base64");

    // 4. Merapikan nama file agar tersusun cantik di Google Drive
    // Contoh hasil: 631520010_FOTO_RUMAH_KPM_SITI_MAISAROH.jpg
    const safeNama = nama.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const ext = file.name.split('.').pop() || 'jpg';
    const finalFileName = `${nik}_${category.toUpperCase()}_${safeNama}.${ext}`;

    // 5. Meneruskan data ke Google Apps Script
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        // Menggunakan text/plain agar Google Apps Script tidak menolak request
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        base64: base64String,
        fileName: finalFileName,
        mimeType: file.type || "image/jpeg",
      }),
    });

    // 6. Membaca jawaban dari Google Drive
    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "Google Apps Script menolak penyimpanan file." },
        { status: 500 }
      );
    }

    // 7. Berhasil! Kembalikan link gambar ke aplikasi
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("API Upload Error Terdeteksi:", error);
    return NextResponse.json(
      { error: `Sistem Error: ${error.message}` },
      { status: 500 }
    );
  }
}
