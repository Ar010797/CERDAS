import React, { useState, useRef, useEffect } from 'react';
import { Upload, PenTool, Trash2, CheckCircle2, RotateCcw, Stamp, Eye } from 'lucide-react';

interface DigitalSignatureUploadProps {
  signatureUrl?: string;
  stampUrl?: string;
  principalName?: string;
  principalNip?: string;
  schoolName?: string;
  onSaveSignature: (sigBase64: string | null) => Promise<void>;
  onSaveStamp: (stampBase64: string | null) => Promise<void>;
}

export default function DigitalSignatureUpload({
  signatureUrl,
  stampUrl,
  principalName = 'Nama Kepala Sekolah',
  principalNip = '19XXXXXXXXXXXXXX',
  schoolName = 'Satuan Pendidikan',
  onSaveSignature,
  onSaveStamp
}: DigitalSignatureUploadProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'draw'>('upload');
  const [isDrawing, setIsDrawing] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [savingStamp, setSavingStamp] = useState(false);
  const [hasCanvasDrawn, setHasCanvasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputSigRef = useRef<HTMLInputElement | null>(null);
  const fileInputStampRef = useRef<HTMLInputElement | null>(null);

  // Inisialisasi canvas saat tab menggambar dibuka
  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab]);

  // Penanganan Canvas Menggambar
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasCanvasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasCanvasDrawn(false);
  };

  const saveCanvasSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasCanvasDrawn) return;
    setSavingSig(true);
    try {
      const base64 = canvas.toDataURL('image/png');
      await onSaveSignature(base64);
      clearCanvas();
    } finally {
      setSavingSig(false);
    }
  };

  // Penanganan Upload File Gambar
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'signature' | 'stamp'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file gambar maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (type === 'signature') {
        setSavingSig(true);
        try {
          await onSaveSignature(base64);
        } finally {
          setSavingSig(false);
        }
      } else {
        setSavingStamp(true);
        try {
          await onSaveStamp(base64);
        } finally {
          setSavingStamp(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kiri: Tanda Tangan Digital */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Tanda Tangan Digital Kepala Sekolah
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Otomatis dibubuhkan di Rapor, RPP, Presensi & Pengumuman.
                  </p>
                </div>
              </div>
            </div>

            {/* Pilihan Metode: Unggah vs Gambar Langsung */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File (PNG/JPG)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('draw')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'draw'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Gores Tanda Tangan Layar</span>
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputSigRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleFileChange(e, 'signature')}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputSigRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-indigo-50/30 dark:bg-indigo-950/20 group"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Klik untuk memilih gambar tanda tangan
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Disarankan format <b>PNG transparan</b> tanpa latar belakang (latar bening). Maksimal 2MB.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Gambar di Canvas */}
            {activeTab === 'draw' && (
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950 p-2 overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={180}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[180px] bg-white dark:bg-slate-900 rounded-xl cursor-crosshair touch-none border border-slate-100 dark:border-slate-800"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1.5">
                    <span>✍️ Gunakan jari atau mouse untuk bertanda tangan di atas kotak.</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ulangi / Bersihkan</span>
                  </button>

                  <button
                    type="button"
                    disabled={!hasCanvasDrawn || savingSig}
                    onClick={saveCanvasSignature}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm"
                  >
                    {savingSig ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Tanda Tangan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status & Preview Tanda Tangan Tersimpan */}
          {signatureUrl && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 flex items-center justify-center">
                  <img src={signatureUrl} alt="Tanda Tangan" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tanda Tangan Aktif</span>
                  </span>
                  <p className="text-[11px] text-slate-500">Akan otomatis tercetak pada dokumen</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Hapus tanda tangan digital saat ini?')) {
                    onSaveSignature(null);
                  }
                }}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                title="Hapus Tanda Tangan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Kanan: Stempel Resmi Sekolah */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Stamp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Stempel Resmi Satuan Pendidikan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dibubuhkan otomatis berdampingan dengan tanda tangan pada dokumen resmi.
                </p>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputStampRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => handleFileChange(e, 'stamp')}
              className="hidden"
            />

            <div
              onClick={() => fileInputStampRef.current?.click()}
              className="border-2 border-dashed border-purple-200 dark:border-purple-900/60 hover:border-purple-500 dark:hover:border-purple-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-purple-50/30 dark:bg-purple-950/20 group"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Stamp className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Klik untuk unggah stempel resmi (PNG)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gunakan gambar stempel bulat/oval dengan latar belakang transparan (bening).
              </p>
            </div>
          </div>

          {/* Status & Preview Stempel Tersimpan */}
          {stampUrl && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 flex items-center justify-center">
                  <img src={stampUrl} alt="Stempel Sekolah" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Stempel Resmi Aktif</span>
                  </span>
                  <p className="text-[11px] text-slate-500">Tersinkronisasi ke seluruh dokumen</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Hapus stempel resmi saat ini?')) {
                    onSaveStamp(null);
                  }
                }}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                title="Hapus Stempel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Simulasi Tampilan Akhir pada Dokumen Resmi (Live Document Preview) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Eye className="w-4 h-4 text-indigo-500" />
          <span>Pratinjau Posisi Tanda Tangan & Stempel pada Dokumen PDF (Rapor / RPP / Surat)</span>
        </div>

        <div className="max-w-md mx-auto bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center font-sans">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {schoolName.split(' ')[0] || 'Kotayasa'}, 24 September 2026
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Mengetahui,</p>
          <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">Kepala Sekolah</p>

          <div className="relative h-20 w-48 mx-auto flex items-center justify-center my-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            {/* Stempel semi-overlapping */}
            {stampUrl && (
              <img
                src={stampUrl}
                alt="Stempel"
                className="absolute left-2 w-16 h-16 object-contain opacity-85 pointer-events-none"
              />
            )}

            {/* Tanda Tangan */}
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Tanda Tangan"
                className="max-h-16 max-w-36 object-contain relative z-10"
              />
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                (Tanda tangan belum diunggah)
              </span>
            )}
          </div>

          <p className="text-xs font-bold text-slate-900 dark:text-white underline underline-offset-4">
            {principalName || 'Nama Kepala Sekolah, M.Pd.'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            NIP. {principalNip || '19XXXXXXXXXXXXXX'}
          </p>
        </div>
      </div>
    </div>
  );
}
