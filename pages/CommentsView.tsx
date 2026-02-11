
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTrainingById, getResponses } from '../services/storageService';
import { Training, Response, QuestionType } from '../types';
import { MessageSquare, Calendar, BookOpen, ArrowLeft, Quote, Award, BarChart2 } from 'lucide-react';

export const CommentsView: React.FC = () => {
  const { trainingId, facilitatorId } = useParams<{ trainingId: string; facilitatorId: string }>();
  const [training, setTraining] = useState<Training | undefined>(undefined);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (trainingId) {
        const tData = await getTrainingById(trainingId);
        const rData = await getResponses(trainingId);
        setTraining(tData);
        setResponses(rData);
        setLoading(false);
      }
    };
    fetchData();
  }, [trainingId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Memuat Laporan...</div>;
  if (!training || !facilitatorId) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">Data tidak ditemukan.</div>;

  // --- LOGIC: HANDLE BOTH FACILITATOR AND PROCESS VIEW ---
  // Jika ID adalah 'process', tampilkan data Penyelenggaraan
  const isProcessView = facilitatorId === 'process';
  
  let targetName = '';
  let targetSubject = '';
  let targetDate = '';
  let targetResponses: Response[] = [];
  let targetQuestions: any[] = [];

  if (isProcessView) {
      // Setup for Process Evaluation
      targetName = "Evaluasi Penyelenggaraan";
      targetSubject = "Fasilitas & Layanan";
      // Gunakan tanggal evaluasi penyelenggaraan atau tanggal akhir pelatihan
      targetDate = training.processEvaluationDate || training.endDate;
      targetResponses = responses.filter(r => r.type === 'process');
      targetQuestions = training.processQuestions;
  } else {
      // Setup for Facilitator Evaluation
      const facilitator = training.facilitators.find(f => f.id === facilitatorId);
      if (!facilitator) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">Fasilitator tidak ditemukan.</div>;
      
      targetName = facilitator.name;
      targetSubject = facilitator.subject;
      targetDate = facilitator.sessionDate;
      targetResponses = responses.filter(r => 
        r.type === 'facilitator' && 
        r.targetName === facilitator.name && 
        r.targetSubject === facilitator.subject
      );
      targetQuestions = training.facilitatorQuestions;
  }

  // Helper date format
  const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper Score Label
  const getScoreLabel = (val: number, type: QuestionType) => {
      if (type === 'star') {
          if (val >= 4.2) return 'Sangat Baik';
          if (val >= 3.4) return 'Baik';
          if (val >= 2.6) return 'Cukup';
          if (val >= 1.8) return 'Sedang';
          return 'Kurang';
      } else {
          if (val >= 86) return 'Sangat Baik';
          if (val >= 76) return 'Baik';
          if (val >= 56) return 'Sedang';
          return 'Kurang';
      }
  };

  const getLabelColor = (val: number, type: QuestionType) => {
      if (type === 'star') {
          if (val >= 4.2) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
          if (val >= 3.4) return 'text-blue-600 bg-blue-50 border-blue-200';
          if (val >= 2.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
          if (val >= 1.8) return 'text-orange-600 bg-orange-50 border-orange-200';
          return 'text-red-600 bg-red-50 border-red-200';
      } else {
          if (val >= 86) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
          if (val >= 76) return 'text-blue-600 bg-blue-50 border-blue-200';
          if (val >= 56) return 'text-orange-600 bg-orange-50 border-orange-200';
          return 'text-red-600 bg-red-50 border-red-200';
      }
  };

  // --- STATS CALCULATION ---
  
  // 1. Calculate Average per Question
  const variableStats = targetQuestions.filter(q => q.type !== 'text').map(q => {
      const valid = targetResponses.filter(r => typeof r.answers[q.id] === 'number');
      let avg = 0;
      if (valid.length > 0) {
          const sum = valid.reduce((acc, curr) => acc + (curr.answers[q.id] as number), 0);
          avg = Number((sum / valid.length).toFixed(2));
      }
      return { question: q, average: avg };
  });

  // 2. Calculate Percentage Distribution (For Process View Table)
  const calculateDistribution = (qId: string, type: QuestionType) => {
    const counts = { k: 0, s: 0, b: 0, sb: 0, total: 0 };
    targetResponses.forEach(r => {
        const val = r.answers[qId];
        if (typeof val === 'number') {
            counts.total++;
            if (type === 'star') {
                if (val <= 1) counts.k++;
                else if (val <= 3) counts.s++;
                else if (val === 4) counts.b++;
                else if (val === 5) counts.sb++;
            } else {
                if (val <= 55) counts.k++;
                else if (val <= 75) counts.s++;
                else if (val <= 85) counts.b++;
                else counts.sb++;
            }
        }
    });

    if (counts.total === 0) return { k: '0.0', s: '0.0', b: '0.0', sb: '0.0' };
    
    return {
        k: ((counts.k / counts.total) * 100).toFixed(1),
        s: ((counts.s / counts.total) * 100).toFixed(1),
        b: ((counts.b / counts.total) * 100).toFixed(1),
        sb: ((counts.sb / counts.total) * 100).toFixed(1)
    };
  };

  // 3. Calculate Overall Average
  let totalSum = 0;
  let totalCount = 0;
  let dominantType: QuestionType = 'slider';

  targetQuestions.forEach(q => {
      if (q.type !== 'text') {
          dominantType = q.type; // Capture last type used
          const valid = targetResponses.filter(r => typeof r.answers[q.id] === 'number');
          if (valid.length > 0) {
              const qSum = valid.reduce((acc, curr) => acc + (curr.answers[q.id] as number), 0);
              const qAvg = qSum / valid.length;
              totalSum += qAvg;
              totalCount++;
          }
      }
  });

  const overallAvg = totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : 0;
  const overallLabel = getScoreLabel(overallAvg, dominantType);
  const overallColor = getLabelColor(overallAvg, dominantType);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="bg-indigo-600 pb-20 pt-10 px-4">
        <div className="max-w-4xl mx-auto text-white">
            <div className="flex items-center gap-2 mb-4 opacity-80">
                <Link to="/" className="hover:bg-white/20 p-1 rounded transition"><ArrowLeft size={20}/></Link>
                <span className="text-sm font-medium tracking-wide uppercase">Hasil Evaluasi {isProcessView ? 'Penyelenggaraan' : 'Sesi'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{targetName}</h1>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-indigo-100 text-sm">
                <div className="flex items-center gap-2"><BookOpen size={16}/> <span>{targetSubject}</span></div>
                <div className="flex items-center gap-2"><Calendar size={16}/> <span>{formatDateID(targetDate)}</span></div>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-10 pb-20 space-y-6">
        
        {/* 1. SCORE SUMMARY CARD */}
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
            <div className="flex items-center gap-4 z-10 w-full sm:w-auto">
                <div className="bg-indigo-50 p-4 rounded-full text-indigo-600">
                    <Award size={32} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Performa {isProcessView ? 'Penyelenggaraan' : 'Sesi'}</h2>
                    <p className="text-slate-500 text-xs">Berdasarkan {targetResponses.length} Responden</p>
                </div>
            </div>
            <div className="flex items-center gap-4 z-10 bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 w-full sm:w-auto justify-between sm:justify-start">
                 <div className="text-right">
                    <div className="text-3xl font-bold text-slate-900 leading-none">{overallAvg}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Rata-rata</div>
                 </div>
                 <div className={`px-4 py-2 rounded-lg border-2 font-bold text-xs uppercase tracking-wide shadow-sm ${overallColor}`}>
                    {overallLabel}
                 </div>
            </div>
        </div>

        {/* 2. VARIABLE BREAKDOWN (TABLE FOR PROCESS, GRID FOR FACILITATOR) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <BarChart2 className="text-slate-400" size={20}/>
                <h3 className="font-bold text-slate-800">Rincian Nilai Variabel</h3>
            </div>
            
            {isProcessView ? (
                // TABLE VIEW FOR PROCESS EVALUATION
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-bold w-10 text-center text-xs">NO</th>
                                <th className="px-4 py-3 font-bold min-w-[200px] text-xs uppercase">Hal-Hal Yang Dievaluasi</th>
                                <th className="px-4 py-3 font-bold text-center w-20 text-xs uppercase">Kurang</th>
                                <th className="px-4 py-3 font-bold text-center w-20 text-xs uppercase">Sedang</th>
                                <th className="px-4 py-3 font-bold text-center w-20 text-xs uppercase">Baik</th>
                                <th className="px-4 py-3 font-bold text-center w-20 text-xs uppercase">Sgt.Baik</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {targetQuestions.filter(q => q.type !== 'text').map((q, idx) => {
                                const dist = calculateDistribution(q.id, q.type);
                                
                                // FIND HIGHEST VALUE
                                const valK = parseFloat(dist.k);
                                const valS = parseFloat(dist.s);
                                const valB = parseFloat(dist.b);
                                const valSb = parseFloat(dist.sb);
                                const maxVal = Math.max(valK, valS, valB, valSb);
                                
                                // Helper class function - MODIFIED: Removed bg-slate-100
                                const getStyle = (val: number) => val === maxVal && maxVal > 0 ? 'font-extrabold text-slate-900' : 'text-slate-500';

                                return (
                                    <tr key={q.id} className="hover:bg-slate-50 transition">
                                        <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                                        <td className="px-4 py-3 text-slate-800 font-medium text-xs md:text-sm">{q.label}</td>
                                        <td className={`px-4 py-3 text-center border-l border-slate-50 text-xs ${getStyle(valK)}`}>{dist.k}%</td>
                                        <td className={`px-4 py-3 text-center border-l border-slate-50 text-xs ${getStyle(valS)}`}>{dist.s}%</td>
                                        <td className={`px-4 py-3 text-center border-l border-slate-50 text-xs ${getStyle(valB)}`}>{dist.b}%</td>
                                        <td className={`px-4 py-3 text-center border-l border-slate-50 text-xs ${getStyle(valSb)}`}>{dist.sb}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                // GRID VIEW FOR FACILITATOR (EXISTING STYLE)
                <div className="p-5 grid gap-3 sm:grid-cols-2">
                    {variableStats.length > 0 ? variableStats.map((stat, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                            <span className="text-xs font-semibold text-slate-700 line-clamp-2 w-2/3" title={stat.question.label}>
                                {stat.question.label}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-800">{stat.average}</span>
                                <div className={`w-2 h-2 rounded-full ${stat.average >= (stat.question.type === 'star' ? 3.4 : 76) ? 'bg-emerald-500' : (stat.average >= (stat.question.type === 'star' ? 1.8 : 56) ? 'bg-yellow-500' : 'bg-red-500')}`}></div>
                            </div>
                        </div>
                    )) : <div className="col-span-full text-center text-slate-400 text-sm italic">Tidak ada variabel nilai.</div>}
                </div>
            )}
        </div>

        {/* 3. COMMENTS LIST */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="text-indigo-600" size={20}/>
                    Pesan & Masukan
                </h2>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    Real-time
                </span>
            </div>

            <div className="divide-y divide-slate-100">
                {targetQuestions.filter(q => q.type === 'text').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">Tidak ada pertanyaan isian teks dalam evaluasi ini.</div>
                ) : (
                    targetQuestions.filter(q => q.type === 'text').map(question => {
                        // Extract answers for this question
                        const answers = targetResponses
                            .map(r => r.answers[question.id])
                            .filter(a => typeof a === 'string' && a.trim() !== '') as string[];

                        return (
                            <div key={question.id} className="p-6">
                                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide border-l-4 border-indigo-500 pl-3">
                                    {question.label}
                                </h3>
                                
                                {answers.length > 0 ? (
                                    <div className="space-y-3">
                                        {answers.map((ans, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative group hover:border-indigo-200 transition-colors">
                                                <Quote size={24} className="absolute top-2 left-2 text-slate-200 group-hover:text-indigo-100 transition-colors" />
                                                <p className="relative z-10 text-slate-700 text-sm leading-relaxed pl-4 italic">
                                                    "{ans}"
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                        Belum ada pesan untuk kategori ini.
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-xs text-slate-400">Pesan ini bersifat anonim dari responden pelatihan {training.title}.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
