export interface KPM {
  id?: string;
  nik: string;
  nama: string;
  desa: string;
  kecamatan?: string;
  alamat?: string;
  status_isi: boolean;
  submission_id?: string | null;
  tgl_update?: string;
}

export interface DriveUploadedFile {
  fileId: string;
  fileName: string;
  viewUrl: string;
  directUrl: string;
}

export interface SurveySubmission {
  id?: string;
  kpm_id: string;
  nik: string;
  nama: string;
  desa: string;
  tgl_survei: string;
  geolokasi: {
    lat: number | null;
    lng: number | null;
    akurasi: number | null;
    waktu: string;
  };
  berkas_drive: {
    foto_pegang_kks?: DriveUploadedFile;
    foto_kpm_seluruh_tubuh?: DriveUploadedFile;
    foto_rumah_kpm?: DriveUploadedFile;
    foto_usaha_kpm?: DriveUploadedFile;
  };
  jawaban: Record<string, any>;
  status: string;
}

export interface VillageStat {
  desa: string;
  total: number;
  sudah: number;
  belum: number;
  persentase: number;
}
