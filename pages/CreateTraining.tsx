import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Facilitator, Question, Training, Contact, TrainingTheme } from '../types';
import { saveTraining, getTrainingById, getGlobalQuestions, getContacts, saveContact, getSettings, getTrainings, getThemes, updateResponseMetadata } from '../services/storageService';
import { QuestionBuilder } from '../components/QuestionBuilder';
import { ArrowLeft, Save, Plus, X, Calendar, UserPlus, Settings, CheckCircle, Lock, Unlock, MessageSquare, Trash2, FileText, Edit2, Phone, ChevronDown, Check, FolderOpen, Clock, Hash, UserCheck, MapPin, Monitor, User, PenTool, RefreshCw } from 'lucide-react';

export const CreateTraining: React.FC = () => {
  const navigate = useNavigate();
  const { trainingId } = useParams<{ trainingId: string }>();

  // Steps: 1 = Date/Title, 2 = Facilitators/Questions
  const [step, setStep] = useState(1);

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(''); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantLimit, setParticipantLimit] = useState(''); 

  // Extended Info (Optional)
  const [useMethod, setUseMethod] = useState(false);
  const [learningMethod, setLearningMethod] = useState(''); // Menyimpan Nama Tema
  const [useLocation, setUseLocation] = useState(false);
  const [location, setLocation] = useState('Surabaya');

  // Internal state
  const [currentId, setCurrentId] = useState<string>('');
  const [currentAccessCode, setCurrentAccessCode] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const [currentReportedTargets, setCurrentReportedTargets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Config State
  const [allowManualInput, setAllowManualInput] = useState(false); // Default false

  // Facilitators
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);
  const [originalFacilitators, setOriginalFacilitators] = useState<Facilitator[]>([]); // Track original state for edits
  
  // --- FORM STATE FOR TOP INPUT (DYNAMIC ARRAYS) ---
  const [facNames, setFacNames] = useState<string[]>(['']); // Array for names
  const [facSubjects, setFacSubjects] = useState<string[]>(['']); // Array for subjects
  const [facDate, setFacDate] = useState('');
  const [facTime, setFacTime] = useState(''); 
  const [showTimeInput, setShowTimeInput] = useState(false); 
  
  // State for Autocomplete Dropdown
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeNameIndex, setActiveNameIndex] = useState<number>(0); 

  // State for Editing/Adding within Group Card
  const [editingFacName, setEditingFacName] = useState<string | null>(null); 
  const [editNameInput, setEditNameInput] = useState('');
  const [editWaInput, setEditWaInput] = useState('');
  const [showEditSuggestions, setShowEditSuggestions] = useState(false); 
  
  // State for Editing specific Session (Inline)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionSubject, setEditSessionSubject] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');

  const [addingSessionTo, setAddingSessionTo] = useState<string | null>(null); 
  const [newSessionSubject, setNewSessionSubject] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState(''); 

  // Contacts Database
  const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
  
  // New Contact Detection State
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [pendingContactName, setPendingContactName] = useState('');
  const [pendingContactWa, setPendingContactWa] = useState('');
  const [tempIgnoredNames, setTempIgnoredNames] = useState<Set<string>>(new Set());

  // Themes
  const [availableThemes, setAvailableThemes] = useState<TrainingTheme[]>([]);
  const [selectedThemeName, setSelectedThemeName] = useState<string>(''); 
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  // Evaluation Config
  const [processDate, setProcessDate] = useState(''); 
  const [facilitatorQuestions, setFacilitatorQuestions] = useState<Question[]>([]);
  const [processQuestions, setProcessQuestions] = useState<Question[]>([]);

  // Automation Targets
  const [targets, setTargets] = useState<number[]>([]);
  const [newTargetInput, setNewTargetInput] = useState('');

  // Process Automation
  const [processOrganizerName, setProcessOrganizerName] = useState('');
  const [processOrganizerWa, setProcessOrganizerWa] = useState('');
  const [processTargets, setProcessTargets] = useState<number[]>([]); 
  const [newProcessTargetInput, setNewProcessTargetInput] = useState(''); 
  const [showProcessSuggestions, setShowProcessSuggestions] = useState(false);

  const getTodayStr = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };
  const todayStr = getTodayStr();

  const groupedFacilitators = useMemo(() => {
    const sorted = [...facilitators].sort((a, b) => (a.order || 0) - (b.order || 0));
    const groups: Record<string, Facilitator[]> = {};
    sorted.forEach(f => {
        const key = f.name; 
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });
    return groups;
  }, [facilitators]);

  const filteredContacts = useMemo(() => {
    const currentName = facNames[activeNameIndex] || '';
    if (!currentName) return [];
    return savedContacts.filter(c => c.name.toLowerCase().includes(currentName.toLowerCase()));
  }, [facNames, activeNameIndex, savedContacts]);

  const filteredEditContacts = useMemo(() => {
    if (!editNameInput) return [];
    return savedContacts.filter(c => c.name.toLowerCase().includes(editNameInput.toLowerCase()));
  }, [editNameInput, savedContacts]);

  const filteredProcessContacts = useMemo(() => {
    if (!processOrganizerName) return [];
    return savedContacts.filter(c => c.name.toLowerCase().includes(processOrganizerName.toLowerCase()));
  }, [processOrganizerName, savedContacts]);

  useEffect(() => {
    const init = async () => {
        setSavedContacts(await getContacts());
        setAvailableThemes(await getThemes());
        
        if (trainingId) {
          const data = await getTrainingById(trainingId);
          if (data) {
            setTitle(data.title);
            setDescription(data.description || ''); 
            setStartDate(data.startDate);
            setEndDate(data.endDate);
            setParticipantLimit(data.participantLimit ? data.participantLimit.toString() : ''); 
            setProcessDate(data.processEvaluationDate || data.endDate); 
            setFacilitators(data.facilitators);
            // Deep copy for original state tracking
            setOriginalFacilitators(JSON.parse(JSON.stringify(data.facilitators)));
            
            setFacilitatorQuestions(data.facilitatorQuestions);
            setProcessQuestions(data.processQuestions);
            setTargets(data.targets || []);
            setAllowManualInput(data.allowManualInput || false);
            
            if (data.learningMethod) { setUseMethod(true); setLearningMethod(data.learningMethod); }
            if (data.location) { setUseLocation(true); setLocation(data.location); }

            if (data.processOrganizer) {
                setProcessOrganizerName(data.processOrganizer.name);
                setProcessOrganizerWa(data.processOrganizer.whatsapp);
            }
            if (data.processTargets && data.processTargets.length > 0) {
                setProcessTargets(data.processTargets);
            } else if (data.processTarget) {
                setProcessTargets([data.processTarget]);
            }

            setCurrentId(data.id);
            setCurrentAccessCode(data.accessCode);
            setCreatedAt(data.createdAt);
            setCurrentReportedTargets(data.reportedTargets || {});
            setStep(1); 
          }
        } else {
          const settings = await getSettings();
          setDescription(settings.defaultTrainingDescription || ''); 
          const globals = await getGlobalQuestions();
          const facDefaults = globals.filter(q => q.category === 'facilitator' && q.isDefault).map(q => ({ id: uuidv4(), label: q.label, type: q.type }));
          const procDefaults = globals.filter(q => q.category === 'process' && q.isDefault).map(q => ({ id: uuidv4(), label: q.label, type: q.type }));
          setFacilitatorQuestions(facDefaults);
          setProcessQuestions(procDefaults);
        }
    };
    init();
  }, [trainingId]);

  const handleStep1Confirm = () => {
      if (!title || !startDate || !endDate) {
          alert("Mohon lengkapi judul dan rentang tanggal pelatihan.");
          return;
      }
      if (new Date(startDate) > new Date(endDate)) {
          alert("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
          return;
      }
      if (!processDate) setProcessDate(endDate);
      setStep(2);
  };

  // --- HANDLER BARU: METODE PEMBELAJARAN (TEMA) ---
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedThemeId = e.target.value;
      
      // Cari tema berdasarkan ID
      const theme = availableThemes.find(t => t.id === selectedThemeId);
      
      if (theme) {
          // Simpan nama tema ke learningMethod
          setLearningMethod(theme.name);
          
          // Terapkan Pertanyaan Fasilitator
          if (theme.facilitatorQuestions && theme.facilitatorQuestions.length > 0) {
              setFacilitatorQuestions(theme.facilitatorQuestions.map(q => ({
                  ...q,
                  id: uuidv4() // Generate ID baru agar tidak konflik referensi
              })));
          }

          // Terapkan Pertanyaan Proses
          if (theme.processQuestions && theme.processQuestions.length > 0) {
              setProcessQuestions(theme.processQuestions.map(q => ({
                  ...q,
                  id: uuidv4()
              })));
          }
      } else {
          setLearningMethod('');
      }
  };

  const handleFacNameChange = (index: number, value: string) => {
      const newNames = [...facNames];
      newNames[index] = value;
      setFacNames(newNames);
      setActiveNameIndex(index);
      setShowSuggestions(true);
  };

  const addNameRow = () => setFacNames([...facNames, '']);
  const removeNameRow = (index: number) => setFacNames(facNames.filter((_, i) => i !== index));
  const handleFacSubjectChange = (index: number, value: string) => { const newSubjects = [...facSubjects]; newSubjects[index] = value; setFacSubjects(newSubjects); };
  const addSubjectRow = () => setFacSubjects([...facSubjects, '']);
  const removeSubjectRow = (index: number) => setFacSubjects(facSubjects.filter((_, i) => i !== index));

  const selectContact = (contact: Contact) => {
    const newNames = [...facNames];
    newNames[activeNameIndex] = contact.name;
    setFacNames(newNames);
    setShowSuggestions(false);
  };

  const handleEditFacilitatorInput = (value: string) => { setEditNameInput(value); setShowEditSuggestions(true); };
  const selectEditContact = (contact: Contact) => { setEditNameInput(contact.name); setEditWaInput(contact.whatsapp); setShowEditSuggestions(false); };
  const handleProcessOrganizerInput = (value: string) => { setProcessOrganizerName(value); setShowProcessSuggestions(true); if (!value) setProcessOrganizerWa(''); };
  const selectProcessContact = (contact: Contact) => { setProcessOrganizerName(contact.name); setProcessOrganizerWa(contact.whatsapp); setShowProcessSuggestions(false); };

  // --- CORE LOGIC: Add Facilitator ---
  // UPDATED: Added manualContact parameter for direct injection
  const addFacilitatorFromTop = (overrideNames: string[] = [], manualContact?: Contact) => {
    const validNames = facNames.map(n => n.trim()).filter(Boolean);
    const validSubjects = facSubjects.map(s => s.trim()).filter(Boolean);

    if (validNames.length > 0 && validSubjects.length > 0 && facDate) {
      
      // CHECK FOR UNKNOWN CONTACTS
      const unknownNames = validNames.filter(name => {
          if (overrideNames.some(o => o.toLowerCase() === name.toLowerCase())) return false;
          const exists = savedContacts.some(c => c.name.toLowerCase() === name.toLowerCase());
          const ignored = tempIgnoredNames.has(name.toLowerCase());
          return !exists && !ignored;
      });

      if (unknownNames.length > 0) {
          setPendingContactName(unknownNames[0]);
          setPendingContactWa('');
          setShowNewContactModal(true);
          return; // Stop here, wait for modal
      }

      const newFacilitators: Facilitator[] = [];
      let maxOrder = facilitators.reduce((max, f) => Math.max(max, f.order || 0), 0);

      validNames.forEach(name => {
          let waToUse = '';
          
          // PRIORITY 1: Check Manual Injection (From Modal Save)
          if (manualContact && manualContact.name.toLowerCase() === name.toLowerCase()) {
              waToUse = manualContact.whatsapp;
          } 
          // PRIORITY 2: Check Existing Contacts
          else {
              const contact = savedContacts.find(c => c.name.toLowerCase() === name.toLowerCase());
              if (contact) waToUse = contact.whatsapp;
          }
          
          if (!waToUse) {
              const existingFac = facilitators.find(f => f.name.toLowerCase() === name.toLowerCase());
              if (existingFac && existingFac.whatsapp) waToUse = existingFac.whatsapp;
          }

          validSubjects.forEach(subject => {
             maxOrder++;
             newFacilitators.push({
                 id: uuidv4(),
                 name: name,
                 subject: subject,
                 sessionDate: facDate,
                 sessionStartTime: facTime || undefined,
                 whatsapp: waToUse,
                 order: maxOrder
             });
          });
      });

      setFacilitators([...facilitators, ...newFacilitators]);
      
      setFacNames(['']); 
      setFacSubjects(['']); 
      setFacDate(''); 
      setFacTime(''); 
      setShowTimeInput(false);
      setTempIgnoredNames(new Set()); // Reset ignored list
    } else { 
        alert("Lengkapi minimal satu Nama, satu Materi, dan Tanggal Sesi."); 
    }
  };

  // --- NEW CONTACT HANDLER ---
  const handleConfirmNewContact = async () => {
      let finalWa = pendingContactWa.trim().replace(/[\s-]/g, '');
      if (finalWa.startsWith('62')) finalWa = '0' + finalWa.substring(2);
      else if (finalWa.startsWith('+62')) finalWa = '0' + finalWa.substring(3);

      const newContact: Contact = {
          id: uuidv4(),
          name: pendingContactName,
          whatsapp: finalWa,
          jobTitle: '-', 
          unit: '-',
          address: '-'
      };
      await saveContact(newContact);

      // Update state
      setSavedContacts(prev => [...prev, newContact]);
      
      // Close modal
      setShowNewContactModal(false);
      
      // Recursively call add with override AND the specific new contact object
      // This ensures the WA number is available immediately even if state hasn't refreshed
      setTimeout(() => addFacilitatorFromTop([pendingContactName], newContact), 100); 
  };

  const handleSkipNewContact = () => {
      setTempIgnoredNames(prev => new Set(prev).add(pendingContactName.toLowerCase()));
      setShowNewContactModal(false);
      setTimeout(() => addFacilitatorFromTop([pendingContactName]), 100); 
  };

  const applyTheme = (themeId: string) => { setIsThemeDropdownOpen(false); if (!themeId) return; const selectedTheme = availableThemes.find(t => t.id === themeId); if (selectedTheme && confirm(`Terapkan tema "${selectedTheme.name}"? \n\nIni akan mengganti seluruh pertanyaan.`)) { setFacilitatorQuestions((selectedTheme.facilitatorQuestions || []).map(q => ({ id: uuidv4(), label: q.label, type: q.type }))); setProcessQuestions((selectedTheme.processQuestions || []).map(q => ({ id: uuidv4(), label: q.label, type: q.type }))); setSelectedThemeName(selectedTheme.name); } };
  const startEditFacilitator = (name: string, currentWa?: string) => { setEditingFacName(name); setEditNameInput(name); setEditWaInput(currentWa || ''); setShowEditSuggestions(false); };
  const saveEditFacilitator = () => { if (!editingFacName || !editNameInput) return; setFacilitators(facilitators.map(f => f.name === editingFacName ? { ...f, name: editNameInput, whatsapp: editWaInput } : f)); setEditingFacName(null); };
  const updateOrder = (name: string, newOrder: string) => { const orderNum = parseInt(newOrder); if(isNaN(orderNum)) return; setFacilitators(facilitators.map(f => f.name === name ? { ...f, order: orderNum } : f)); };
  const deleteFacilitatorGroup = (name: string) => { if(confirm(`Hapus semua sesi untuk ${name}?`)) setFacilitators(facilitators.filter(f => f.name !== name)); };
  const startAddSession = (name: string) => { setAddingSessionTo(name); setNewSessionSubject(''); setNewSessionDate(''); setNewSessionTime(''); };
  const saveNewSession = () => { if (!addingSessionTo || !newSessionSubject || !newSessionDate) return; const existing = facilitators.find(f => f.name === addingSessionTo); const newFac: Facilitator = { id: uuidv4(), name: addingSessionTo, subject: newSessionSubject, sessionDate: newSessionDate, sessionStartTime: newSessionTime || undefined, whatsapp: existing?.whatsapp, order: existing?.order || 0 }; setFacilitators([...facilitators, newFac]); setAddingSessionTo(null); };
  const removeSession = (id: string) => { setFacilitators(facilitators.filter(f => f.id !== id)); };
  const startEditSession = (session: Facilitator) => { setEditingSessionId(session.id); setEditSessionSubject(session.subject); setEditSessionDate(session.sessionDate); setEditSessionTime(session.sessionStartTime || ''); };
  const saveEditSession = () => { if (!editingSessionId || !editSessionSubject || !editSessionDate) return; setFacilitators(facilitators.map(f => f.id === editingSessionId ? { ...f, subject: editSessionSubject, sessionDate: editSessionDate, sessionStartTime: editSessionTime || undefined } : f)); setEditingSessionId(null); };
  const cancelEditSession = () => { setEditingSessionId(null); };
  const toggleSessionLock = (id: string, currentIsOpen: boolean | undefined) => { setFacilitators(facilitators.map(f => { if (f.id === id) { let nextStatus: boolean | undefined; if (currentIsOpen === undefined) nextStatus = false; else if (currentIsOpen === false) nextStatus = true; else nextStatus = undefined; return { ...f, isOpen: nextStatus }; } return f; })); };
  const addTarget = () => { const val = parseInt(newTargetInput); if (!isNaN(val) && val > 0 && !targets.includes(val)) { setTargets([...targets, val].sort((a,b) => a - b)); setNewTargetInput(''); } };
  const removeTarget = (val: number) => setTargets(targets.filter(t => t !== val));
  const addProcessTarget = () => { const val = parseInt(newProcessTargetInput); if (!isNaN(val) && val > 0 && !processTargets.includes(val)) { setProcessTargets([...processTargets, val].sort((a,b) => a - b)); setNewProcessTargetInput(''); } };
  const removeProcessTarget = (val: number) => setProcessTargets(processTargets.filter(t => t !== val));

  const handleSave = async () => {
    setIsSaving(true);
    const existingTrainings = await getTrainings();
    const isDuplicate = existingTrainings.some(t => t.title.toLowerCase().trim() === title.toLowerCase().trim() && t.id !== currentId);
    if (isDuplicate && !confirm(`Peringatan: Nama pelatihan "${title}" sudah ada dalam daftar. Tetap lanjutkan?`)) { setIsSaving(false); return; }
    if (facilitators.length === 0 && !confirm("Anda belum menambahkan fasilitator. Tetap lanjutkan?")) { setIsSaving(false); return; }

    // --- NEW LOGIC: Update Metadata in Existing Responses ---
    if (trainingId) { // Only checking if in EDIT mode
        const updates: Promise<void>[] = [];
        
        // Loop through current facilitators to find changes
        for (const fac of facilitators) {
            // Find the original state of this facilitator by ID
            const original = originalFacilitators.find(o => o.id === fac.id);
            
            if (original) {
                // Check if Name or Subject has changed
                if (original.name !== fac.name || original.subject !== fac.subject) {
                    updates.push(
                        updateResponseMetadata(
                            currentId,
                            original.name,
                            original.subject,
                            fac.name,
                            fac.subject
                        )
                    );
                }
            }
        }

        if (updates.length > 0) {
            console.log(`Processing ${updates.length} facilitator updates for existing responses...`);
            await Promise.all(updates);
        }
    }
    // --- END NEW LOGIC ---

    let pOrganizer: Contact | undefined = undefined;
    if (processOrganizerName) pOrganizer = { id: uuidv4(), name: processOrganizerName, whatsapp: processOrganizerWa };

    const newTraining: Training = {
      id: currentId || uuidv4(),
      accessCode: currentAccessCode || Math.random().toString(36).substring(2, 7).toUpperCase(),
      title, description, startDate, endDate, processEvaluationDate: processDate || endDate, 
      facilitators, facilitatorQuestions, processQuestions, createdAt: createdAt, targets: targets, reportedTargets: currentReportedTargets,
      processOrganizer: pOrganizer, processTargets: processTargets, learningMethod: useMethod ? learningMethod : undefined,
      location: useLocation ? location : undefined, participantLimit: participantLimit ? parseInt(participantLimit) : undefined,
      allowManualInput: allowManualInput 
    };

    await saveTraining(newTraining);
    setIsSaving(false);
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => navigate('/admin/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"><ArrowLeft size={20} /></button>
              <h1 className="text-lg font-bold text-slate-800">{trainingId ? 'Edit Pelatihan' : 'Buat Pelatihan Baru'}</h1>
           </div>
           {step === 2 && (<button onClick={handleSave} disabled={isSaving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">{isSaving ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18} />} {isSaving ? 'Menyimpan...' : 'Simpan Data'}</button>)}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-center mb-8">
            <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                <div className={`w-16 h-1 bg-slate-200 mx-2 ${step >= 2 ? 'bg-indigo-600' : ''}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
            </div>
        </div>
        
        {/* Step 1 Block */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-opacity duration-300 ${step === 2 ? 'opacity-70 pointer-events-none' : 'opacity-100'}`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3"><div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Calendar size={20} /></div><h2 className="font-semibold text-slate-800">Langkah 1: Informasi Dasar</h2></div>
            <div className="p-6 grid gap-6">
                <div><label className="block text-sm font-medium text-slate-700 mb-2">Judul / Topik Pelatihan</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:bg-slate-50" placeholder="Contoh: Digital Marketing Batch 5" /></div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
                            <input type="checkbox" checked={useMethod} onChange={e => setUseMethod(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" disabled={step === 2}/>
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Monitor size={14}/> Tambah Metode Pembelajaran (Terapkan Tema)</span>
                        </label>
                        {useMethod && (
                            <select 
                                value={availableThemes.find(t => t.name === learningMethod)?.id || ''} 
                                onChange={handleMethodChange} 
                                disabled={step === 2} 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white animate-in fade-in slide-in-from-top-2"
                            >
                                <option value="">-- Pilih Tema Pelatihan --</option>
                                {availableThemes.length === 0 && <option disabled>Tidak ada tema tersedia</option>}
                                {availableThemes.map(theme => (
                                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                                ))}
                            </select>
                        )}
                        {useMethod && learningMethod && <p className="text-[10px] text-green-600 mt-1 italic flex items-center gap-1"><CheckCircle size={10}/> Variabel tema "{learningMethod}" akan diterapkan di langkah selanjutnya.</p>}
                    </div>
                    <div>
                        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
                            <input type="checkbox" checked={useLocation} onChange={e => setUseLocation(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" disabled={step === 2}/>
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><MapPin size={14}/> Di UPT Pelkesmas Kampus...</span>
                        </label>
                        {useLocation && (
                            <select value={location} onChange={e => setLocation(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white animate-in fade-in slide-in-from-top-2">
                                <option value="Surabaya">Surabaya</option>
                                <option value="Malang">Malang</option>
                                <option value="Madiun">Madiun</option>
                            </select>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">Tanggal Mulai</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">Tanggal Selesai</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                </div>
                
                <div className="md:w-1/3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah Peserta (Max Responden)</label>
                    <input type="number" value={participantLimit} onChange={(e) => setParticipantLimit(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                    <p className="text-xs text-slate-500 mt-1">Kosongi jika tidak ada batasan.</p>
                </div>

                <div><label className="block text-sm font-medium text-slate-700 mb-2">Deskripsi Pelatihan</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={step === 2} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none" placeholder="Contoh: Silakan isi evaluasi ini dengan objektif..." /></div>
                {step === 1 && (<div className="flex justify-end pt-4"><button onClick={handleStep1Confirm} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition flex items-center gap-2">Lanjut / Kunci Tanggal <CheckCircle size={18}/></button></div>)}
                {step === 2 && (<div className="flex justify-end pt-2"><button onClick={() => setStep(1)} className="text-slate-500 hover:text-indigo-600 text-sm font-medium underline">Ubah Informasi Dasar</button></div>)}
            </div>
        </div>

        {step === 2 && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><UserPlus size={20} /></div><h2 className="font-semibold text-slate-800">Langkah 2A: Daftar Fasilitator</h2></div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-8 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                            
                            <div className="md:col-span-3 relative space-y-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nama</label>
                                {facNames.map((name, idx) => (
                                    <div key={idx} className="relative group">
                                        <input type="text" value={name} onChange={(e) => handleFacNameChange(idx, e.target.value)} onFocus={() => setActiveNameIndex(idx)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Nama Fasilitator..." className="w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" autoComplete="off" />
                                        {facNames.length > 1 ? (<button onClick={() => removeNameRow(idx)} className="absolute right-1 top-1 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>) : (<button onClick={addNameRow} className="absolute right-1 top-1 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={16} /></button>)}
                                        {idx === facNames.length - 1 && facNames.length > 1 && (<button onClick={addNameRow} className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-full p-0.5 z-10 shadow-sm border border-white"><Plus size={12} /></button>)}
                                        {showSuggestions && activeNameIndex === idx && filteredContacts.length > 0 && (
                                            <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                {filteredContacts.map(c => (
                                                    <li key={c.id} onClick={() => selectContact(c)} className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border-b border-slate-50 last:border-0 transition-colors">{c.name}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="md:col-span-4 relative space-y-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Materi</label>
                                {facSubjects.map((sub, idx) => (
                                    <div key={idx} className="relative group">
                                        <input type="text" value={sub} onChange={(e) => handleFacSubjectChange(idx, e.target.value)} placeholder="Topik Materi..." className="w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm" />
                                        {facSubjects.length > 1 ? (<button onClick={() => removeSubjectRow(idx)} className="absolute right-1 top-1 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>) : (<button onClick={addSubjectRow} className="absolute right-1 top-1 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={16} /></button>)}
                                        {idx === facSubjects.length - 1 && facSubjects.length > 1 && (<button onClick={addSubjectRow} className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-full p-0.5 z-10 shadow-sm border border-white"><Plus size={12} /></button>)}
                                    </div>
                                ))}
                            </div>

                            <div className="md:col-span-4 self-start"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tanggal {showTimeInput && '& Waktu'}</label><div className="flex gap-2"><input type="date" value={facDate} min={startDate} max={endDate} onChange={(e) => setFacDate(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0" />{showTimeInput ? (<div className="relative animate-in fade-in slide-in-from-right-4 duration-300 flex gap-1 shrink-0"><input type="time" value={facTime} onChange={(e) => setFacTime(e.target.value)} className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /><button onClick={() => { setShowTimeInput(false); setFacTime(''); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 hover:border-red-200 transition" title="Hapus Waktu"><X size={16} /></button></div>) : (<button onClick={() => setShowTimeInput(true)} className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-300 rounded-lg hover:border-indigo-300 transition" title="Tambah Waktu Spesifik"><Clock size={18} /></button>)}</div></div>
                            <div className="md:col-span-1 self-start mt-6 md:mt-0"><button onClick={() => addFacilitatorFromTop()} disabled={!facNames[0] || !facSubjects[0] || !facDate} className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center justify-center h-[38px]"><Plus size={16} /></button></div>
                        </div>

                        <div className="space-y-4">
                        {Object.keys(groupedFacilitators).length === 0 && <p className="text-center text-slate-400 text-sm py-4 italic">Belum ada fasilitator ditambahkan.</p>}
                        {Object.entries(groupedFacilitators).map(([name, rawItems]) => {
                             const groupItems = rawItems as Facilitator[];
                             const wa = groupItems[0].whatsapp;
                             const order = groupItems[0].order || 0; 
                             const isEditing = editingFacName === name;
                             const isAdding = addingSessionTo === name;
                             return (
                                <div key={name} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors group/card">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100 rounded-t-xl flex justify-between items-start md:items-center flex-col md:flex-row gap-3">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 gap-1" title="Nomor Urut"><Hash size={12} className="text-slate-400"/><input type="number" value={order} onChange={(e) => updateOrder(name, e.target.value)} className="w-8 text-center text-sm font-bold text-indigo-700 outline-none"/></div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">{name.charAt(0)}</div>
                                            {isEditing ? (<div className="flex gap-2 w-full max-w-md items-start"><div className="relative flex-1"><input type="text" value={editNameInput} onChange={(e) => handleEditFacilitatorInput(e.target.value)} onBlur={() => setTimeout(() => setShowEditSuggestions(false), 200)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nama" autoComplete="off"/>{showEditSuggestions && editNameInput && filteredEditContacts.length > 0 && (<ul className="absolute z-[60] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">{filteredEditContacts.map(c => (<li key={c.id} onClick={() => selectEditContact(c)} className="px-3 py-2 text-xs font-normal text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border-b border-slate-50 last:border-0 transition-colors">{c.name}</li>))}</ul>)}</div><input type="text" value={editWaInput} onChange={e => setEditWaInput(e.target.value)} className="w-32 border border-slate-300 rounded px-2 py-1 text-sm font-mono" placeholder="No WA" /><button onClick={saveEditFacilitator} className="bg-green-600 text-white p-1 rounded hover:bg-green-700"><Check size={16}/></button><button onClick={() => setEditingFacName(null)} className="bg-slate-300 text-slate-700 p-1 rounded hover:bg-slate-400"><X size={16}/></button></div>) : (<div className="flex-1"><div className="flex items-center gap-2"><h3 className="font-bold text-slate-800 text-sm">{name}</h3><button onClick={() => startEditFacilitator(name, wa)} className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover/card:opacity-100 transition-opacity"><Edit2 size={12}/></button></div>{wa && <p className="text-xs text-green-600 flex items-center gap-1"><Phone size={10}/> {wa}</p>}</div>)}
                                        </div>
                                        <button onClick={() => deleteFacilitatorGroup(name)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                                    </div>
                                    <div className="p-4 bg-white space-y-2">
                                        {groupItems.map(session => (
                                            <div key={session.id} className={`flex justify-between items-center py-2 px-3 border border-slate-100 rounded-lg text-sm transition ${editingSessionId === session.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
                                                {editingSessionId === session.id ? (
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center w-full"><div className="md:col-span-5"><input type="text" value={editSessionSubject} onChange={e => setEditSessionSubject(e.target.value)} className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Materi" autoFocus /></div><div className="md:col-span-3"><input type="date" value={editSessionDate} min={startDate} max={endDate} onChange={e => setEditSessionDate(e.target.value)} className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div><div className="md:col-span-2"><input type="time" value={editSessionTime} onChange={e => setEditSessionTime(e.target.value)} className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div><div className="md:col-span-2 flex gap-1 justify-end"><button onClick={saveEditSession} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700 transition" title="Simpan Perubahan"><Check size={16}/></button><button onClick={cancelEditSession} className="bg-slate-300 text-slate-700 p-1.5 rounded hover:bg-slate-400 transition" title="Batal"><X size={16}/></button></div></div>
                                                ) : (
                                                    <><div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2"><div className="flex items-center gap-2"><div className="font-medium text-slate-700">{session.subject}</div><div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${session.isOpen ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : session.isOpen === false ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{session.isOpen ? <Unlock size={10}/> : session.isOpen === false ? <Lock size={10}/> : <Clock size={10}/>}{session.isOpen ? 'MANUAL: DIBUKA' : session.isOpen === false ? 'MANUAL: DIKUNCI' : 'OTOMATIS'}</div></div><div className="flex items-center gap-2 text-slate-500 text-xs sm:text-sm"><Calendar size={14}/> {new Date(session.sessionDate).toLocaleDateString('id-ID')}{session.sessionStartTime && (<span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ml-2 border bg-slate-100 border-slate-200 text-slate-600"><Clock size={12}/> {session.sessionStartTime}</span>)}</div></div><div className="flex items-center gap-1 ml-2"><button onClick={() => startEditSession(session)} className="text-slate-300 hover:text-indigo-600 p-1.5 transition rounded-lg hover:bg-indigo-50" title="Edit Sesi"><Edit2 size={16}/></button><button onClick={() => toggleSessionLock(session.id, session.isOpen)} className={`p-1.5 rounded-lg transition ${session.isOpen !== undefined ? (session.isOpen ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50') : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`} title="Ubah Status">{session.isOpen !== undefined ? (session.isOpen ? <Unlock size={16}/> : <Lock size={16}/>) : <Clock size={16}/>}</button><button onClick={() => removeSession(session.id)} className="text-slate-300 hover:text-red-500 ml-1 p-1.5 transition rounded-lg hover:bg-red-50" title="Hapus Sesi"><Trash2 size={16}/></button></div></>
                                                )}
                                            </div>
                                        ))}
                                        {isAdding ? (<div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col gap-2 animate-in fade-in"><input type="text" value={newSessionSubject} onChange={e => setNewSessionSubject(e.target.value)} placeholder="Materi Tambahan..." className="w-full border border-indigo-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" autoFocus /><div className="flex gap-2"><input type="date" value={newSessionDate} min={startDate} max={endDate} onChange={e => setNewSessionDate(e.target.value)} className="flex-1 border border-indigo-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /><input type="time" value={newSessionTime} onChange={e => setNewSessionTime(e.target.value)} className="w-24 border border-indigo-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div><div className="flex gap-1 justify-end mt-1"><button onClick={() => setAddingSessionTo(null)} className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-100">Batal</button><button onClick={saveNewSession} disabled={!newSessionSubject || !newSessionDate} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">Simpan</button></div></div>) : (<button onClick={() => startAddSession(name)} className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2 hover:bg-indigo-50 rounded w-fit transition-colors"><Plus size={14}/> Tambah Materi & Sesi</button>)}
                                    </div>
                                </div>
                             );
                        })}
                        </div>
                    </div>
                </div>
                {/* Step 2B Block */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between"><div className="flex items-center gap-3"><div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Settings size={20} /></div><h2 className="font-semibold text-slate-800">Langkah 2B: Pengaturan Evaluasi</h2></div><div className="relative"><button onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)} className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition border ${selectedThemeName ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}><FolderOpen size={14}/> {selectedThemeName ? `Tema: ${selectedThemeName}` : 'Pilih Tema Preset'} <ChevronDown size={12}/></button>{isThemeDropdownOpen && (<><div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsThemeDropdownOpen(false)}></div><div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-20 animate-in fade-in zoom-in-95 overflow-hidden"><div className="p-2 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50">Tema Tersedia</div><div className="max-h-64 overflow-y-auto">{availableThemes.length === 0 ? (<div className="p-4 text-xs text-slate-400 italic text-center">Belum ada tema. <br/> Buat di menu Variabel.</div>) : (availableThemes.map(theme => (<button key={theme.id} onClick={() => applyTheme(theme.id)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition flex items-center justify-between border-b border-slate-50 last:border-0"><span className="font-medium">{theme.name}</span>{selectedThemeName === theme.name && <Check size={14} className="text-indigo-600"/>}</button>)))}</div><div className="p-2 bg-slate-50 border-t border-slate-100 text-center"><button onClick={() => navigate('/admin/dashboard')} className="text-[10px] text-indigo-600 font-bold hover:underline">Kelola Tema</button></div></div></>)}</div></div>
                    <div className="p-6 space-y-8">
                        <QuestionBuilder title="A. Evaluasi Fasilitator" questions={facilitatorQuestions} onChange={setFacilitatorQuestions} />
                        
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-4 space-y-4">
                            {/* Manual Input Toggle */}
                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-indigo-200">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><PenTool size={16}/></div>
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-slate-800 cursor-pointer select-none flex items-center gap-2">
                                        <input type="checkbox" checked={allowManualInput} onChange={e => setAllowManualInput(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        Izinkan Input Fasilitator Manual
                                    </label>
                                    <p className="text-xs text-slate-500 mt-0.5">Jika aktif, responden dapat mengetik nama fasilitator secara manual jika tidak ada di daftar.</p>
                                </div>
                            </div>

                            {/* Automation Targets */}
                            <div>
                                <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-2"><MessageSquare size={16}/> Target Otomatisasi Laporan (WhatsApp)</h3>
                                <p className="text-xs text-indigo-600 mb-3">Sistem mengirimkan laporan ke WA fasilitator saat jumlah responden <strong>per materi/sesi</strong> mencapai target.</p>
                                <div className="flex gap-2 mb-3"><input type="number" value={newTargetInput} onChange={(e) => setNewTargetInput(e.target.value)} placeholder="Contoh: 10" className="w-24 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm" /><button onClick={addTarget} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm">Tambah Target</button></div>
                                <div className="flex flex-wrap gap-2">{targets.length === 0 && <span className="text-xs text-slate-400 italic">Belum ada target.</span>}{targets.map(t => (<div key={t} className="bg-white border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">Target: {t} Orang<button onClick={() => removeTarget(t)} className="hover:text-red-500"><X size={12}/></button></div>))}</div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-8">
                            <div className="mb-4 bg-orange-50 p-4 rounded-xl border border-orange-100 grid md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 flex items-center justify-between"><label className="text-sm font-bold text-orange-800 flex items-center gap-2"><Calendar size={16}/> Tanggal Evaluasi Penyelenggaraan</label><input type="date" value={processDate} onChange={e => setProcessDate(e.target.value)} className="border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
                                <div className="md:col-span-2 border-t border-orange-200 my-1"></div>
                                <div className="relative"><label className="block text-xs font-bold text-orange-800 uppercase mb-1">Nama Penanggung Jawab</label><input type="text" value={processOrganizerName} onChange={(e) => handleProcessOrganizerInput(e.target.value)} onBlur={() => setTimeout(() => setShowProcessSuggestions(false), 200)} placeholder="Cari Kontak atau Tulis Manual..." className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none" />{showProcessSuggestions && processOrganizerName && filteredProcessContacts.length > 0 && (<ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">{filteredProcessContacts.map(c => (<li key={c.id} onClick={() => selectProcessContact(c)} className="px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer border-b border-slate-50 last:border-0 transition-colors">{c.name}</li>))}</ul>)}</div>
                                <div><label className="block text-xs font-bold text-orange-800 uppercase mb-1">WhatsApp (Manual/Auto)</label><input type="text" value={processOrganizerWa} onChange={(e) => setProcessOrganizerWa(e.target.value)} placeholder="Contoh: 62812345678" className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white" /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-orange-800 uppercase mb-1">Target Laporan (WA)</label><div className="flex gap-2 mb-2"><input type="number" value={newProcessTargetInput} onChange={(e) => setNewProcessTargetInput(e.target.value)} placeholder="Jml Responden" className="w-32 border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none" /><button onClick={addProcessTarget} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">Tambah</button><span className="text-xs text-orange-600 self-center ml-2">Laporan otomatis dikirim saat target tercapai.</span></div><div className="flex flex-wrap gap-2">{processTargets.length === 0 && <span className="text-xs text-orange-400 italic">Belum ada target laporan.</span>}{processTargets.map(t => (<div key={t} className="bg-white border border-orange-200 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">Target: {t} Orang<button onClick={() => removeProcessTarget(t)} className="hover:text-red-500"><X size={12}/></button></div>))}</div></div>
                            </div>
                            <QuestionBuilder title="B. Evaluasi Penyelenggaraan" questions={processQuestions} onChange={setProcessQuestions} />
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showNewContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600"><UserPlus size={24}/></div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Simpan Kontak Baru</h3>
                  <p className="text-sm text-slate-500 mb-4 text-center">
                      Nama <strong>"{pendingContactName}"</strong> belum terdaftar di kontak. Simpan nomor WhatsApp agar fitur laporan otomatis dapat berjalan.
                  </p>
                  
                  <div className="space-y-3 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NAMA FASILITATOR</label>
                          <input type="text" value={pendingContactName} onChange={e => setPendingContactName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 font-bold text-slate-700 outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NOMOR WHATSAPP</label>
                          <input type="text" value={pendingContactWa} onChange={e => setPendingContactWa(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono" placeholder="08..." autoFocus/>
                          <p className="text-[10px] text-slate-400 mt-1">Otomatis diformat ke 62...</p>
                      </div>
                  </div>

                  <div className="flex flex-col gap-2">
                      <button onClick={handleConfirmNewContact} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-200 transition transform active:scale-95">Simpan & Lanjutkan</button>
                      <button onClick={handleSkipNewContact} className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 text-sm transition">Lewati (Jangan Simpan Kontak)</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};