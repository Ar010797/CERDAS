import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Folder, Plus, Trash2, ChevronRight, FileText, ArrowLeft, MoreVertical, Upload } from 'lucide-react';

interface QuestionFolder {
  id: string;
  name: string;
  teacherId: string;
  createdAt: string;
}

interface Question {
  id: string;
  folderId: string;
  text: string;
  type: 'Pilihan Ganda' | 'Uraian';
  options?: string[]; // For Pilihan Ganda (A, B, C, D)
  correctAnswer?: string;
}

export default function QuestionBank() {
  const { userData } = useAuth();
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // States for folder management
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // States for active folder
  const [activeFolder, setActiveFolder] = useState<QuestionFolder | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // States for question management
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<'Pilihan Ganda' | 'Uraian'>('Pilihan Ganda');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [newCorrectAnswer, setNewCorrectAnswer] = useState('0');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, type: 'folder' | 'question', targetId: string | null }>({
    isOpen: false,
    type: 'folder',
    targetId: null
  });

  useEffect(() => {
    if (!userData?.uid) return;
    
    // Admin can see all folders, Guru sees only theirs
    const q = userData.role === 'Admin' 
      ? query(collection(db, 'question_folders'))
      : query(collection(db, 'question_folders'), where('teacherId', '==', userData.uid));

    const unsub = onSnapshot(q, (snap) => {
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuestionFolder)));
      setLoading(false);
    });
    return () => unsub();
  }, [userData]);

  useEffect(() => {
    if (!activeFolder) return;
    const q = query(collection(db, 'questions'), where('folderId', '==', activeFolder.id));
    const unsub = onSnapshot(q, (snap) => {
      setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
    });
    return () => unsub();
  }, [activeFolder]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !userData) return;

    try {
      await addDoc(collection(db, 'question_folders'), {
        name: newFolderName,
        teacherId: userData.uid,
        createdAt: new Date().toISOString()
      });
      setIsFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat folder');
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setDeleteModal({ isOpen: true, type: 'folder', targetId: folderId });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFolder) return;

    // Optional: allow only docs/pdfs
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
      alert("Hanya mendukung file PDF atau Word/Text");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-questions", {
        method: "POST",
        body: formData,
      });
      const extractedQuestions = await res.json();
      
      if (res.ok && Array.isArray(extractedQuestions)) {
        // save each question to firebase
        for (const q of extractedQuestions) {
          const questionData: any = {
            folderId: activeFolder.id,
            text: q.text,
            type: q.type === 'Pilihan Ganda' ? 'Pilihan Ganda' : 'Uraian',
          };
          
          if (q.type === 'Pilihan Ganda') {
            questionData.options = q.options || ['', '', '', ''];
            questionData.correctAnswer = q.correctAnswer || '';
          }
          await addDoc(collection(db, 'questions'), questionData);
        }
        alert(`Berhasil mengimpor ${extractedQuestions.length} soal.`);
      } else {
        alert(extractedQuestions.error || "Gagal mengekstrak soal dari file.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !activeFolder) return;

    try {
      const questionData: any = {
        folderId: activeFolder.id,
        text: newQuestionText,
        type: newQuestionType,
      };

      if (newQuestionType === 'Pilihan Ganda') {
        questionData.options = newOptions;
        questionData.correctAnswer = newOptions[parseInt(newCorrectAnswer)];
      }

      await addDoc(collection(db, 'questions'), questionData);
      setIsQuestionModalOpen(false);
      setNewQuestionText('');
      setNewOptions(['', '', '', '']);
      setNewCorrectAnswer('0');
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan soal');
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    setDeleteModal({ isOpen: true, type: 'question', targetId: questionId });
  };

  const executeDelete = async () => {
    if (!deleteModal.targetId) return;
    
    try {
      if (deleteModal.type === 'folder') {
        const qSnapshot = await getDocs(query(collection(db, 'questions'), where('folderId', '==', deleteModal.targetId)));
        const batch = writeBatch(db);
        qSnapshot.docs.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, 'question_folders', deleteModal.targetId));
        await batch.commit();
        
        if (activeFolder?.id === deleteModal.targetId) setActiveFolder(null);
      } else {
        await deleteDoc(doc(db, 'questions', deleteModal.targetId));
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus data');
    } finally {
      setDeleteModal({ isOpen: false, type: 'folder', targetId: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bank Soal</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola soal PTS, PAS, dan PAT per mata pelajaran</p>
        </div>
        {!activeFolder && (
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Folder Baru</span>
          </button>
        )}
      </div>

      {!activeFolder ? (
        /* Folders View */
        loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : folders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Belum ada Folder</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
              Buat folder baru untuk mengelompokkan soal berdasarkan mata pelajaran dan tahun ajaran agar rapi.
            </p>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Folder Baru</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map(folder => (
              <div 
                key={folder.id}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col h-full"
                onClick={() => setActiveFolder(folder)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Folder className="w-6 h-6 fill-indigo-200 text-indigo-600" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                    className="flex items-center space-x-1.5 px-2 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
                <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight">{folder.name}</h3>
                <div className="mt-auto pt-4 flex items-center text-xs font-medium text-indigo-600">
                  <span>Buka Folder</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Questions View (Inside Folder) */
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <button 
              onClick={() => setActiveFolder(null)}
              className="p-2 hover:bg-slate-200 rounded-xl transition-colors bg-slate-100 text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Folder className="w-5 h-5 text-indigo-500 fill-indigo-100" />
              {activeFolder.name}
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800">Daftar Soal</h3>
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl transition-colors font-semibold text-sm cursor-pointer disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Memproses AI...' : 'Import Word/PDF'}</span>
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,text/plain" onChange={handleFileUpload} disabled={isUploading} />
                </label>
                <button
                  onClick={() => setIsQuestionModalOpen(true)}
                  className="flex items-center space-x-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-xl transition-colors font-semibold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Soal</span>
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Belum ada soal di folder ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-5 border border-slate-100 rounded-2xl bg-slate-50 hover:bg-white transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded">Soal {idx + 1}</span>
                          <span className="bg-slate-200 text-slate-600 text-xs font-medium px-2 py-0.5 rounded">{q.type}</span>
                        </div>
                        <p className="font-medium text-slate-800 whitespace-pre-wrap">{q.text}</p>
                        
                        {q.type === 'Pilihan Ganda' && q.options && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options.map((opt, i) => {
                              const labels = ['A', 'B', 'C', 'D'];
                              const isCorrect = q.correctAnswer === opt;
                              return (
                                <div key={i} className={`flex items-start p-2 rounded-lg text-sm border ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium' : 'border-slate-200 bg-white text-slate-600'}`}>
                                  <span className="font-bold mr-2">{labels[i]}.</span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="flex items-center space-x-1.5 p-2 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors opacity-100 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Hapus Soal</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Buat Folder Soal</h3>
            <form onSubmit={handleCreateFolder}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama Folder</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Matematika Kelas 1 - PAT 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
                >
                  Buat Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Question Modal */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Tambah Soal Baru</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-5">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipe Soal</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {(['Pilihan Ganda', 'Uraian'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewQuestionType(t)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                        newQuestionType === t 
                          ? 'bg-white text-indigo-700 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pertanyaan</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ketik pertanyaan di sini..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {newQuestionType === 'Pilihan Ganda' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Pilihan Jawaban</label>
                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map((label, index) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm shrink-0">
                          {label}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder={`Pilihan ${label}`}
                          value={newOptions[index]}
                          onChange={(e) => {
                            const newOpts = [...newOptions];
                            newOpts[index] = e.target.value;
                            setNewOptions(newOpts);
                          }}
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        />
                        <div className="flex items-center gap-2 ml-2">
                          <input 
                            type="radio" 
                            name="correctAnswer" 
                            id={`opt-${index}`}
                            checked={newCorrectAnswer === String(index)}
                            onChange={() => setNewCorrectAnswer(String(index))}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <label htmlFor={`opt-${index}`} className="text-xs font-medium text-slate-500 cursor-pointer">Benar</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
                >
                  Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Hapus</h3>
            <p className="text-slate-600 text-sm mb-6">
              {deleteModal.type === 'folder' 
                ? 'Yakin ingin menghapus folder ini? Semua soal di dalamnya juga akan terhapus.' 
                : 'Yakin ingin menghapus soal ini?'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, type: 'folder', targetId: null })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
