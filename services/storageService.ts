import { Training, Response, GlobalQuestion, Contact, AppSettings, TrainingTheme, GuestEntry, Facilitator } from '../types';
import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch,
  Timestamp,
  getCountFromServer 
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const RESPONDENT_HISTORY_KEY = 'simep_respondent_history_v1';

// --- HELPER: SANITIZE FIRESTORE DATA ---
// Firestore throws an error if any field is 'undefined'. 
// We use JSON serialization to strip undefined fields.
const sanitizeData = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data));
};

// --- INITIALIZATION ---

const ensureDefaults = async () => {
    // Cek apakah ada data global questions sebagai penanda inisialisasi awal
    const qCol = collection(db, 'global_questions');
    const snap = await getDocs(query(qCol, limit(1)));
    
    if (snap.empty) {
        const batch = writeBatch(db);
        const defaults = [
            { id: uuidv4(), label: 'Penguasaan Materi', type: 'star', category: 'facilitator', isDefault: true },
            { id: uuidv4(), label: 'Metode Penyampaian', type: 'star', category: 'facilitator', isDefault: true },
            { id: uuidv4(), label: 'Interaksi dengan Peserta', type: 'slider', category: 'facilitator', isDefault: true },
            { id: uuidv4(), label: 'Kenyamanan Ruangan', type: 'star', category: 'process', isDefault: true },
            { id: uuidv4(), label: 'Kualitas Konsumsi', type: 'star', category: 'process', isDefault: true },
        ];
        
        defaults.forEach((item) => {
            const ref = doc(db, 'global_questions', item.id);
            // @ts-ignore
            batch.set(ref, item);
        });

        // Default Settings including Passwords
        const settingsRef = doc(db, 'settings', 'global');
        batch.set(settingsRef, {
            waApiKey: '',
            waBaseUrl: 'https://api.fonnte.com/send',
            waHeader: 'SIMEP Report',
            waFooter: 'Terima Kasih',
            defaultTrainingDescription: 'Silakan isi evaluasi.',
            isGuestBookOpen: false,
            adminPassword: '12345',
            superAdminPassword: 'supersimep',
            deletePassword: 'adm123',
            signatureTitle: 'Kepala Seksi Penyelenggaraan Pelatihan',
            signatureName: 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.',
            signatureNIP: '19710124 199703 1 004'
        });

        await batch.commit();
        console.log("Firebase initialized with defaults.");
    }
};

// Call once
ensureDefaults();

// --- TRAININGS ---

export const getTrainings = async (): Promise<Training[]> => {
    try {
        const q = query(collection(db, 'trainings'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Training);
    } catch (error) {
        console.error("Error getting trainings:", error);
        return [];
    }
};

export const saveTraining = async (training: Training): Promise<void> => {
    if (!training.accessCode) training.accessCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    try {
        // Menggunakan setDoc dengan ID yang ditentukan (UUID) agar idempotent
        // Data nested seperti facilitators array akan tersimpan otomatis sebagai bagian dari dokumen
        // Sanitize data untuk menghapus undefined
        const cleanTraining = sanitizeData(training);
        await setDoc(doc(db, 'trainings', training.id), cleanTraining);
    } catch (error) {
        console.error("Error saving training:", error);
        throw error;
    }
};

export const deleteTraining = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'trainings', id));
        
        // Hapus response terkait secara manual (Firestore client SDK tidak support cascade delete otomatis)
        const respQuery = query(collection(db, 'responses'), where('trainingId', '==', id));
        const respSnap = await getDocs(respQuery);
        
        // Batched delete for efficiency
        const batch = writeBatch(db);
        respSnap.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error deleting training:", error);
        throw error;
    }
};

export const getTrainingById = async (id: string): Promise<Training | undefined> => {
    try {
        const docRef = doc(db, 'trainings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as Training;
        }
        return undefined;
    } catch (error) {
        console.error("Error getting training by ID:", error);
        return undefined;
    }
};

