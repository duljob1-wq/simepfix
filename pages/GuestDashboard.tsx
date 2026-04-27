import React, { useEffect, useState, useRef } from 'react';
import { getTrainings, getResponses } from '../services/storageService';
import { exportToPDF, exportToExcel, exportToWord } from '../services/exportService';
import { Training } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, FileText, ChevronDown, Printer, FileIcon, FileSpreadsheet, Calendar, BookOpen, Search, LayoutDashboard, Users, RotateCcw, Eye, Archive, Clock, CheckCircle } from 'lucide-react';

export const GuestDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'management' | 'reports'>('management');
  
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  
  // Filters
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [guestInfo, setGuestInfo] = useState({ name: '', inst: '' });

  useEffect(() => {
    if (sessionStorage.getItem('isGuest') !== 'true') {
        navigate('/guest');
        return;
    }
    setGuestInfo({
        name: sessionStorage.getItem('guestName') || 'Tamu',
        inst: sessionStorage.getItem('guestInst') || '-'
    });
    
    const init = async () => {
        const fetchedTrainings = await getTrainings();
        setTrainings(fetchedTrainings);

        const counts: Record<string, number> = {};
        await Promise.all(fetchedTrainings.map(async (t) => {
            const res = await getResponses(t.id);
            counts[t.id] = res.length;
        }));
        setResponseCounts(counts);
    };
    init();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('isGuest');
    sessionStorage.removeItem('guestName');
    sessionStorage.removeItem('guestInst');
    navigate('/guest');
  };

  const handlePrint = async (type: 'pdf'|'excel'|'word', t: Training) => {
      try {
          if (type === 'pdf') await exportToPDF(t);
          if (type === 'excel') await exportToExcel(t);
          if (type === 'word') await exportToWord(t);
          setExportDropdownId(null);
      } catch (error) {
          console.error("Print error:", error);
          alert(`Gagal mencetak dokumen ${type.toUpperCase()}. Pastikan data tersedia.`);
      }
  };

  const resetFilters = () => {
      setSearch('');
      setFilterDateStart('');
      setFilterDateEnd('');
      setFilterMethod('');
      setFilterLocation('');
  };

  const formatDateID = (dateStr: string) => { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

  // --- HELPER: GET STATUS (Ongoing vs Finished) ---
  const getTrainingStatus = (t: Training) => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr < t.startDate) {
          return 'upcoming';
      } else if (todayStr > t.endDate) {
          return 'finished';
      } else {
          return 'ongoing';
      }
  };

  const filteredTrainings = trainings.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
      let matchDate = true;
      if (filterDateStart && filterDateEnd) {
          matchDate = (t.startDate <= filterDateEnd) && (t.endDate >= filterDateStart);
      }
      const matchMethod = filterMethod ? t.learningMethod === filterMethod : true;
      const matchLocation = filterLocation ? t.location === filterLocation : true;
      
      return matchSearch && matchDate && matchMethod && matchLocation;
  }).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <nav className="bg-emerald-800 text-white sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-white"><BookOpen size={18}/></div>
                      <div className="flex flex-col"><span className="font-bold text-lg text-white leading-none">SIMEP <span className="text-emerald-300">Tamu</span></span></div>
                  </div>
                  
                  {/* Navigation Tabs */}
                  <div className="flex space-x-2 bg-emerald-900/50 p-1 rounded-lg">
                      <button onClick={() => setActiveTab('management')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all text-sm font-medium ${activeTab === 'management' ? 'bg-white text-emerald-800 shadow' : 'text-emerald-100 hover:bg-emerald-700'}`}>
                          <LayoutDashboard size={16}/> Manajemen
                      </button>
                      <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all text-sm font-medium ${activeTab === 'reports' ? 'bg-white text-emerald-800 shadow' : 'text-emerald-100 hover:bg-emerald-700'}`}>
                          <FileText size={16}/> Laporan
                      </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:block text-right"><div className="text-sm font-bold">{guestInfo.name}</div><div className="text-xs text-emerald-300">{guestInfo.inst}</div></div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-emerald-100 hover:text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition"><LogOut size={18} /> <span className="hidden sm:inline">Keluar</span></button>
                  </div>
              </div>
          </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col">
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">{activeTab === 'management' ? 'Manajemen Pelatihan' : 'Laporan Evaluasi'}</h2>
                <p className="text-slate-500 text-sm">{activeTab === 'management' ? 'Daftar pelatihan aktif (Mode Lihat).' : 'Akses dan cetak laporan hasil evaluasi.'}</p>
            </div>
         </div>

         {/* Shared Filter Bar */}
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari Pelatihan</label>
                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama pelatihan..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" /></div>
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
                    <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hingga Tanggal</label>
                    <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Metode</label>
                    <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"><option value="">Semua</option><option value="Klasikal">Klasikal</option><option value="Blended">Blended</option><option value="Daring Learning">Daring</option></select>
                </div>
                <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Kampus</label>
                    <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"><option value="">Semua</option><option value="Surabaya">SBY</option><option value="Malang">MLG</option><option value="Madiun">MDN</option></select>
                </div>
                <div className="md:col-span-1">
                    <button onClick={resetFilters} className="p-2 text-slate-400 hover:text-red-500 w-full flex justify-center items-center h-[38px] border border-transparent hover:border-red-100 rounded-lg bg-slate-50 hover:bg-red-50"><RotateCcw size={18}/></button>
                </div>
            </div>
         </div>

         {/* CONTENT: MANAGEMENT (GRID) */}
         {activeTab === 'management' && (
             <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in">
                {filteredTrainings.length > 0 ? (
                    filteredTrainings.map(t => {
                        const status = getTrainingStatus(t);
                        return (
                        <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1.5 rounded-bl-xl border-l border-b border-slate-200"><span className="text-emerald-600 font-mono font-bold text-sm">{t.accessCode}</span></div>
                            <div className="p-6 pt-10 flex-1">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2" title={t.title}>{t.title}</h3>
                                
                                {/* STATUS BADGE */}
                                <div className="mb-3">
                                    {status === 'ongoing' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse">
                                            <span className="relative flex h-2 w-2">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            Sedang Berlangsung
                                        </span>
                                    )}
                                    {status === 'finished' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                                            <Archive size={12}/> Selesai
                                        </span>
                                    )}
                                    {status === 'upcoming' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
                                            <Clock size={12}/> Akan Datang
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 mt-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-2"><Calendar size={14} /> <span>{new Date(t.startDate).toLocaleDateString('id-ID')}</span></div>
                                    <div className="flex items-center gap-2"><Users size={14} /> <span>{t.facilitators.length} Fasilitator</span></div>
                                    {(t.learningMethod || t.location) && (<div className="flex flex-wrap gap-1 mt-2">{t.learningMethod && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{t.learningMethod}</span>}{t.location && <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.location}</span>}</div>)}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center">
                                {/* GUEST RESTRICTION: Only Show Eye Icon */}
                                <Link to={`/admin/results/${t.id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-50 hover:border-emerald-200 transition" title="Lihat Hasil Detail">
                                    <Eye size={16}/> Lihat Detail
                                </Link>
                            </div>
                        </div>
                    );})
                ) : (
                    <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-300">Tidak ada data pelatihan yang sesuai filter.</div>
                )}
             </div>
         )}

         {/* CONTENT: REPORTS (TABLE) */}
         {activeTab === 'reports' && (
            <div className="bg-white rounded-2xl shadow-sm border animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr><th className="px-6 py-4 font-semibold text-slate-700">Judul Pelatihan & Periode</th><th className="px-6 py-4 font-semibold text-slate-700">Responden</th><th className="px-6 py-4 text-right font-semibold text-slate-700">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTrainings.length > 0 ? (filteredTrainings.map(t => {
                                    const status = getTrainingStatus(t);
                                    return (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 text-sm mb-1">{t.title}</div>
                                            {/* STATUS BADGE IN TABLE */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded"><Calendar size={12}/><span>{formatDateID(t.startDate)} - {formatDateID(t.endDate)}</span></div>
                                                
                                                {status === 'ongoing' && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
                                                        Berlangsung
                                                    </span>
                                                )}
                                                {status === 'finished' && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                                                        <CheckCircle size={10}/> Selesai
                                                    </span>
                                                )}
                                                {status === 'upcoming' && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
                                                        <Clock size={10}/> Akan Datang
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold">{responseCounts[t.id] || 0} Respon</span></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <Link to={`/admin/results/${t.id}`} className="text-emerald-600 font-bold hover:underline text-xs md:text-sm">Buka Hasil</Link>
                                                <div className="relative" ref={exportDropdownId === t.id ? dropdownRef : null}>
                                                    <button onClick={() => setExportDropdownId(exportDropdownId === t.id ? null : t.id)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition"><Printer size={16}/> Cetak <ChevronDown size={14} /></button>
                                                    {exportDropdownId === t.id && (
                                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden text-left animate-in fade-in zoom-in-95">
                                                            <button onClick={() => handlePrint('pdf', t)} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 cursor-pointer">
                                                                <div className="w-8 h-8 bg-red-100 text-red-600 flex items-center justify-center rounded"><FileIcon size={16}/></div> PDF
                                                            </button>
                                                            <button onClick={() => handlePrint('excel', t)} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 cursor-pointer">
                                                                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded"><FileSpreadsheet size={16}/></div> Excel
                                                            </button>
                                                            <button onClick={() => handlePrint('word', t)} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3 cursor-pointer">
                                                                <div className="w-8 h-8 bg-blue-100 text-blue-600 flex items-center justify-center rounded"><FileText size={16}/></div> Word
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })) : (<tr><td colSpan={3} className="text-center py-12 text-slate-400 italic">Tidak ada data pelatihan yang sesuai filter.</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
         )}
         
         <div className="mt-auto py-4 text-right">
            <span className="text-[10px] text-slate-300 font-light italic">created by DulHid V2.3</span>
         </div>
      </main>
    </div>
  );
};