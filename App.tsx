
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { CreateTraining } from './pages/CreateTraining';
import { RespondentView } from './pages/RespondentView';
import { ResultsView } from './pages/ResultsView';
import { GuestLogin } from './pages/GuestLogin';
import { GuestDashboard } from './pages/GuestDashboard';
import { CommentsView } from './pages/CommentsView';
import { Shield, ArrowRight, Play, QrCode, Hash, Activity, BookOpen } from 'lucide-react';
import { saveTraining, getTrainingByCode } from './services/storageService';
import { Training } from './types';
import LZString from 'lz-string';

// Protected Route Wrapper (Admin Only - Write Access)
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
  return isAdmin ? <>{children}</> : <Navigate to="/admin" replace />;
};

// NEW: Protected Report Route (Admin OR Guest - Read Access)
const ProtectedReportRoute = ({ children }: { children?: React.ReactNode }) => {
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
  const isGuest = sessionStorage.getItem('isGuest') === 'true';
  
  if (isAdmin || isGuest) {
      return <>{children}</>;
  }
  
  // Jika bukan admin dan bukan tamu, lempar ke login tamu
  return <Navigate to="/guest" replace />;
};

// Landing Page (Dual Portal)
const LandingPage = () => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let code = inputCode.trim();
    
    if (!code) {
      setError('Mohon masukkan Kode atau Token.');
      return;
    }

    // CHECK FOR ADMIN SUFFIX
    let isAdminBypass = false;
    if (code.toLowerCase().endsWith('admin')) {
        isAdminBypass = true;
        code = code.slice(0, -5); // Remove 'admin' from the end
    }

    // SCENARIO 1: Short Code (5-6 chars)
    if (code.length <= 6) {
        const training = await getTrainingByCode(code);
        if (training) {
            // Append mode=admin if bypass triggered
            navigate(`/evaluate/${training.id}${isAdminBypass ? '?mode=admin' : ''}`);
        } else {
            setError('Kode tidak ditemukan di perangkat ini. Jika Anda menggunakan perangkat berbeda dengan Admin, mohon gunakan Link Lengkap.');
        }
        return;
    }

    // SCENARIO 2: Long Token (LZString Compressed or Base64)
    try {
      let parsed: any;
      
      // Try Decompressing first (New format)
      const decompressed = LZString.decompressFromEncodedURIComponent(code);
      if (decompressed) {
          parsed = JSON.parse(decompressed);
      } else {
          // Fallback to old Base64
          const decodedJson = decodeURIComponent(escape(atob(code)));
          parsed = JSON.parse(decodedJson);
      }
      
      let trainingData: Training;

      if (parsed && parsed.i && !parsed.id) {
            // Reconstruct Training Object from Minified Data (Manual entry of Minified Token)
            trainingData = {
                id: parsed.i,
                accessCode: parsed.a,
                title: parsed.t,
                startDate: parsed.s,
                endDate: parsed.e,
                processEvaluationDate: parsed.p,
                createdAt: Date.now(), 
                facilitators: parsed.f.map((f: any) => ({ id: f.i, name: f.n, subject: f.s, sessionDate: f.d })),
                facilitatorQuestions: parsed.fq.map((q: any) => ({ id: q.i, label: q.l, type: q.t })),
                processQuestions: parsed.pq.map((q: any) => ({ id: q.i, label: q.l, type: q.t })),
                targets: [],
                reportedTargets: {}
            };
      } else {
          trainingData = parsed as Training;
      }

      if (trainingData && trainingData.id) {
        // Save to local storage so RespondentView can access it
        await saveTraining(trainingData);
        // Navigate
        navigate(`/evaluate/${trainingData.id}${isAdminBypass ? '?mode=admin' : ''}`);
      } else {
        setError('Token data rusak atau tidak valid.');
      }
    } catch (err) {
      console.error(err);
      setError('Format tidak dikenali. Pastikan kode disalin dengan benar.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 py-3 px-6 md:px-12 flex justify-between items-center relative z-20">
        
        {/* Left Side: Brand Stack */}
        <div className="flex items-center gap-3">
            {/* SIMEP Icon */}
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-indigo-100 shadow-lg">S</div>
            
            {/* Text Container */}
            <div className="flex flex-col justify-center">
                <span className="font-extrabold text-slate-800 text-lg leading-none tracking-tight">SIMEP</span>
            </div>
        </div>
        
        {/* Right Side: Login */}
        <div className="flex items-center gap-3">
            <Link to="/guest" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all text-sm font-semibold flex items-center gap-2 group">
              <BookOpen size={16} className="text-emerald-600 group-hover:scale-110 transition-transform"/> <span className="hidden sm:inline">Buku Tamu</span>
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all text-sm font-semibold flex items-center gap-2 group">
              <Shield size={16} className="text-indigo-600 group-hover:scale-110 transition-transform"/> <span className="hidden sm:inline">Admin Login</span>
            </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-7xl mx-auto w-full">
        
        {/* Center Content Wrapper */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full">
            {/* Left: Hero Text */}
            <div className="flex-1 space-y-6 max-w-xl">
            <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wide mb-2">
                SIMEP
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                SIMEP <br/>
                <span className="text-indigo-600 text-2xl md:text-3xl font-bold">(Sistem Informasi Monitoring dan Evaluasi Pelatihan)</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed">
                Platform profesional untuk monitoring dan evaluasi kualitas pelatihan, kinerja fasilitator, dan efektivitas penyelenggaraan secara real-time.
            </p>
            </div>

            {/* Right: Respondent Access Card */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
            <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Hash size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Akses Responden</h3>
                    <p className="text-xs text-slate-500">Masukkan Kode Akses atau Token</p>
                </div>
                </div>

                <form onSubmit={handleAccessSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kode (5 Karakter) atau Token
                    </label>
                    <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className={`w-full px-4 py-4 bg-slate-50 border rounded-xl focus:ring-2 focus:outline-none transition-all text-lg font-mono text-slate-800 placeholder:text-slate-400 ${
                        error ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    placeholder="Contoh: A7X9P"
                    />
                    {error && <p className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1 leading-snug">⚠️ {error}</p>}
                </div>

                <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    Mulai Evaluasi
                    <Play size={18} className="fill-current group-hover:translate-x-1 transition-transform" />
                </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-50 text-center">
                <p className="text-xs text-slate-400">
                    Hubungi panitia jika Anda belum memiliki kode akses.
                </p>
                </div>
            </div>
            </div>
        </div>

      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/guest" element={<GuestLogin />} />
        <Route path="/guest/dashboard" element={<GuestDashboard />} />
        
        <Route path="/admin/dashboard" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/create" element={
          <ProtectedRoute>
            <CreateTraining />
          </ProtectedRoute>
        } />
        <Route path="/admin/edit/:trainingId" element={
          <ProtectedRoute>
            <CreateTraining />
          </ProtectedRoute>
        } />
        
        {/* MODIFIED: Use ProtectedReportRoute instead of ProtectedRoute */}
        <Route path="/admin/results/:trainingId" element={
          <ProtectedReportRoute>
            <ResultsView />
          </ProtectedReportRoute>
        } />

        <Route path="/evaluate/:trainingId" element={<RespondentView />} />
        <Route path="/comments/:trainingId/:facilitatorId" element={<CommentsView />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