export const getTrainingByCode = async (code: string): Promise<Training | undefined> => {
    try {
        const q = query(collection(db, 'trainings'), where('accessCode', '==', code.toUpperCase()), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data() as Training;
        }
        return undefined;
    } catch (error) {
        console.error("Error getting training by code:", error);
        return undefined;
    }
};

// --- RESPONSES ---

export const getResponses = async (trainingId: string): Promise<Response[]> => {
    try {
        const q = query(collection(db, 'responses'), where('trainingId', '==', trainingId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Response);
    } catch (error) {
        console.error("Error getting responses:", error);
        return [];
    }
};

export const saveResponse = async (response: Response): Promise<void> => {
    try {
        const cleanResponse = sanitizeData(response);
        await setDoc(doc(db, 'responses', response.id), cleanResponse);
    } catch (error) {
        console.error("Error saving response:", error);
        throw error;
    }
};

// NEW FUNCTION: Check if participant limit is reached for a specific context
export const checkParticipantLimitReached = async (
    trainingId: string, 
    limitVal: number, 
    type: 'facilitator' | 'process', 
    targetName?: string, 
    targetSubject?: string
): Promise<boolean> => {
    try {
        const coll = collection(db, 'responses');
        let q;

        if (type === 'facilitator') {
            q = query(
                coll,
                where('trainingId', '==', trainingId),
                where('type', '==', 'facilitator'),
                where('targetName', '==', targetName),
                where('targetSubject', '==', targetSubject)
            );
        } else {
            q = query(
                coll,
                where('trainingId', '==', trainingId),
                where('type', '==', 'process')
            );
        }

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count >= limitVal;
    } catch (error) {
        console.error("Error checking participant limit:", error);
        return false; // Fail safe: allow submission if check fails
    }
};

// UPDATED: Case-insensitive delete
export const deleteFacilitatorResponses = async (trainingId: string, facilitatorName: string): Promise<void> => {
    try {
        // Query all facilitator responses for this training
        const q = query(
            collection(db, 'responses'), 
            where('trainingId', '==', trainingId),
            where('type', '==', 'facilitator')
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return;

        const targetLower = facilitatorName.trim().toLowerCase();
        const batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach((doc) => {
            const data = doc.data() as Response;
            // Case-insensitive check
            if (data.targetName && data.targetName.trim().toLowerCase() === targetLower) {
                batch.delete(doc.ref);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Error deleting facilitator responses:", error);
        throw error;
    }
};

// --- NEW FEATURE: RENAME FACILITATOR (SUPERADMIN) - Case Insensitive ---
export const renameFacilitator = async (trainingId: string, oldName: string, newName: string): Promise<void> => {
    try {
        const batch = writeBatch(db);
        const oldNameLower = oldName.trim().toLowerCase();

        // 1. Update Training Document (Facilitator Array)
        const trainingRef = doc(db, 'trainings', trainingId);
        const trainingSnap = await getDoc(trainingRef);
        
        if (!trainingSnap.exists()) throw new Error("Pelatihan tidak ditemukan");
        
        const trainingData = trainingSnap.data() as Training;
        
        // Find ALL entries matching the name (case insensitive)
        const updatedFacilitators = trainingData.facilitators.map(f => 
            f.name.trim().toLowerCase() === oldNameLower ? { ...f, name: newName } : f
        );
        
        batch.update(trainingRef, { facilitators: updatedFacilitators });

        // 2. Update All Related Responses (Fetch all then filter locally)
        const q = query(
            collection(db, 'responses'), 
            where('trainingId', '==', trainingId),
            where('type', '==', 'facilitator')
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach((doc) => {
            const data = doc.data() as Response;
            if (data.targetName && data.targetName.trim().toLowerCase() === oldNameLower) {
                batch.update(doc.ref, { targetName: newName });
            }
        });

        await batch.commit();
    } catch (error) {
        console.error("Error renaming facilitator:", error);
        throw error;
    }
};

// --- NEW FEATURE: TOGGLE VISIBILITY (SUPERADMIN) - Case Insensitive ---
export const toggleFacilitatorVisibility = async (trainingId: string, facilitatorName: string, isHidden: boolean): Promise<void> => {
    try {
        const trainingRef = doc(db, 'trainings', trainingId);
        const trainingSnap = await getDoc(trainingRef);
        
        if (!trainingSnap.exists()) throw new Error("Pelatihan tidak ditemukan");
        
        const trainingData = trainingSnap.data() as Training;
        const targetLower = facilitatorName.trim().toLowerCase();

        // Update all entries with this name (incase of multiple subjects)
        const updatedFacilitators = trainingData.facilitators.map(f => 
            f.name.trim().toLowerCase() === targetLower ? { ...f, isHidden: isHidden } : f
        );
        
        await setDoc(trainingRef, { ...trainingData, facilitators: updatedFacilitators });
    } catch (error) {
        console.error("Error toggling visibility:", error);
        throw error;
    }
};

// --- NEW FEATURE: UPDATE SUBJECT / MATERI (SUPERADMIN) - Case Insensitive ---
export const updateFacilitatorSubject = async (
    trainingId: string, 
    facilitatorName: string, 
    oldSubject: string, 
    newSubject: string
): Promise<void> => {
    try {
        if (oldSubject === newSubject) return;
        const batch = writeBatch(db);
        const nameLower = facilitatorName.trim().toLowerCase();
        const subjectLower = oldSubject.trim().toLowerCase();

        // 1. Update Training Document
        const trainingRef = doc(db, 'trainings', trainingId);
        const trainingSnap = await getDoc(trainingRef);
        if (!trainingSnap.exists()) throw new Error("Pelatihan tidak ditemukan");
        
        const trainingData = trainingSnap.data() as Training;
        
        // Find the specific entry by Name AND Subject
        const updatedFacilitators = trainingData.facilitators.map(f => 
            (f.name.trim().toLowerCase() === nameLower && f.subject.trim().toLowerCase() === subjectLower) 
                ? { ...f, subject: newSubject } 
                : f
        );
        
        batch.update(trainingRef, { facilitators: updatedFacilitators });

        // 2. Update Related Responses
        const q = query(
            collection(db, 'responses'), 
            where('trainingId', '==', trainingId),
            where('type', '==', 'facilitator')
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach((doc) => {
            const data = doc.data() as Response;
            if (
                data.targetName && data.targetName.trim().toLowerCase() === nameLower &&
                data.targetSubject && data.targetSubject.trim().toLowerCase() === subjectLower
            ) {
                batch.update(doc.ref, { targetSubject: newSubject });
            }
        });

        await batch.commit();
    } catch (error) {
        console.error("Error updating subject:", error);
        throw error;
    }
};

// --- NEW FEATURE: UPDATE FACILITATOR ORDER (MANUAL SORTING) ---
export const updateFacilitatorsOrder = async (trainingId: string, facilitators: Facilitator[]): Promise<void> => {
    try {
        const trainingRef = doc(db, 'trainings', trainingId);
        // Only updating the facilitators field
        await setDoc(trainingRef, { facilitators: facilitators }, { merge: true });
    } catch (error) {
        console.error("Error updating facilitator order:", error);
        throw error;
    }
};

// --- NEW FEATURE: SYNC METADATA UPDATE (CreateTraining) ---
export const updateResponseMetadata = async (
    trainingId: string, 
    oldName: string, 
    oldSubject: string, 
    newName: string, 
    newSubject: string
): Promise<void> => {
    try {
        if (oldName === newName && oldSubject === newSubject) return;

        const q = query(
            collection(db, 'responses'),
            where('trainingId', '==', trainingId),
            where('type', '==', 'facilitator')
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        const oldNameLower = oldName.trim().toLowerCase();
        const oldSubjectLower = oldSubject.trim().toLowerCase();

        snapshot.docs.forEach((doc) => {
            const data = doc.data() as Response;
            if (
                data.targetName && data.targetName.trim().toLowerCase() === oldNameLower &&
                data.targetSubject && data.targetSubject.trim().toLowerCase() === oldSubjectLower
            ) {
                batch.update(doc.ref, { 
                    targetName: newName,
                    targetSubject: newSubject
                });
            }
        });

        await batch.commit();
        console.log(`Updated responses for ${oldName} (${oldSubject}) -> ${newName} (${newSubject})`);
    } catch (error) {
        console.error("Error updating response metadata:", error);
        throw error;
    }
};

// --- GLOBAL QUESTIONS ---

export const getGlobalQuestions = async (): Promise<GlobalQuestion[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'global_questions'));
        return snapshot.docs.map(doc => doc.data() as GlobalQuestion);
    } catch (error) {
        return [];
    }
};

export const saveGlobalQuestion = async (question: GlobalQuestion): Promise<void> => {
    const cleanQuestion = sanitizeData(question);
    await setDoc(doc(db, 'global_questions', question.id), cleanQuestion);
};

export const deleteGlobalQuestion = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'global_questions', id));
};

// --- THEMES ---

export const getThemes = async (): Promise<TrainingTheme[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'themes'));
        return snapshot.docs.map(doc => doc.data() as TrainingTheme);
    } catch (error) {
        return [];
    }
};

