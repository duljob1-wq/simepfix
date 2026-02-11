import React, { useEffect, useState, useRef } from 'react';
import { getTrainings, deleteTraining, getResponses, getGlobalQuestions, saveGlobalQuestion, deleteGlobalQuestion, getContacts, saveContact, deleteContact, getSettings, saveSettings, resetApplicationData, saveTraining, exportAllData, importAllData, getThemes, saveTheme, deleteTheme, getGuestEntries, clearGuestEntries } from '../services/storageService';
import { exportToPDF, exportToExcel, exportToWord } from '../services/exportService';
import { Training, GlobalQuestion, QuestionType, Contact, AppSettings, TrainingTheme, Question, GuestEntry } from '../types';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Eye, Share2, LogOut, X, Check, Users, Calendar, Hash, Database, Pencil, LayoutDashboard, FileText, Settings, Search, Contact as ContactIcon, Phone, RotateCcw, Download, FileSpreadsheet, File as FileIcon, Printer, ChevronDown, MessageSquare, Upload, CloudDownload, AlertCircle, Copy as CopyIcon, Link as LinkIcon, Smartphone, List, Save, Layout, Layers, CheckCircle, BookOpen, Lock, Unlock, Shield, Key, Globe, PenTool, Briefcase, MapPin, Building2, User, Clock, Archive, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';
import { QuestionBuilder } from '../components/QuestionBuilder';

type MenuTab = 'management' | 'variables' | 'reports' | 'contacts' | 'guestbook' | 'security';
type SettingsTab = 'training' | 'whatsapp' | 'backup' | 'reset';

