import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bell, Plus, Trash2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: any;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      setLoading(false);
    }, (err) => {
      console.warn("Announcements snapshot error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        content,
        date: serverTimestamp()
      });
      showToast('Pengumuman berhasil ditambahkan!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setContent('');
    } catch (error) {
      console.error(error);
      showToast('Gagal menambahkan pengumuman.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (annId: string) => {
    
    try {
      await deleteDoc(doc(db, 'announcements', annId));
      showToast('Pengumuman dihapus.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menghapus pengumuman.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengumuman</h1>
          <p className="text-sm text-slate-500 mt-1">Buat informasi yang akan disiarkan ke dashboard Guru dan Wali Murid.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengumuman Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-100">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            Memuat pengumuman...
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-100 flex flex-col items-center justify-center">
            <Bell className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Belum Ada Pengumuman</h3>
            <p className="text-sm mt-1">Gunakan tombol di atas untuk membuat pengumuman pertama.</p>
          </div>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow group">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-slate-800">{ann.title}</h3>
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Hapus Pengumuman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-3 mt-1">
                  {ann.date?.toDate ? format(ann.date.toDate(), 'EEEE, dd MMMM yyyy - HH:mm WIB', { locale: id }) : 'Baru saja'}
                </p>
                <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl leading-relaxed">
                  {ann.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Buat Pengumuman Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800"
                  placeholder="Misal: Libur Nasional Semester Ganjil"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Isi Pengumuman</label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-800 leading-relaxed"
                  placeholder="Tulis detail informasi di sini..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-colors font-bold text-sm shadow-sm disabled:opacity-50"
                >
                  <span>{saving ? 'Menyimpan...' : 'Terbitkan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center space-x-3 px-5 py-3.5 rounded-2xl shadow-xl text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