export const saveTheme = async (theme: TrainingTheme): Promise<void> => {
    const cleanTheme = sanitizeData(theme);
    await setDoc(doc(db, 'themes', theme.id), cleanTheme);
};

export const deleteTheme = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'themes', id));
};

// --- CONTACTS ---

export const getContacts = async (): Promise<Contact[]> => {
    try {
        const q = query(collection(db, 'contacts'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Contact);
    } catch (error) {
        return [];
    }
};

export const saveContact = async (contact: Contact): Promise<void> => {
    const cleanContact = sanitizeData(contact);
    await setDoc(doc(db, 'contacts', contact.id), cleanContact);
};

export const deleteContact = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'contacts', id));
};

// --- GUEST BOOK ---

export const getGuestEntries = async (): Promise<GuestEntry[]> => {
    try {
        const q = query(collection(db, 'guest_entries'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as GuestEntry);
    } catch (error) {
        return [];
    }
};

export const saveGuestEntry = async (entry: GuestEntry): Promise<void> => {
    const cleanEntry = sanitizeData(entry);
    await setDoc(doc(db, 'guest_entries', entry.id), cleanEntry);
};

export const clearGuestEntries = async (): Promise<void> => {
    const snapshot = await getDocs(collection(db, 'guest_entries'));
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};

// --- SETTINGS ---

export const getSettings = async (): Promise<AppSettings> => {
    try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as AppSettings;
        }
        // Fallback default
        return {
            waApiKey: '',
            waBaseUrl: 'https://api.fonnte.com/send',
            waHeader: 'SIMEP Report',
            waFooter: 'Terima Kasih',
            defaultTrainingDescription: '',
            isGuestBookOpen: false,
            adminPassword: '12345',
            superAdminPassword: 'supersimep',
            deletePassword: 'adm123',
            signatureTitle: 'Kepala Seksi Penyelenggaraan Pelatihan',
            signatureName: 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.',
            signatureNIP: '19710124 199703 1 004'
        };
    } catch (error) {
        console.error("Error getting settings:", error);
        return {
            waApiKey: '',
            waBaseUrl: 'https://api.fonnte.com/send',
            waHeader: 'SIMEP Report',
            waFooter: 'Terima Kasih',
            defaultTrainingDescription: '',
            isGuestBookOpen: false,
            adminPassword: '12345',
            superAdminPassword: 'supersimep',
            deletePassword: 'adm123',
            signatureTitle: 'Kepala Seksi Penyelenggaraan Pelatihan',
            signatureName: 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.',
            signatureNIP: '19710124 199703 1 004'
        };
    }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    const cleanSettings = sanitizeData(settings);
    await setDoc(doc(db, 'settings', 'global'), cleanSettings);
};

