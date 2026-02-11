
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, Home, Lock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getSettings, saveGuestEntry } from '../services/storageService';

export const GuestLogin: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
        const settings = await getSettings();
        setIsOpen(!!settings.isGuestBookOpen);
        setLoading(false);
    };
    init();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !institution) return;

    // Save entry
    saveGuestEntry({
        id: uuidv4(),
        name,
        institution,
        timestamp: Date.now()
    });

    // Set session
    sessionStorage.setItem('isGuest', 'true');
    sessionStorage.setItem('guestName', name);
    sessionStorage.setItem('guestInst', institution);
    
    navigate('/guest/dashboard');
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="max-w-md w-full bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-4 shadow-sm">
            <BookOpen size={28} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Buku Tamu</h2>
          <p className="text-slate-500 mt-2 text-sm">Masuk untuk melihat laporan evaluasi</p>
        </div>

        {isOpen ? (
            <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 focus:outline-none transition-all"
                placeholder="Nama Anda"
                required
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asal Instansi</label>
                <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 focus:outline-none transition-all"
                placeholder="Instansi Anda"
                required
                />
            </div>

            <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center group mt-6"
            >
                Masuk
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
            </form>
        ) : (
            <div className="text-center bg-red-50 border border-red-100 rounded-xl p-6">
                <Lock size={32} className="mx-auto text-red-400 mb-3" />
                <h3 className="font-bold text-red-800 mb-1">Akses Ditutup</h3>
                <p className="text-xs text-red-600">Mohon maaf, buku tamu saat ini sedang dikunci oleh Administrator.</p>
            </div>
        )}

        <div className="mt-8 text-center pt-6 border-t border-slate-100">
          <button onClick={() => navigate('/')} className="flex items-center justify-center gap-2 w-full text-sm text-slate-400 hover:text-emerald-600 transition-colors">
            <Home size={14} /> Kembali ke Halaman Depan
          </button>
        </div>
      </div>
    </div>
  );
};
