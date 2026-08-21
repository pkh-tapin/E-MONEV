import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "DOKUMEN";
    const nik = (formData.get("nik") as string) || "NO_NIK";
    const nama = (formData.get("nama") as string) || "WARGA";

    if (!file) {
      return NextResponse.json({ error: "Berkas foto tidak ditemukan." }, { status: 400 });
    }

    let prefix = "FOTO";
    if (category === "foto_pegang_kks") prefix = "A_FOTO_MEMEGANG_KKS";
    else if (category === "foto_kpm_seluruh_tubuh") prefix = "B_FOTO_KPM_SELURUH_TUBUH";
    else if (category === "foto_rumah_kpm") prefix = "C_FOTO_RUMAH_KPM";
    else if (category === "foto_usaha_kpm") prefix = "D_FOTO_USAHA_KPM";

    const safeName = nama.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    const safeNik = String(nik).replace(/[^0-9]/g, "");
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `${prefix}_${safeNik}_${safeName}.${extension}`;

    const bytes = await file.arrayBuffer();
    const base64String = Buffer.from(bytes).toString("base64");

    const gasUrl = process.env.GOOGLE_SCRIPT_WEBAPP_URL;

    if (!gasUrl) {
      return NextResponse.json({ error: "URL GAS belum ada di .env.local" }, { status: 500 });
    }

    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: fileName,
        mimeType: file.type || "image/jpeg",
        base64: base64String,
      }),
      redirect: "follow",
    });

    const responseText = await gasResponse.text();

    // DETEKTOR ERROR HTML (Akses Ditolak)
    if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
      throw new Error(
        "Akses ke Google Apps Script DITOLAK. Pastikan di pengaturan Deploy, 'Siapa yang memiliki akses (Who has access)' diubah menjadi 'Siapa saja (Anyone)'."
      );
    }

    const result = JSON.parse(responseText);

    if (!result.success) {
      throw new Error(result.error || "Gagal mengunggah foto via Apps Script.");
    }

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      fileName: fileName,
      viewUrl: result.viewUrl,
      directUrl: result.directUrl,
    });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { error: `Upload Gagal: ${error.message}` },
      { status: 500 }
    );
  }
}