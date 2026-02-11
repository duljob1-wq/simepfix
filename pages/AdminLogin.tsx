
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { getSettings } from '../services/storageService';

export const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        const settings = await getSettings();
        
        // Check for Superadmin
        if (password === (settings.superAdminPassword || 'supersimep')) {
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('isSuperAdmin', 'true'); // NEW
            navigate('/admin/dashboard');
            return;
        }

        // Check for Regular Admin
        if (password === (settings.adminPassword || '12345')) {
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('isSuperAdmin', 'false'); // Explicitly false
            navigate('/admin/dashboard');
            return;
        }

        // Failed
        setError(true);
        setTimeout(() => setError(false), 2000);
    } catch (err) {
        console.error("Login error", err);
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 mb-4 shadow-sm relative group">
            <Lock size={28} className="group-hover:opacity-0 transition-opacity absolute" />
            <ShieldCheck size={28} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Admin Portal</h2>
          <p className="text-slate-500 mt-2">Masuk untuk mengelola pelatihan</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password Akses</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-4 focus:outline-none transition-all duration-200 ${
                error 
                  ? 'border-red-300 focus:ring-red-100 text-red-900' 
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
              placeholder="••••••"
              autoFocus
              disabled={loading}
            />
            {error && <p className="mt-2 text-xs text-red-500 font-medium">Password salah, silakan coba lagi.</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all duration-200 flex items-center justify-center group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Memeriksa...' : 'Masuk Dashboard'}
            {!loading && <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-100">
          <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
            Kembali ke Halaman Depan
          </button>
        </div>
      </div>
    </div>
  );
};