const COUNTRY_CODES = [
    { code: 'IDN', dial: '+62', flag: '🇮🇩', label: 'Indonesia' },
    { code: 'MYS', dial: '+60', flag: '🇲🇾', label: 'Malaysia' },
    { code: 'SGP', dial: '+65', flag: '🇸🇬', label: 'Singapore' },
    { code: 'TLS', dial: '+670', flag: '🇹🇱', label: 'Timor Leste' },
    { code: 'BRN', dial: '+673', flag: '🇧🇳', label: 'Brunei' },
    { code: 'OTH', dial: '+', flag: '🌐', label: 'Lainnya' }
];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MenuTab>('management');
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Management State
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [mgmtSearch, setMgmtSearch] = useState('');
  const [mgmtDateStart, setMgmtDateStart] = useState('');
  const [mgmtDateEnd, setMgmtDateEnd] = useState('');
  
  // Management Filters
  const [filterMethod, setFilterMethod] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // Report Filters (New)
  const [reportSearch, setReportSearch] = useState('');
  const [reportDateStart, setReportDateStart] = useState('');
  const [reportDateEnd, setReportDateEnd] = useState('');
  const [reportFilterMethod, setReportFilterMethod] = useState('');
  const [reportFilterLocation, setReportFilterLocation] = useState('');

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAuthInput, setDeleteAuthInput] = useState(''); // New State for Delete Password

  // Variables & Themes State
  const [globalQuestions, setGlobalQuestions] = useState<GlobalQuestion[]>([]);
  const [themes, setThemes] = useState<TrainingTheme[]>([]);
  const [newQVar, setNewQVar] = useState<{label: string, type: QuestionType, category: 'facilitator'|'process', isDefault: boolean}>({
      label: '', type: 'star', category: 'facilitator', isDefault: true
  });
  const [activeTheme, setActiveTheme] = useState<TrainingTheme | null>(null); // For editing/creating
  const [isEditingTheme, setIsEditingTheme] = useState(false); // Mode toggle
  const [variableSubTab, setVariableSubTab] = useState<'bank'|'themes'>('themes');

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<Contact>({ id: '', name: '', whatsapp: '', jobTitle: '', unit: '', address: '' });
  const [contactSearch, setContactSearch] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('IDN'); // Default IDN
  const contactFileInputRef = useRef<HTMLInputElement>(null);
  
  // Contact Detail/Edit Modal State
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false); // Toggle in Add Form

  // Guest Book State
  const [guestEntries, setGuestEntries] = useState<GuestEntry[]>([]);

  // Reports State
  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null); 
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureConfig, setSignatureConfig] = useState({ title: '', name: '', nip: '' });

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ shortUrl: string; fullUrl: string; title: string; accessCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'code'>('link');

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('training');
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  
  // Security State (Superadmin)
  const [securitySettings, setSecuritySettings] = useState<{admin: string, super: string, delete: string}>({admin: '', super: '', delete: ''});
  const [showSecurityPass, setShowSecurityPass] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check role
    const isSuper = sessionStorage.getItem('isSuperAdmin') === 'true';
    setIsSuperAdmin(isSuper);

    refreshData();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshData = async () => {
    const fetchedTrainings = await getTrainings();
    setTrainings(fetchedTrainings);

    // Fetch response counts asynchronously
    const counts: Record<string, number> = {};
    await Promise.all(fetchedTrainings.map(async (t) => {
        const res = await getResponses(t.id);
        counts[t.id] = res.length;
    }));
    setResponseCounts(counts);

    setGlobalQuestions(await getGlobalQuestions());
    setThemes(await getThemes());
    setContacts(await getContacts());
    
    const settings = await getSettings();
    setAppSettings(settings);
    setSecuritySettings({
        admin: settings.adminPassword || '12345',
        super: settings.superAdminPassword || 'supersimep',
        delete: settings.deletePassword || 'adm123'
    });
    setSignatureConfig({
        title: settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan',
        name: settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.',
        nip: settings.signatureNIP || '19710124 199703 1 004'
    });

    setGuestEntries(await getGuestEntries());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('isSuperAdmin');
    navigate('/admin');
  };

  // ... (Other handlers same as before) ...
  const executeDelete = async () => {
    if (!deleteTargetId) return;
    const requiredPass = appSettings.deletePassword || 'adm123';
    if (deleteAuthInput !== requiredPass) { alert("Kode otorisasi (Sandi) salah!"); return; }
    setIsDeleting(true);
    try {
      await deleteTraining(deleteTargetId);
      await refreshData();
      setDeleteTargetId(null);
      setDeleteAuthInput(''); 
    } catch (err) { alert('Gagal menghapus data.'); } finally { setIsDeleting(false); }
  };

  const handleCopyTraining = async (source: Training) => {
    const copiedTraining: Training = { ...source, id: uuidv4(), accessCode: Math.random().toString(36).substring(2, 7).toUpperCase(), title: `${source.title} (Salinan)`, createdAt: Date.now(), reportedTargets: {} };
    await saveTraining(copiedTraining);
    refreshData();
  };

  const handleSaveVariable = async () => { if(!newQVar.label) return; await saveGlobalQuestion({ id: uuidv4(), label: newQVar.label, type: newQVar.type, category: newQVar.category, isDefault: newQVar.isDefault }); setNewQVar({ ...newQVar, label: '' }); refreshData(); };
  const handleUpdateGlobalType = async (q: GlobalQuestion, newType: QuestionType) => { await saveGlobalQuestion({ ...q, type: newType }); refreshData(); };
  const handleCreateTheme = () => { setActiveTheme({ id: uuidv4(), name: '', facilitatorQuestions: [], processQuestions: [] }); setIsEditingTheme(true); };
  const handleEditTheme = (theme: TrainingTheme) => { setActiveTheme({ ...theme }); setIsEditingTheme(true); };
  
  // NEW: Handle Copy Theme with Auto-Increment Name
  const handleCopyTheme = async (sourceTheme: TrainingTheme) => {
      let counter = 1;
      let newName = `${sourceTheme.name} (Salinan ${counter})`;
      
      // Auto-increment name if already exists
      while (themes.some(t => t.name === newName)) {
          counter++;
          newName = `${sourceTheme.name} (Salinan ${counter})`;
      }

      // Deep Copy Questions with NEW IDs to prevent reference issues
      const newFacilitatorQuestions = sourceTheme.facilitatorQuestions.map(q => ({...q, id: uuidv4()}));
      const newProcessQuestions = sourceTheme.processQuestions.map(q => ({...q, id: uuidv4()}));

      const newTheme: TrainingTheme = {
          id: uuidv4(),
          name: newName,
          facilitatorQuestions: newFacilitatorQuestions,
          processQuestions: newProcessQuestions
      };

      await saveTheme(newTheme);
      refreshData();
  };

  const handleSaveTheme = async () => { if (activeTheme && activeTheme.name) { await saveTheme(activeTheme); setActiveTheme(null); setIsEditingTheme(false); refreshData(); } else { alert("Nama tema tidak boleh kosong"); } };
  const handleDeleteTheme = async (id: string) => { if(confirm("Hapus tema ini?")) { await deleteTheme(id); refreshData(); } };
  
  // UPDATED: Save Contact with Phone Number Formatting and Extra Fields
  const handleSaveContact = async () => { 
      if(!newContact.name) return; 
      
      let finalWa = newContact.whatsapp.trim();
      
      // Auto-format: Clean spaces
      finalWa = finalWa.replace(/[\s-]/g, '');
      
      // Convert +62 or 62 to 0 for local display preference
      if (finalWa.startsWith('+62')) {
          finalWa = '0' + finalWa.substring(3);
      } else if (finalWa.startsWith('62')) {
          finalWa = '0' + finalWa.substring(2);
      }

      const contactToSave: Contact = {
          id: uuidv4(),
          name: newContact.name,
          whatsapp: finalWa,
          jobTitle: newContact.jobTitle,
          unit: newContact.unit,
          address: newContact.address
      };

      await saveContact(contactToSave); 
      setNewContact({ id: '', name: '', whatsapp: '', jobTitle: '', unit: '', address: '' }); 
      setShowExtraFields(false); // Reset toggle
      refreshData(); 
  };

  const handleUpdateContact = async () => {
      if (!selectedContact || !selectedContact.name) return;
      
      let finalWa = selectedContact.whatsapp.trim();
      finalWa = finalWa.replace(/[\s-]/g, '');
      
      // Convert +62 or 62 to 0 for local display preference
      if (finalWa.startsWith('+62')) {
          finalWa = '0' + finalWa.substring(3);
      } else if (finalWa.startsWith('62')) {
          finalWa = '0' + finalWa.substring(2);
      }

      await saveContact({ ...selectedContact, whatsapp: finalWa });
      setShowContactModal(false);
      setSelectedContact(null);
      refreshData();
  };

  const openContactDetail = (c: Contact) => {
      setSelectedContact({ ...c }); // Clone object
      setShowContactModal(true);
  };

  const handleDeleteContact = async (c: Contact) => { if (confirm(`Hapus "${c.name}"?`)) { await deleteContact(c.id); refreshData(); } };
  const handleExportContacts = () => { 
      const dataToExport = contacts.map(c => ({ 
          'Nama': c.name, 
          'WhatsApp': c.whatsapp,
          'Jabatan': c.jobTitle || '-',
          'Unit Kerja': c.unit || '-',
          'Alamat': c.address || '-'
      })); 
      const wb = XLSX.utils.book_new(); 
      const ws = XLSX.utils.json_to_sheet(dataToExport); 
      XLSX.utils.book_append_sheet(wb, ws, "Daftar Kontak"); 
      XLSX.writeFile(wb, "Kontak_Fasilitator_SIMEP.xlsx"); 
  };
  
  const handleImportContacts = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (evt) => { try { const wb = XLSX.read(evt.target?.result, { type: 'binary' }); const ws = wb.Sheets[wb.SheetNames[0]]; const data = XLSX.utils.sheet_to_json(ws); for (const row of (data as any[])) { await saveContact({ id: uuidv4(), name: String(row['Nama']||row['nama']||''), whatsapp: String(row['WhatsApp']||''), jobTitle: String(row['Jabatan']||row['jabatan']||''), unit: String(row['Unit Kerja']||row['unit']||''), address: String(row['Alamat']||row['alamat']||'') }); } alert(`Impor Sukses.`); refreshData(); } catch (err) { alert("Gagal impor."); } }; reader.readAsBinaryString(file); if (contactFileInputRef.current) contactFileInputRef.current.value = ''; };
  const handleToggleGuestBook = async () => { const updated = { ...appSettings, isGuestBookOpen: !appSettings.isGuestBookOpen }; await saveSettings(updated); setAppSettings(updated); };
  const handleClearGuestBook = async () => { if(confirm("Hapus riwayat?")) { await clearGuestEntries(); refreshData(); } };
  const handleSaveSettings = async () => { await saveSettings(appSettings); setShowSettingsModal(false); refreshData(); };
  const handleSaveSecurity = async () => { const updated = { ...appSettings, adminPassword: securitySettings.admin, superAdminPassword: securitySettings.super, deletePassword: securitySettings.delete }; await saveSettings(updated); setAppSettings(updated); alert('Tersimpan.'); };
  const handleResetApplication = async () => { if (confirm('Reset Data?')) { await resetApplicationData(); refreshData(); setShowSettingsModal(false); navigate('/admin'); } };

  // --- Signature Handler ---
  const handleSaveSignature = async () => {
    const updated = {
        ...appSettings,
        signatureTitle: signatureConfig.title,
        signatureName: signatureConfig.name,
        signatureNIP: signatureConfig.nip
    };
    await saveSettings(updated);
    setAppSettings(updated);
    setShowSignatureModal(false);
  };

  // --- Printing Handlers (Async with Error Handling) ---
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

  // Handler for Country Selection
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value;
      setSelectedCountryCode(code);
      const country = COUNTRY_CODES.find(c => c.code === code);
      if (country) {
          // Replace content with new dial code
          setNewContact({...newContact, whatsapp: country.dial});
      }
  };

  // Auto-detect country when typing
  const handleWaInput = (val: string) => {
      setNewContact({...newContact, whatsapp: val});
      
      // Basic Auto Detection Logic
      // 1. Check if starts with IDN patterns (08, 62, +62)
      if (val.startsWith('08') || val.startsWith('62') || val.startsWith('+62')) {
          setSelectedCountryCode('IDN');
          return;
      }
      
      // 2. Check other country codes
      const detected = COUNTRY_CODES.find(c => {
          const dialNoPlus = c.dial.replace('+', '');
          return val.startsWith(c.dial) || val.startsWith(dialNoPlus);
      });

      if (detected) {
          setSelectedCountryCode(detected.code);
      }
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

  const filteredMgmtTrainings = trainings.filter(t => { const matchSearch = t.title.toLowerCase().includes(mgmtSearch.toLowerCase()); let matchDate = true; if (mgmtDateStart && mgmtDateEnd) { matchDate = (t.startDate <= mgmtDateEnd) && (t.endDate >= mgmtDateStart); } const matchMethod = filterMethod ? t.learningMethod === filterMethod : true; const matchLocation = filterLocation ? t.location === filterLocation : true; return matchSearch && matchDate && matchMethod && matchLocation; }).sort((a, b) => b.createdAt - a.createdAt);
  const filteredReportTrainings = trainings.filter(t => { const matchSearch = t.title.toLowerCase().includes(reportSearch.toLowerCase()); let matchDate = true; if (reportDateStart && reportDateEnd) { matchDate = (t.startDate <= reportDateEnd) && (t.endDate >= reportDateStart); } const matchMethod = reportFilterMethod ? t.learningMethod === reportFilterMethod : true; const matchLocation = reportFilterLocation ? t.location === reportFilterLocation : true; return matchSearch && matchDate && matchMethod && matchLocation; }).sort((a, b) => b.createdAt - a.createdAt);
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.whatsapp.includes(contactSearch)).sort((a, b) => a.name.localeCompare(b.name));

  const openShareModal = (training: Training) => { const origin = window.location.origin; const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin; const cleanUrl = `${baseUrl}/#/evaluate/${training.id}`; setShareData({ shortUrl: cleanUrl, fullUrl: cleanUrl, title: training.title, accessCode: training.accessCode || 'N/A' }); setCopied(false); setShareTab('link'); setShowShareModal(true); };
  const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {} };
  const isDuplicateName = newContact.name.length > 2 && contacts.some(c => c.name.toLowerCase().includes(newContact.name.toLowerCase()));
  const isDuplicatePhone = newContact.whatsapp.length > 4 && contacts.some(c => c.whatsapp.replace(/[^0-9]/g, '') === newContact.whatsapp.replace(/[^0-9]/g, ''));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <nav className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
          {/* ... Navbar content unchanged ... */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${isSuperAdmin ? 'bg-amber-500' : 'bg-indigo-500'}`}>S</div>
                      <div className="flex flex-col"><span className="font-bold text-lg text-white leading-none">SIMEP <span className={isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}>{isSuperAdmin ? 'Super' : 'Admin'}</span></span></div>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto mx-4">
                      {(['management', 'variables', 'contacts', 'reports', 'guestbook'] as MenuTab[]).map((tab) => (
                          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                              {tab === 'management' && <LayoutDashboard size={18}/>}
                              {tab === 'variables' && <Database size={18}/>}
                              {tab === 'contacts' && <ContactIcon size={18}/>}
                              {tab === 'reports' && <FileText size={18}/>}
                              {tab === 'guestbook' && <BookOpen size={18}/>}
                              <span className="capitalize">{tab === 'management' ? 'Manajemen' : tab === 'variables' ? 'Variabel' : tab === 'contacts' ? 'Kontak' : tab === 'reports' ? 'Laporan' : 'Buku Tamu'}</span>
                          </button>
                      ))}
                      {isSuperAdmin && (<button onClick={() => setActiveTab('security')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'security' ? 'bg-amber-600 text-white' : 'text-amber-300 hover:bg-slate-800 border border-amber-900/30'}`}><Shield size={18}/><span>Pengaturan Akses</span></button>)}
                  </div>
                  <div className="flex items-center gap-1"><button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><Settings size={20} /></button><button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-slate-800"><LogOut size={18} /></button></div>
              </div>
          </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col">
        {/* ... Management Tab ... */}
        {activeTab === 'management' && (
            <div className="animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4"><div><h2 className="text-2xl font-bold text-slate-800">Manajemen Pelatihan</h2><p className="text-slate-500 text-sm">Kelola daftar pelatihan aktif anda.</p></div><Link to="/admin/create" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 font-medium"><Plus size={18} /> Buat Baru</Link></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4 relative"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cari Pelatihan</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" value={mgmtSearch} onChange={e => setMgmtSearch(e.target.value)} placeholder="Nama pelatihan..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" /></div></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label><input type="date" value={mgmtDateStart} onChange={e => setMgmtDateStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Hingga Tanggal</label><input type="date" value={mgmtDateEnd} onChange={e => setMgmtDateEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Metode</label><select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"><option value="">Semua</option><option value="Klasikal">Klasikal</option><option value="Blended">Blended</option><option value="Daring Learning">Daring</option></select></div>
                        <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Kampus</label><select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"><option value="">Semua</option><option value="Surabaya">SBY</option><option value="Malang">MLG</option><option value="Madiun">MDN</option></select></div>
                        <div className="md:col-span-1"><button onClick={() => {setMgmtSearch(''); setMgmtDateStart(''); setMgmtDateEnd(''); setFilterMethod(''); setFilterLocation('');}} className="p-2 text-slate-400 hover:text-red-500 w-full flex justify-center items-center h-full border border-transparent hover:border-red-100 rounded-lg"><RotateCcw size={20}/></button></div>
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMgmtTrainings.map(t => {
                        const status = getTrainingStatus(t);
                        return (
                        <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1.5 rounded-bl-xl border-l border-b border-slate-200"><span className="text-indigo-600 font-mono font-bold text-sm">{t.accessCode}</span></div>
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

                                <div className="space-y-2 text-sm text-slate-500">
                                    <div className="flex items-center gap-2"><Calendar size={14} /> <span>{new Date(t.startDate).toLocaleDateString('id-ID')}</span></div>
                                    <div className="flex items-center gap-2"><Users size={14} /> <span>{t.facilitators.length} Fasilitator</span></div>
                                    {(t.learningMethod || t.location) && (<div className="flex flex-wrap gap-1 mt-2">{t.learningMethod && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{t.learningMethod}</span>}{t.location && <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.location}</span>}</div>)}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <button onClick={() => openShareModal(t)} className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:text-indigo-800"><Share2 size={16}/> Bagikan</button>
                                <div className="flex gap-1"><Link to={`/admin/results/${t.id}`} className="p-2 text-slate-400 hover:text-indigo-600 transition"><Eye size={18}/></Link><button onClick={() => handleCopyTraining(t)} className="p-2 text-slate-400 hover:text-blue-600 transition"><CopyIcon size={18}/></button><Link to={`/admin/edit/${t.id}`} className="p-2 text-slate-400 hover:text-amber-600 transition"><Pencil size={18}/></Link><button onClick={() => { setDeleteTargetId(t.id); setDeleteAuthInput(''); }} className="p-2 text-slate-400 hover:text-red-600 transition"><Trash2 size={18}/></button></div>
                            </div>
                        </div>
                    );})}
                </div>
            </div>
        )}

        {/* VARIABLES TAB */}
        {activeTab === 'variables' && (
            <div className="animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Variabel Pelatihan</h2>
                        <p className="text-slate-500 text-sm">Kelola tema dan paket pertanyaan evaluasi.</p>
                    </div>
                </div>
                
                <div className="flex gap-3 mb-6">
                    <button onClick={() => setVariableSubTab('themes')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${variableSubTab === 'themes' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <List size={18}/> Tema Pelatihan
                    </button>
                    <button onClick={() => setVariableSubTab('bank')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${variableSubTab === 'bank' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <Database size={18}/> Bank Pertanyaan Global
                    </button>
                </div>

                {variableSubTab === 'themes' && (
                    isEditingTheme && activeTheme ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <h3 className="text-lg font-bold text-slate-800">{activeTheme.id ? 'Edit Tema' : 'Buat Tema Baru'}</h3>
                                <button onClick={() => { setIsEditingTheme(false); setActiveTheme(null); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nama Tema</label>
                                <input type="text" value={activeTheme.name} onChange={e => setActiveTheme({...activeTheme, name: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg" placeholder="Contoh: Pelatihan Teknis..." />
                            </div>
                            <div className="grid md:grid-cols-2 gap-8">
                                <QuestionBuilder title="Pertanyaan Fasilitator" questions={activeTheme.facilitatorQuestions} onChange={(qs) => setActiveTheme({...activeTheme, facilitatorQuestions: qs})} />
                                <QuestionBuilder title="Pertanyaan Penyelenggaraan" questions={activeTheme.processQuestions} onChange={(qs) => setActiveTheme({...activeTheme, processQuestions: qs})} />
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button onClick={() => { setIsEditingTheme(false); setActiveTheme(null); }} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50">Batal</button>
                                <button onClick={handleSaveTheme} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2"><Save size={18}/> Simpan Tema</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <button onClick={handleCreateTheme} className="w-full py-4 border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-2xl text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-100 hover:border-indigo-300 transition-all mb-6">
                                <Plus size={20}/> Buat Tema Variabel Baru
                            </button>
                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {themes.map(t => (
                                    <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-slate-800 text-lg">{t.name}</h3>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleEditTheme(t)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Pencil size={16}/></button>
                                                <button onClick={() => handleCopyTheme(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Duplikat"><CopyIcon size={16}/></button>
                                                <button onClick={() => handleDeleteTheme(t.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><User size={16}/></div>
                                                <span>{t.facilitatorQuestions.length} Variabel Fasilitator</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg"><Layout size={16}/></div>
                                                <span>{t.processQuestions.length} Variabel Penyelenggaraan</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}

                {variableSubTab === 'bank' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        {['facilitator', 'process'].map((cat) => (
                            <div key={cat} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className={`px-6 py-4 border-b border-slate-100 font-bold uppercase tracking-wide flex items-center gap-2 ${cat === 'facilitator' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}`}>
                                    {cat === 'facilitator' ? <User size={18}/> : <Layout size={18}/>} Bank {cat === 'facilitator' ? 'Fasilitator' : 'Penyelenggaraan'}
                                </div>
                                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                    <div className="flex gap-2">
                                        <input type="text" value={newQVar.category === cat ? newQVar.label : ''} onChange={e => setNewQVar({ ...newQVar, category: cat as any, label: e.target.value })} placeholder="Tambah variabel baru..." className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onKeyDown={e => e.key === 'Enter' && handleSaveVariable()} />
                                        <select value={newQVar.category === cat ? newQVar.type : 'star'} onChange={e => setNewQVar({ ...newQVar, category: cat as any, type: e.target.value as QuestionType })} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                                            <option value="star">★</option><option value="slider">⸺</option><option value="text">¶</option>
                                        </select>
                                        <button onClick={handleSaveVariable} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-black"><Plus size={18}/></button>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                    {globalQuestions.filter(q => q.category === cat).map(q => (
                                        <div key={q.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 group">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${q.type === 'star' ? 'bg-yellow-100 text-yellow-700' : q.type === 'slider' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>{q.type === 'star' ? 'Star' : q.type === 'slider' ? '0-100' : 'Teks'}</span>
                                                <span className="text-sm font-medium text-slate-700">{q.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="relative group/type">
                                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"><Settings size={14}/></button>
                                                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-10 hidden group-hover/type:block">
                                                        <button onClick={() => handleUpdateGlobalType(q, 'star')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">Ubah ke Bintang</button>
                                                        <button onClick={() => handleUpdateGlobalType(q, 'slider')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">Ubah ke Skala</button>
                                                        <button onClick={() => handleUpdateGlobalType(q, 'text')} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">Ubah ke Teks</button>
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteGlobalQuestion(q.id).then(refreshData)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white border border-slate-200 hover:bg-red-50"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {globalQuestions.filter(q => q.category === cat).length === 0 && <div className="p-6 text-center text-slate-400 italic text-sm">Belum ada variabel.</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === 'contacts' && (
            <div className="animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Database Kontak</h2>
                        <p className="text-slate-500 text-sm">Kelola daftar kontak fasilitator dan penanggung jawab.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportContacts} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 text-sm flex items-center gap-2"><Download size={16}/> Export Excel</button>
                        <button onClick={() => contactFileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 text-sm flex items-center gap-2"><Upload size={16}/> Import Excel</button>
                        <input type="file" ref={contactFileInputRef} onChange={handleImportContacts} className="hidden" accept=".xlsx, .xls" />
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    {/* Add Contact Form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-24">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UserPlus size={18} className="text-indigo-600"/> Tambah Kontak Baru</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap & Gelar</label>
                                <input type="text" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Dr. Fulan, S.Kom..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                                <div className="flex gap-2 mb-2">
                                    <select value={selectedCountryCode} onChange={handleCountryChange} className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-slate-50 font-medium w-32">
                                        {COUNTRY_CODES.map(c => (<option key={c.code} value={c.code}>{c.flag} {c.dial}</option>))}
                                    </select>
                                    <input type="text" value={newContact.whatsapp} onChange={e => handleWaInput(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="08..." />
                                </div>
                            </div>
                            
                            <button onClick={() => setShowExtraFields(!showExtraFields)} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                {showExtraFields ? <ChevronDown size={14} className="rotate-180"/> : <ChevronDown size={14}/>} {showExtraFields ? 'Sembunyikan Detail' : 'Tampilkan Detail Lainnya'}
                            </button>

                            {showExtraFields && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-2">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jabatan</label><input type="text" value={newContact.jobTitle || ''} onChange={e => setNewContact({...newContact, jobTitle: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Widyaiswara..." /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Kerja</label><input type="text" value={newContact.unit || ''} onChange={e => setNewContact({...newContact, unit: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Bapelkes..." /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Alamat</label><textarea value={newContact.address || ''} onChange={e => setNewContact({...newContact, address: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none h-16" placeholder="Jl..." /></div>
                                </div>
                            )}

                            <button onClick={handleSaveContact} disabled={!newContact.name} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 mt-2 disabled:bg-slate-300 disabled:shadow-none transition-all">Simpan Kontak</button>
                        </div>
                    </div>

                    {/* Contact List */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Cari nama atau nomor..." className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm" />
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
                                {filteredContacts.length === 0 && <div className="p-8 text-center text-slate-400 italic">Tidak ada kontak ditemukan.</div>}
                                {filteredContacts.map(c => (
                                    <div key={c.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm">{c.name.charAt(0)}</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{c.name}</h4>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5">
                                                    {c.whatsapp && <span className="text-xs text-green-600 font-mono flex items-center gap-1"><Smartphone size={12}/> {c.whatsapp}</span>}
                                                    {c.unit && <span className="text-xs text-slate-500 flex items-center gap-1"><Building2 size={12}/> {c.unit}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openContactDetail(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit Detail"><Pencil size={16}/></button>
                                            <button onClick={() => handleDeleteContact(c)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center font-medium">Total: {filteredContacts.length} Kontak</div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Reports Tab */}
        {activeTab === 'reports' && (
             <div className="animate-in fade-in duration-300 space-y-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Laporan Akhir</h2>
                    <button onClick={() => setShowSignatureModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-indigo-400 transition shadow-sm">
                        <PenTool size={16} /> Konfigurasi TTD
                    </button>
                </div>
                {/* ... Reports Filter (Unchanged) ... */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4 relative"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari Pelatihan</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/><input type="text" value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Nama pelatihan..." className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs" /></div></div>
                        <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label><input type="date" value={reportDateStart} onChange={e => setReportDateStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" /></div>
                        <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hingga Tanggal</label><input type="date" value={reportDateEnd} onChange={e => setReportDateEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" /></div>
                        <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Metode</label><select value={reportFilterMethod} onChange={e => setReportFilterMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"><option value="">Semua</option><option value="Klasikal">Klasikal</option><option value="Blended">Blended</option><option value="Daring Learning">Daring</option></select></div>
                        <div className="md:col-span-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Kampus</label><select value={reportFilterLocation} onChange={e => setReportFilterLocation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"><option value="">Semua</option><option value="Surabaya">SBY</option><option value="Malang">MLG</option><option value="Madiun">MDN</option></select></div>
                        <div className="md:col-span-1"><button onClick={() => {setReportSearch(''); setReportDateStart(''); setReportDateEnd(''); setReportFilterMethod(''); setReportFilterLocation('');}} className="p-1.5 text-slate-400 hover:text-red-500 w-full flex justify-center items-center h-[30px] border border-transparent hover:border-red-100 rounded-lg bg-slate-50 hover:bg-red-50"><RotateCcw size={16}/></button></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr><th className="px-6 py-4 font-semibold text-slate-700 first:rounded-tl-2xl">Judul Pelatihan & Periode</th><th className="px-6 py-4 font-semibold text-slate-700">Responden</th><th className="px-6 py-4 text-right font-semibold text-slate-700 last:rounded-tr-2xl">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReportTrainings.map(t => {
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
                                    <td className="px-6 py-4"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">{responseCounts[t.id] || 0} Respon</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <Link to={`/admin/results/${t.id}`} className="text-indigo-600 font-bold hover:underline">Buka Hasil</Link>
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
                            );})}
                            {filteredReportTrainings.length === 0 && (<tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">Tidak ada data pelatihan yang sesuai filter.</td></tr>)}
                        </tbody>
                    </table>
                </div>
             </div>
        )}
        {/* ... Guestbook & Security (Existing) ... */}
        {activeTab === 'guestbook' && (<div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><h2 className="text-2xl font-bold text-slate-800">Buku Tamu</h2><p className="text-slate-500 text-sm">Riwayat akses tamu ke menu laporan.</p></div><div className="flex items-center gap-3"><button onClick={handleToggleGuestBook} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition shadow-sm ${appSettings.isGuestBookOpen ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'}`}>{appSettings.isGuestBookOpen ? <Unlock size={18}/> : <Lock size={18}/>}{appSettings.isGuestBookOpen ? 'Akses Tamu DIBUKA' : 'Akses Tamu DITUTUP'}</button><button onClick={handleClearGuestBook} className="p-2.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-xl hover:bg-red-50"><Trash2 size={18}/></button></div></div><div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-6 py-4 font-semibold text-slate-700">Waktu Akses</th><th className="px-6 py-4 font-semibold text-slate-700">Nama Tamu</th><th className="px-6 py-4 font-semibold text-slate-700">Instansi</th></tr></thead><tbody className="divide-y divide-slate-100">{guestEntries.length > 0 ? (guestEntries.map(g => (<tr key={g.id} className="hover:bg-slate-50/50"><td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(g.timestamp).toLocaleString('id-ID')}</td><td className="px-6 py-4 font-bold text-slate-800">{g.name}</td><td className="px-6 py-4 text-slate-600">{g.institution}</td></tr>))) : (<tr><td colSpan={3} className="text-center py-8 text-slate-400 italic">Belum ada riwayat tamu.</td></tr>)}</tbody></table></div></div>)}
        {activeTab === 'security' && isSuperAdmin && (<div className="animate-in fade-in duration-300 max-w-2xl mx-auto space-y-6"><div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Shield className="text-amber-500"/> Pengaturan Akses & Keamanan</h2><p className="text-slate-500 text-sm">Kelola password login dan kode otorisasi sistem.</p></div><div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6"><div className="space-y-4"><div><label className="block text-sm font-bold text-slate-700 mb-1">Password Admin (Reguler)</label><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" value={securitySettings.admin} onChange={e => setSecuritySettings({...securitySettings, admin: e.target.value})} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"/></div><p className="text-[10px] text-slate-400 mt-1">Digunakan untuk login sehari-hari. Default: 12345</p></div><div><label className="block text-sm font-bold text-amber-700 mb-1">Password Superadmin</label><div className="relative"><Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18}/><input type={showSecurityPass ? "text" : "password"} value={securitySettings.super} onChange={e => setSecuritySettings({...securitySettings, super: e.target.value})} className="w-full pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"/></div><p className="text-[10px] text-slate-400 mt-1">Digunakan untuk akses menu ini. Default: supersimep</p></div><div className="pt-2 border-t border-slate-100"><label className="block text-sm font-bold text-red-700 mb-1">Kode Otorisasi Hapus Data</label><div className="relative"><Trash2 className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={18}/><input type={showSecurityPass ? "text" : "password"} value={securitySettings.delete} onChange={e => setSecuritySettings({...securitySettings, delete: e.target.value})} className="w-full pl-10 pr-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-red-50"/></div><p className="text-[10px] text-slate-400 mt-1">Diminta saat menghapus data sensitif. Default: adm123</p></div></div><div className="flex items-center justify-between pt-4"><label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none"><input type="checkbox" checked={showSecurityPass} onChange={e => setShowSecurityPass(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500"/>Tampilkan Karakter</label><button onClick={handleSaveSecurity} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"><Save size={18}/> Simpan Perubahan</button></div></div></div>)}
        
        {/* ADDED: FOOTER */}
        <div className="mt-auto py-4 text-right">
            <span className="text-[10px] text-slate-300 font-light italic">created by DulHid V2.3</span>
        </div>
      </main>

      {/* Signature Configuration Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><PenTool size={18} className="text-indigo-600"/> Konfigurasi TTD</h3>
                    <button onClick={() => setShowSignatureModal(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-500 mb-4">Pengaturan ini akan diterapkan pada bagian tanda tangan di semua file laporan (PDF, Excel, Word).</p>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Jabatan Penandatangan</label>
                        <input type="text" value={signatureConfig.title} onChange={e => setSignatureConfig({...signatureConfig, title: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Kepala Seksi..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Pejabat</label>
                        <input type="text" value={signatureConfig.name} onChange={e => setSignatureConfig({...signatureConfig, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nama Lengkap & Gelar" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIP</label>
                        <input type="text" value={signatureConfig.nip} onChange={e => setSignatureConfig({...signatureConfig, nip: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="19xxxx..." />
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setShowSignatureModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">Batal</button>
                        <button onClick={handleSaveSignature} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"><Save size={16}/> Simpan</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* NEW: Contact Detail/Edit Modal */}
      {showContactModal && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                            {selectedContact.name.charAt(0)}
                        </div>
                        <h3 className="font-bold text-slate-800">Detail Kontak</h3>
                    </div>
                    <button onClick={() => setShowContactModal(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><User size={12}/> Nama Lengkap + Gelar</label>
                        <input 
                            type="text" 
                            value={selectedContact.name} 
                            onChange={(e) => setSelectedContact({...selectedContact, name: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Phone size={12}/> WhatsApp</label>
                        <input 
                            type="text" 
                            value={selectedContact.whatsapp} 
                            onChange={(e) => setSelectedContact({...selectedContact, whatsapp: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" 
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Akan otomatis diformat saat disimpan.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Briefcase size={12}/> Jabatan</label>
                            <input 
                                type="text" 
                                value={selectedContact.jobTitle || ''} 
                                onChange={(e) => setSelectedContact({...selectedContact, jobTitle: e.target.value})} 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="-"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Building2 size={12}/> Unit Kerja</label>
                            <input 
                                type="text" 
                                value={selectedContact.unit || ''} 
                                onChange={(e) => setSelectedContact({...selectedContact, unit: e.target.value})} 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="-"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Alamat</label>
                        <textarea 
                            value={selectedContact.address || ''} 
                            onChange={(e) => setSelectedContact({...selectedContact, address: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20" 
                            placeholder="-"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setShowContactModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm">Batal</button>
                    <button onClick={handleUpdateContact} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"><Save size={16}/> Simpan Perubahan</button>
                </div>
            </div>
        </div>
      )}

      {/* Modals (Delete, Share, Settings) - same as existing code */}
      {deleteTargetId && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"><div className="p-6 text-center"><AlertCircle size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Hapus</h3><p className="text-slate-500 text-sm mb-4">Hapus data pelatihan ini secara permanen?</p><div className="mb-4 text-left"><label className="block text-xs font-bold text-slate-700 mb-1">Kode Otorisasi</label><div className="relative"><input type="password" value={deleteAuthInput} onChange={e => setDeleteAuthInput(e.target.value)} placeholder="Masukkan sandi..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" autoFocus /></div></div><div className="flex gap-3"><button onClick={() => { setDeleteTargetId(null); setDeleteAuthInput(''); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200">Batal</button><button onClick={executeDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50">{isDeleting ? <RotateCcw size={18} className="animate-spin" /> : 'Hapus'}</button></div></div></div></div>)}
      {showShareModal && shareData && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"><div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800">Bagikan Akses</h3><button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button></div><div className="p-6 space-y-4"><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={() => setShareTab('link')} className={`flex-1 py-2 rounded text-xs font-bold ${shareTab === 'link' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>LINK & DATA</button><button onClick={() => setShareTab('code')} className={`flex-1 py-2 rounded text-xs font-bold ${shareTab === 'code' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>KODE AKSES</button></div>{shareTab === 'link' ? (<div className="space-y-4"><div><div className="flex items-center justify-between mb-1"><p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Link Halaman Evaluasi</p><span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Resmi</span></div><input readOnly value={shareData.shortUrl} onClick={(e) => e.currentTarget.select()} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs break-all font-mono text-slate-600 mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"/><button onClick={() => copyToClipboard(shareData.fullUrl)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">{copied ? <Check size={18}/> : <CopyIcon size={18}/>}{copied ? 'Link Tersalin!' : 'Salin Link & Data Lengkap'}</button><p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">Link ini telah dikompresi agar lebih pendek. Buka di perangkat lain tanpa login.</p></div></div>) : (<div className="text-center space-y-4 py-4"><div onClick={() => copyToClipboard(shareData.accessCode)} className={`p-8 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 group relative overflow-hidden ${copied ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-300 hover:border-indigo-500 hover:bg-white hover:shadow-lg'}`}><div className={`text-5xl font-mono font-bold tracking-[0.2em] mb-3 transition-all duration-300 group-hover:scale-110 ${copied ? 'text-green-700' : 'text-slate-800'}`}>{shareData.accessCode}</div><div className="flex items-center justify-center gap-2 text-xs">{copied ? (<span className="text-green-600 font-bold flex items-center animate-in fade-in zoom-in"><Check size={14} className="mr-1"/> Berhasil Disalin!</span>) : (<span className="text-slate-400 group-hover:text-indigo-500 transition-colors flex items-center"><CopyIcon size={12} className="mr-1.5"/> Klik area ini untuk menyalin kode</span>)}</div></div><p className="text-xs text-slate-400">Gunakan kode ini di halaman depan jika link tidak bekerja.</p></div>)}</div></div></div>)}
      {/* Settings Modal - unchanged */}
      {showSettingsModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col md:flex-row"><div className="w-full md:w-64 bg-slate-50 border-r flex flex-col p-4 space-y-2"><h3 className="font-bold text-slate-800 mb-4 px-4 flex items-center gap-2"><Settings size={18}/> Pengaturan</h3><button onClick={() => setActiveSettingsTab('training')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'training' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>Dasar</button><button onClick={() => setActiveSettingsTab('whatsapp')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'whatsapp' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>WhatsApp</button><button onClick={() => setActiveSettingsTab('backup')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'backup' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>Data</button><button onClick={() => setActiveSettingsTab('reset')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'reset' ? 'bg-red-600 text-white' : 'hover:bg-red-50 text-red-600'}`}>Reset Sistem</button></div><div className="flex-1 p-8 relative overflow-y-auto bg-white"><button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition"><X size={20}/></button>{activeSettingsTab === 'training' && (<div className="space-y-6"><h4 className="text-xl font-bold text-slate-800">Pengaturan Pelatihan</h4><div><label className="block text-sm font-semibold text-slate-600 mb-2">Deskripsi Default</label><textarea value={appSettings.defaultTrainingDescription} onChange={e => setAppSettings({...appSettings, defaultTrainingDescription: e.target.value})} className="w-full border border-slate-300 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 outline-none" /></div><button onClick={handleSaveSettings} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Simpan</button></div>)}{activeSettingsTab === 'whatsapp' && (<div className="space-y-4"><h4 className="text-xl font-bold text-slate-800">WhatsApp Gateway</h4><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Gateway</label><input type="text" value={appSettings.waBaseUrl} onChange={e => setAppSettings({...appSettings, waBaseUrl: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://api.fonnte.com/send" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Fonnte)</label><input type="text" value={appSettings.waApiKey} onChange={e => setAppSettings({...appSettings, waApiKey: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: EK2Ef..." /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Header Pesan</label><textarea value={appSettings.waHeader} onChange={e => setAppSettings({...appSettings, waHeader: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" placeholder="Judul laporan..." /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Footer Pesan</label><textarea value={appSettings.waFooter} onChange={e => setAppSettings({...appSettings, waFooter: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" placeholder="Pesan penutup..." /></div><div className="pt-4"><button onClick={handleSaveSettings} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition w-full md:w-auto">Simpan Konfigurasi</button></div></div>)}{activeSettingsTab === 'backup' && (<div className="space-y-8"><h4 className="text-xl font-bold text-slate-800">Cadangan & Pulihkan</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><button onClick={async () => { const data = await exportAllData(); const blob = new Blob([data], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click(); }} className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl text-center hover:bg-indigo-100 transition"><Download className="mx-auto mb-2 text-indigo-600" size={32}/><p className="font-bold text-indigo-700">Ekspor Data</p></button><button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center hover:bg-slate-100 transition"><Upload className="mx-auto mb-2 text-slate-600" size={32}/><p className="font-bold text-slate-700">Impor Data</p></button><input type="file" ref={fileInputRef} onChange={e => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = async (ev) => { if(await importAllData(ev.target?.result as string)) { refreshData(); alert('Data berhasil dipulihkan!'); } }; reader.readAsText(file); } }} className="hidden" accept=".json" /></div></div>)}{activeSettingsTab === 'reset' && (<div className="space-y-6"><h4 className="text-xl font-bold text-red-600">Reset Data Aplikasi</h4><p className="text-sm text-slate-500 leading-relaxed">Peringatan: Tindakan ini akan menghapus seluruh database pelatihan, respon evaluasi, dan daftar kontak secara permanen. Pastikan Anda telah melakukan ekspor data jika diperlukan.</p><div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"><AlertCircle className="text-red-600 shrink-0" size={20}/><p className="text-xs text-red-700 font-medium">Reset tidak dapat dibatalkan. Sistem akan mengembalikan pengaturan ke kondisi awal.</p></div><button onClick={handleResetApplication} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">Reset Seluruh Data</button></div>)}</div></div></div>)}
    </div>
  );
};