// --- DANGEROUS: RESET ALL ---
export const resetApplicationData = async (): Promise<void> => {
    const collections = ['trainings', 'responses', 'contacts', 'themes', 'guest_entries'];
    
    for (const colName of collections) {
        const snapshot = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
    localStorage.removeItem(RESPONDENT_HISTORY_KEY);
};

// --- RESPONDENT HISTORY (Local Storage - Tetap di Client) ---
// Ini tetap menggunakan LocalStorage karena kita melacak status *peramban* responden untuk UX,
// agar mereka tidak mengisi ulang form yang sama secara tidak sengaja.
// Data ini tidak sensitif untuk disimpan di server.

export const getRespondentHistory = (trainingId: string): string[] => {
    try {
        const histStr = localStorage.getItem(RESPONDENT_HISTORY_KEY);
        if (!histStr) return [];
        const hist = JSON.parse(histStr);
        return hist[trainingId] || [];
    } catch (e) {
        return [];
    }
};

export const saveRespondentHistory = (trainingId: string, facilitatorId: string): void => {
    try {
        const histStr = localStorage.getItem(RESPONDENT_HISTORY_KEY);
        let hist = histStr ? JSON.parse(histStr) : {};
        
        if (!hist[trainingId]) {
            hist[trainingId] = [];
        }
        
        if (!hist[trainingId].includes(facilitatorId)) {
            hist[trainingId].push(facilitatorId);
            localStorage.setItem(RESPONDENT_HISTORY_KEY, JSON.stringify(hist));
        }
    } catch (e) {
        console.error("Failed to save history locally", e);
    }
};

// --- EXPORT/IMPORT (JSON Backup) ---
export const exportAllData = async (): Promise<string> => {
    const [trainings, responses, globalQuestions, contacts, themes, guestEntries, settings] = await Promise.all([
        getTrainings(),
        getDocs(collection(db, 'responses')).then(s => s.docs.map(d => d.data())),
        getGlobalQuestions(),
        getContacts(),
        getThemes(),
        getGuestEntries(),
        getSettings()
    ]);

    const data = {
        trainings,
        responses,
        globalQuestions,
        contacts,
        themes,
        guestEntries,
        settings,
        exportedAt: new Date().toISOString(),
        version: '4.0-firebase'
    };
    return JSON.stringify(data, null, 2);
};

export const importAllData = async (jsonString: string): Promise<boolean> => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.trainings) throw new Error('Format data tidak valid');
        
        const batchSize = 500; // Firestore batch limit
        let batch = writeBatch(db);
        let count = 0;

        const commitBatch = async () => {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
        };

        const addToBatch = async (col: string, item: any) => {
            const cleanItem = sanitizeData(item);
            batch.set(doc(db, col, item.id), cleanItem);
            count++;
            if (count >= batchSize) await commitBatch();
        };

        if(data.trainings) for(const i of data.trainings) await addToBatch('trainings', i);
        if(data.responses) for(const i of data.responses) await addToBatch('responses', i);
        if(data.globalQuestions) for(const i of data.globalQuestions) await addToBatch('global_questions', i);
        if(data.contacts) for(const i of data.contacts) await addToBatch('contacts', i);
        if(data.themes) for(const i of data.themes) await addToBatch('themes', i);
        if(data.guestEntries) for(const i of data.guestEntries) await addToBatch('guest_entries', i);
        if(data.settings) batch.set(doc(db, 'settings', 'global'), sanitizeData(data.settings));

        if (count > 0) await commitBatch();
        
        return true;
    } catch (error) {
        console.error('Import failed:', error);
        return false;
    }
};