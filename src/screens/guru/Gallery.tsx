import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Image as ImageIcon, Upload, Trash2, Camera, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  classId: string;
  createdAt: any;
  teacherId: string;
  storagePath: string;
}

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function GalleryGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1' : (userData?.assigned_class || 'Kelas 1')
  );

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'gallery'),
      where('classId', '==', selectedClass),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryPhoto)));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedClass]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData) return;

    // Optional: add a caption prompt
    const caption = prompt('Masukkan keterangan foto (opsional):') || '';

    setIsUploading(true);
    setUploadProgress(10);
    try {
      const storagePath = `gallery/${selectedClass}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      setUploadProgress(40);
      await uploadBytes(storageRef, file);
      
      setUploadProgress(80);
      const url = await getDownloadURL(storageRef);
      
      await addDoc(collection(db, 'gallery'), {
        url,
        caption,
        classId: selectedClass,
        createdAt: new Date(),
        teacherId: userData.uid,
        storagePath
      });
      
      setUploadProgress(100);
      alert('Foto berhasil diunggah!');
    } catch (error) {
      console.error(error);
      alert('Gagal mengunggah foto.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    
    try {
      // 1. Delete from Storage
      if (photo.storagePath) {
        const storageRef = ref(storage, photo.storagePath);
        await deleteObject(storageRef);
      }
      
      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'gallery', photo.id));
      alert('Foto dihapus.');
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus foto.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Galeri Kegiatan</h1>
          <p className="text-sm text-slate-500 mt-1">Bagikan momen kegiatan kelas kepada Wali Murid.</p>
        </div>
        
        <div className="flex items-center space-x-3 flex-wrap sm:flex-nowrap gap-y-2">
          {isAdmin && (
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm mr-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
              >
                {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isUploading ? `Mengunggah...` : 'Unggah Foto'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            Memuat galeri...
          </div>
        ) : photos.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-100 flex flex-col items-center">
            <ImageIcon className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Belum Ada Foto</h3>
            <p className="text-sm text-slate-500 mt-1">Mulai bagikan momen kegiatan kelas Anda.</p>
          </div>
        ) : (
          photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group relative">
              <div className="aspect-square bg-slate-100 relative">
                <img 
                  src={photo.url} 
                  alt={photo.caption} 
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-2 right-2 p-2 bg-white/90 text-red-600 hover:bg-red-600 hover:text-white rounded-xl shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-slate-800 line-clamp-2">
                  {photo.caption || 'Tanpa keterangan'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {photo.createdAt?.toDate ? format(photo.createdAt.toDate(), 'dd MMM yyyy', { locale: id }) : 'Baru saja'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
