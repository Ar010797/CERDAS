import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Wallet, Coins, ArrowUpRight, ArrowDownRight, Plus, Trash2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Student {
  id: string;
  name: string;
  absen_number: string;
}

interface SavingTransaction {
  id: string;
  studentId: string;
  amount: number;
  type: 'setor' | 'tarik';
  date: any;
  note: string;
}

interface KasTransaction {
  id: string;
  amount: number;
  type: 'masuk' | 'keluar';
  date: any;
  note: string;
  classId: string;
}

const CLASSES_LIST = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9'];

export default function FinanceGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'Admin';
  
  const [selectedClass, setSelectedClass] = useState(
    isAdmin ? 'Kelas 1' : (userData?.assigned_class || 'Kelas 1')
  );

  const [activeTab, setActiveTab] = useState<'tabungan' | 'kas'>('tabungan');
  
  // Tabungan State
  const [students, setStudents] = useState<Student[]>([]);
  const [savingTransactions, setSavingTransactions] = useState<SavingTransaction[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  
  // Kas State
  const [kasTransactions, setKasTransactions] = useState<KasTransaction[]>([]);
  
  // Forms
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [transactionType, setTransactionType] = useState<'setor' | 'tarik'>('setor'); // or masuk/keluar for Kas
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch students
    const fetchStudents = async () => {
      const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      data.sort((a, b) => (parseInt(a.absen_number) || 0) - (parseInt(b.absen_number) || 0));
      setStudents(data);
      if (data.length > 0 && !selectedStudent) {
        setSelectedStudent(data[0].id);
      }
    };
    fetchStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (activeTab === 'tabungan' && selectedStudent) {
      const q = query(
        collection(db, 'savings'),
        where('studentId', '==', selectedStudent),
        orderBy('date', 'desc')
      );
      const unsub = onSnapshot(q, (snap) => {
        setSavingTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingTransaction)));
      });
      return () => unsub();
    } else if (activeTab === 'kas') {
      const q = query(
        collection(db, 'kas'),
        where('classId', '==', selectedClass),
        orderBy('date', 'desc')
      );
      const unsub = onSnapshot(q, (snap) => {
        setKasTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as KasTransaction)));
      });
      return () => unsub();
    }
  }, [activeTab, selectedStudent, selectedClass]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    
    setIsSubmitting(true);
    try {
      if (activeTab === 'tabungan') {
        await addDoc(collection(db, 'savings'), {
          studentId: selectedStudent,
          classId: selectedClass, // to help with parent queries later if needed
          amount: Number(amount),
          type: transactionType,
          date: serverTimestamp(),
          note: note || (transactionType === 'setor' ? 'Setoran Tabungan' : 'Penarikan Tabungan')
        });
      } else {
        await addDoc(collection(db, 'kas'), {
          classId: selectedClass,
          amount: Number(amount),
          type: transactionType === 'setor' ? 'masuk' : 'keluar',
          date: serverTimestamp(),
          note: note || (transactionType === 'setor' ? 'Pemasukan Kas' : 'Pengeluaran Kas')
        });
      }
      setAmount('');
      setNote('');
      alert('Transaksi berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSaving = async (id: string) => {
    
    await deleteDoc(doc(db, 'savings', id));
  };
  
  const handleDeleteKas = async (id: string) => {
    
    await deleteDoc(doc(db, 'kas', id));
  };

  // Calculations
  const tabunganBalance = savingTransactions.reduce((acc, curr) => {
    return curr.type === 'setor' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const kasBalance = kasTransactions.reduce((acc, curr) => {
    return curr.type === 'masuk' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Keuangan Kelas</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola Tabungan Siswa dan Uang Kas Kelas.</p>
        </div>
        
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
      </div>

      <div className="flex space-x-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tabungan')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'tabungan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Tabungan Siswa
        </button>
        <button
          onClick={() => setActiveTab('kas')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'kas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Kas Kelas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Input Transaksi Baru</h2>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              
              {activeTab === 'tabungan' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Siswa</label>
                  <select
                    required
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  >
                    <option value="" disabled>-- Pilih Siswa --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransactionType('setor')}
                    className={`py-2 rounded-xl text-sm font-bold border transition-colors flex items-center justify-center gap-2 ${
                      transactionType === 'setor' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    {activeTab === 'tabungan' ? 'Setor' : 'Pemasukan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('tarik')}
                    className={`py-2 rounded-xl text-sm font-bold border transition-colors flex items-center justify-center gap-2 ${
                      transactionType === 'tarik' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    {activeTab === 'tabungan' ? 'Tarik' : 'Pengeluaran'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 10000"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Tabungan mingguan"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (activeTab === 'tabungan' && !selectedStudent)}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl transition-colors font-bold text-sm shadow-sm disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Simpan Transaksi</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-2xl ${activeTab === 'tabungan' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {activeTab === 'tabungan' ? <Wallet className="w-8 h-8" /> : <Coins className="w-8 h-8" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">
                  {activeTab === 'tabungan' ? `Total Saldo ${students.find(s => s.id === selectedStudent)?.name || ''}` : `Total Kas ${selectedClass}`}
                </p>
                <h3 className="text-3xl font-bold text-slate-800">
                  Rp {activeTab === 'tabungan' ? tabunganBalance.toLocaleString('id-ID') : kasBalance.toLocaleString('id-ID')}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Riwayat Transaksi</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-sm text-slate-500">
                    <th className="px-6 py-4 font-medium">Tanggal</th>
                    <th className="px-6 py-4 font-medium">Keterangan</th>
                    <th className="px-6 py-4 font-medium">Masuk</th>
                    <th className="px-6 py-4 font-medium">Keluar</th>
                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'tabungan' ? (
                    savingTransactions.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Belum ada riwayat transaksi.</td></tr>
                    ) : (
                      savingTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">
                            {trx.date?.toDate ? format(trx.date.toDate(), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{trx.note}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">{trx.type === 'setor' ? `Rp ${trx.amount.toLocaleString('id-ID')}` : '-'}</td>
                          <td className="px-6 py-4 text-sm font-bold text-red-600">{trx.type === 'tarik' ? `Rp ${trx.amount.toLocaleString('id-ID')}` : '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteSaving(trx.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    kasTransactions.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Belum ada riwayat transaksi.</td></tr>
                    ) : (
                      kasTransactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">
                            {trx.date?.toDate ? format(trx.date.toDate(), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{trx.note}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">{trx.type === 'masuk' ? `Rp ${trx.amount.toLocaleString('id-ID')}` : '-'}</td>
                          <td className="px-6 py-4 text-sm font-bold text-red-600">{trx.type === 'keluar' ? `Rp ${trx.amount.toLocaleString('id-ID')}` : '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteKas(trx.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
