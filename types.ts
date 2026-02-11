
export type QuestionType = 'star' | 'slider' | 'text';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
}

export interface GlobalQuestion extends Question {
  category: 'facilitator' | 'process';
  isDefault: boolean;
}

export interface TrainingTheme {
  id: string;
  name: string;
  facilitatorQuestions: Question[];
  processQuestions: Question[];
}

export interface Contact {
  id: string;
  name: string;
  whatsapp: string;
  jobTitle?: string; // Jabatan
  unit?: string;     // Unit Kerja
  address?: string;  // Alamat
}

export interface Facilitator {
  id: string;
  name: string;
  subject: string;
  sessionDate: string;
  sessionStartTime?: string; // New: Waktu mulai sesi (HH:mm)
  whatsapp?: string; 
  isOpen?: boolean; 
  order?: number; 
}

export interface Training {
  id: string;
  accessCode: string; 
  title: string;
  description?: string; 
  startDate: string;
  endDate: string;
  processEvaluationDate: string;
  facilitators: Facilitator[];
  facilitatorQuestions: Question[];
  processQuestions: Question[];
  createdAt: number;
  
  // New Optional Information Fields
  learningMethod?: string; // Klasikal, Blended, Daring Learning
  location?: string;       // Malang, Surabaya, Madiun
  participantLimit?: number; // Batas maksimal responden
  allowManualInput?: boolean; // Izin input manual fasilitator oleh responden

  // Automation Features
  targets?: number[]; 
  reportedTargets?: Record<string, boolean>; 

  // Process Automation
  processOrganizer?: Contact; // Penanggung Jawab Penyelenggaraan
  processTargets?: number[]; // Multi-targets for process
  processTarget?: number; // Deprecated (Single target)
  processReported?: boolean; // Deprecated (Single flag)
}

export interface Response {
  id: string;
  trainingId: string;
  type: 'facilitator' | 'process';
  targetName?: string; 
  targetSubject?: string; 
  answers: Record<string, string | number>; 
  timestamp: number;
}

export interface GuestEntry {
  id: string;
  name: string;
  institution: string;
  timestamp: number;
}

export interface AppSettings {
  waApiKey: string;
  waBaseUrl: string;
  waHeader: string;
  waFooter: string;
  defaultTrainingDescription?: string; 
  isGuestBookOpen?: boolean;
  
  // Security Settings
  adminPassword?: string;
  superAdminPassword?: string;
  deletePassword?: string;

  // Signature Settings (TTD)
  signatureTitle?: string;
  signatureName?: string;
  signatureNIP?: string;
}