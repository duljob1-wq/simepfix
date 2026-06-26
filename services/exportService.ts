
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle, PageBreak, UnderlineType, VerticalAlign } from 'docx';
import saveAs from 'file-saver';
import { Training, Response, QuestionType } from '../types';
import { getResponses, getSettings } from './storageService';

// Helper untuk format tanggal Indonesia
const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper Logic for Labeling
const getScoreLabel = (val: number, type: QuestionType) => {
    if (type === 'text') return '';
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

// HELPER: Calculate Percentage Distribution
const calculateDistributionExport = (responses: Response[], qId: string, type: QuestionType) => {
    const counts = { k: 0, s: 0, b: 0, sb: 0, total: 0 };
    responses.forEach(r => {
        const val = r.answers[qId];
        if (typeof val === 'number') {
            counts.total++;
            if (type === 'star') {
                if (val <= 1) counts.k++;
                else if (val <= 3) counts.s++;
                else if (val === 4) counts.b++;
                else if (val === 5) counts.sb++;
            } else { // Slider
                if (val <= 55) counts.k++;
                else if (val <= 75) counts.s++;
                else if (val <= 85) counts.b++;
                else counts.sb++;
            }
        }
    });

    if (counts.total === 0) return { k: '0.0%', s: '0.0%', b: '0.0%', sb: '0.0%' };
    
    return {
        k: ((counts.k / counts.total) * 100).toFixed(1) + '%',
        s: ((counts.s / counts.total) * 100).toFixed(1) + '%',
        b: ((counts.b / counts.total) * 100).toFixed(1) + '%',
        sb: ((counts.sb / counts.total) * 100).toFixed(1) + '%'
    };
};

// Helper: Split array into chunks for 2-column layout
const splitCommentsToPairs = (comments: string[]) => {
    const half = Math.ceil(comments.length / 2);
    const left = comments.slice(0, half);
    const right = comments.slice(half);
    const rows = [];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        rows.push([
            left[i] ? `•  ${left[i]}` : '', // Added extra space after bullet
            right[i] ? `•  ${right[i]}` : ''
        ]);
    }
    return rows;
};

interface SessionExportData {
    name: string; 
    subject: string;
    sessionDate: string;
    order: number; 
    responses: Response[];
    averages: Record<string, string>; 
    comments: Record<string, string[]>;
    overall: string;
    overallVal: number;
}

const processDataForExport = (training: Training, responses: Response[]) => {
  const result: any = {
    facilitators: {} as Record<string, SessionExportData[]>,
    process: {
      responses: [],
      averages: {},
      rawAverages: {}, 
      comments: {},
      distributions: {}, 
      overall: '', 
      overallVal: 0
    }
  };

  responses.filter(r => r.type === 'facilitator').forEach(r => {
    const name = r.targetName || 'Unknown';
    const subject = r.targetSubject || 'Umum';

    if (!result.facilitators[name]) {
        result.facilitators[name] = [];
    }

    let session = result.facilitators[name].find((s: SessionExportData) => s.subject === subject);
    
    if (!session) {
        const facData = training.facilitators.find(f => f.name === name && f.subject === subject);
        session = {
            name: name,
            subject: subject,
            sessionDate: facData ? facData.sessionDate : '',
            order: facData ? (facData.order || 0) : 0,
            responses: [],
            averages: {},
            comments: {},
            overall: '',
            overallVal: 0
        };
        result.facilitators[name].push(session);
    }
    session.responses.push(r);
  });

  Object.keys(result.facilitators).forEach(name => {
      const sessions = result.facilitators[name] as SessionExportData[];
      sessions.forEach(session => {
          let totalFacScore = 0;
          let totalFacCount = 0;
          let dominantType: QuestionType = 'slider';

          training.facilitatorQuestions.forEach(q => {
            if (q.type === 'text') {
                session.comments[q.id] = session.responses
                    .filter((r: any) => !r.hiddenAnswers?.includes(q.id))
                    .map((r: any) => r.answers[q.id])
                    .filter((a: any) => a && a.trim() !== '');
            } else {
                dominantType = q.type;
                const scores = session.responses.map((r: any) => r.answers[q.id]).filter((v: any) => typeof v === 'number');
                const avg = scores.length ? scores.reduce((a: any, b: any) => a + b, 0) / scores.length : 0;
                
                totalFacScore += avg;
                totalFacCount++;

                const label = getScoreLabel(avg, q.type);
                session.averages[q.id] = `${avg.toFixed(2)} (${label})`;
            }
          });

          if (totalFacCount > 0) {
            const overallAvg = totalFacScore / totalFacCount;
            session.overallVal = overallAvg;
            session.overall = `${overallAvg.toFixed(2)} (${getScoreLabel(overallAvg, dominantType)})`;
        } else {
            session.overall = '0.00 (Kurang)';
            session.overallVal = 0;
        }
      });
  });

  const procResponses = responses.filter(r => r.type === 'process');
  result.process.responses = procResponses;
  let totalProcScore = 0;
  let totalProcCount = 0;
  let dominantProcType: QuestionType = 'slider';

  training.processQuestions.forEach(q => {
    if (q.type === 'text') {
      result.process.comments[q.id] = procResponses
          .filter((r: any) => !r.hiddenAnswers?.includes(q.id))
          .map((r: any) => r.answers[q.id])
          .filter((a: any) => a && a.trim() !== '');
    } else {
      dominantProcType = q.type;
      const scores = procResponses.map((r: any) => r.answers[q.id]).filter((v: any) => typeof v === 'number');
      const avg = scores.length ? scores.reduce((a: any, b: any) => a + b, 0) / scores.length : 0;
      result.process.rawAverages[q.id] = avg;
      
      result.process.distributions[q.id] = calculateDistributionExport(procResponses, q.id, q.type);

      totalProcScore += avg;
      totalProcCount++;

      const label = getScoreLabel(avg, q.type);
      result.process.averages[q.id] = `${avg.toFixed(2)} (${label})`;
    }
  });

  if (totalProcCount > 0) {
      const overallAvg = totalProcScore / totalProcCount;
      result.process.overallVal = overallAvg;
      result.process.overall = `${overallAvg.toFixed(2)} (${getScoreLabel(overallAvg, dominantProcType)})`;
  } else {
      result.process.overall = '0.00 (Kurang)';
  }

  return result;
};

const getFlatChronologicalSessions = (dataFacilitators: Record<string, SessionExportData[]>) => {
    let allSessions: SessionExportData[] = [];
    Object.values(dataFacilitators).forEach(sessions => {
        allSessions = [...allSessions, ...sessions];
    });
    return allSessions.sort((a, b) => {
        if (a.sessionDate < b.sessionDate) return -1;
        if (a.sessionDate > b.sessionDate) return 1;
        return a.order - b.order;
    });
};

const getSortedFacilitatorNamesForRecap = (dataFacilitators: Record<string, SessionExportData[]>, training: Training) => {
    const names = Object.keys(dataFacilitators).sort((a, b) => {
        const facA = training.facilitators.find(f => f.name === a);
        const facB = training.facilitators.find(f => f.name === b);
        const orderA = facA?.order || 0;
        const orderB = facB?.order || 0;
        return orderA - orderB;
    });
    names.forEach(name => {
        dataFacilitators[name].sort((a, b) => {
            if (a.sessionDate < b.sessionDate) return -1;
            if (a.sessionDate > b.sessionDate) return 1;
            return 0;
        });
    });
    return names;
};

// --- HELPER: ADD DYNAMIC PDF SIGNATURE ---
// TTD didekatkan dengan teks terakhir (+ jarak 1/2 baris)
const addPdfSignatureDynamic = (doc: jsPDF, settings: any, startY: number) => {
    const pageHeight = doc.internal.pageSize.height;
    // Jarak 1/2 baris (approx 5-6pt) + tinggi signature block
    const requiredSpace = 50; 
    let currentY = startY + 6; // Jarak 1/2 baris dari konten terakhir

    // Cek jika halaman tidak cukup
    if (currentY + requiredSpace > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
    }

    const sigCenterX = 150; // Posisi X (Kanan)

    const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
    const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
    const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sigTitle, sigCenterX, currentY, { align: 'center' });
    
    doc.setFont("helvetica", "bold");
    doc.text(sigName, sigCenterX, currentY + 25, { align: 'center' });
    
    const textWidth = doc.getTextWidth(sigName);
    doc.line(sigCenterX - (textWidth / 2), currentY + 26, sigCenterX + (textWidth / 2), currentY + 26);

    doc.setFont("helvetica", "normal");
    doc.text(sigNIP, sigCenterX, currentY + 30, { align: 'center' });
    
    // Return Y akhir untuk referensi jika dibutuhkan
    return currentY + 35;
};



export const exportToExcel = async (training: Training) => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);
  const wb = XLSX.utils.book_new();

  // Signature Rows (Reusable)
  const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
  const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
  const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';
  
  // TTD Dekat (Jarak 1/2 Baris - removed empty row buffer)
  const getSigRows = () => [
      ['', '', '', '', sigTitle],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', sigName],
      ['', '', '', '', sigNIP]
  ];

  const infoData = [
      ['Judul Pelatihan', training.title]
  ];

  let methodLocStr = '';
  if (training.learningMethod) methodLocStr += `Metode Pembelajaran ${training.learningMethod} `;
  if (training.location) methodLocStr += `Di UPT Pelatihan Kesehatan Masyarakat Kampus ${training.location}`;

  if (methodLocStr) {
      infoData.push(['Metode & Lokasi', methodLocStr.trim()]);
  }

  infoData.push(
      ['Periode', `${formatDateID(training.startDate)} s/d ${formatDateID(training.endDate)}`],
      ['Dicetak', formatDateID(new Date().toISOString())],
      []
  );

  const detailRows: any[] = [...infoData, ['A. DETAIL EVALUASI FASILITATOR'], []];
  
  const flatSessions = getFlatChronologicalSessions(data.facilitators);

  flatSessions.forEach((session) => {
      // Find matching facilitator config to get custom labels and hidden IDs
      const facConfig = training.facilitators.find(f => 
          f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
          f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
      );

      const hiddenIds = facConfig?.hiddenQuestionIds || [];
      const customLabels = facConfig?.customLabels || {};

      // 1. Map questions with custom labels
      const mappedQuestions = training.facilitatorQuestions.map(q => ({
          ...q,
          label: customLabels[q.id] || q.label
      }));

      // 2. Group questions by label
      const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
      mappedQuestions.forEach(q => {
          const key = q.label.trim();
          if (!groups[key]) {
              groups[key] = { ids: [], type: q.type, label: q.label };
          }
          groups[key].ids.push(q.id);
      });
      const groupedQuestions = Object.values(groups);

      detailRows.push([`NAMA FASILITATOR: ${session.name}`]);
      detailRows.push([`Materi: ${session.subject}`, `Tanggal: ${formatDateID(session.sessionDate)}`]);
      
      detailRows.push(['Variabel', 'Nilai']);
      
      // Filter and Calculate Scores
      let totalScore = 0;
      let totalCount = 0;
      let dominantType: QuestionType = 'slider';

      groupedQuestions
          .filter(q => q.type !== 'text')
          .filter(q => !q.ids.every(id => hiddenIds.includes(id))) // Only show if NOT ALL hidden
          .forEach(q => {
              const avg = calculateGroupAverage(session.responses, q.ids);
              const label = getScoreLabel(avg, q.type);
              detailRows.push([q.label, `${avg.toFixed(2)} (${label})`]);
              
              totalScore += avg;
              totalCount++;
              dominantType = q.type;
          });

      const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
      const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

      detailRows.push(['Rata-rata Keseluruhan', sessionOverallStr]);

      const textQs = groupedQuestions.filter(q => q.type === 'text');
      if (textQs.length > 0) {
          detailRows.push(['Komentar / Saran Responden (Split):']);
          textQs.forEach(q => {
              const cmts = getGroupTextAnswers(session.responses, q.ids);
              if (cmts.length > 0) {
                 detailRows.push([`[${q.label}]`]);
                 // SPLIT COMMENTS 2 COLUMNS IN EXCEL
                 const split = splitCommentsToPairs(cmts);
                 split.forEach(row => {
                     // Row format: ['', left, right] to simulate spacing
                     detailRows.push(['', row[0], row[1]]);
                 });
              }
          });
      }
      detailRows.push(...getSigRows());
      detailRows.push([]); 
  });

  const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, detailWs, 'A. Detail Fasilitator');

  const summaryHeader = ['No', 'Nama Fasilitator', 'Materi', 'Tanggal', 'Nilai Akhir'];
  const summaryRows: any[] = [];
  let no = 1;
  let grandTotal = 0;
  let grandCount = 0;

  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);

  sortedNames.forEach((name) => {
    data.facilitators[name].forEach((session: SessionExportData) => {
        // Recalculate overall for recap as well to match detailed view
        const facConfig = training.facilitators.find(f => 
            f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
            f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
        );
        const hiddenIds = facConfig?.hiddenQuestionIds || [];
        const customLabels = facConfig?.customLabels || {};

        const mappedQuestions = training.facilitatorQuestions.map(q => ({
            ...q,
            label: customLabels[q.id] || q.label
        }));

        const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
        mappedQuestions.forEach(q => {
            const key = q.label.trim();
            if (!groups[key]) {
                groups[key] = { ids: [], type: q.type, label: q.label };
            }
            groups[key].ids.push(q.id);
        });
        const groupedQuestions = Object.values(groups);

        let totalScore = 0;
        let totalCount = 0;
        let dominantType: QuestionType = 'slider';

        groupedQuestions
            .filter(q => q.type !== 'text')
            .filter(q => !q.ids.every(id => hiddenIds.includes(id)))
            .forEach(q => {
                const avg = calculateGroupAverage(session.responses, q.ids);
                totalScore += avg;
                totalCount++;
                dominantType = q.type;
            });
        
        const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
        const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

        summaryRows.push([no++, name, session.subject || '-', formatDateID(session.sessionDate), sessionOverallStr]);
        grandTotal += sessionOverall;
        grandCount++;
    });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  summaryRows.push(['', '', '', 'RATA-RATA TOTAL', grandDisplay]);

  // Excel doesn't paginate physically, but we put signature right after
  const rekapFinalRows = [...infoData, ['B. REKAPITULASI NILAI KESELURUHAN'], [], summaryHeader, ...summaryRows, [], ...getSigRows()];

  const rekapWs = XLSX.utils.aoa_to_sheet(rekapFinalRows);
  XLSX.utils.book_append_sheet(wb, rekapWs, 'B. Rekapitulasi');

  // --- C. PENYELENGGARAAN ---
  const procRows: any[] = [...infoData, ['C. EVALUASI PENYELENGGARAAN']];
  
  if (training.processOrganizer && training.processOrganizer.name) {
      procRows.push([`Penanggung Jawab: ${training.processOrganizer.name}`]);
  }
  
  procRows.push([]);
  procRows.push(['No', 'Hal-hal yang dievaluasi', 'Kurang', 'Sedang', 'Baik', 'Sgt.Baik']);
  
  let procNo = 1;
  training.processQuestions.filter(q => q.type !== 'text').forEach(q => {
      const dist = data.process.distributions[q.id] || { k:'0.0%', s:'0.0%', b:'0.0%', sb:'0.0%' };
      procRows.push([
          procNo++,
          q.label, 
          dist.k, dist.s, dist.b, dist.sb
      ]);
  });
  
  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  if (procTextQs.length > 0) {
      procRows.push([]);
      procRows.push(['Komentar / Saran Penyelenggaraan (Split):']);
      procTextQs.forEach(q => {
          const cmts = data.process.comments[q.id];
          if (cmts && cmts.length > 0) {
             procRows.push([`[${q.label}]`]);
             // SPLIT 2 COLUMNS
             const split = splitCommentsToPairs(cmts);
             split.forEach(row => {
                 procRows.push(['', row[0], row[1]]);
             });
          }
      });
  }

  procRows.push(...getSigRows());

  const procWs = XLSX.utils.aoa_to_sheet(procRows);
  XLSX.utils.book_append_sheet(wb, procWs, 'C. Penyelenggaraan');

  XLSX.writeFile(wb, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.xlsx`);
};

// --- HELPER: Calculate Group Average ---
const calculateGroupAverage = (responses: Response[], qIds: string[]) => {
    let total = 0;
    let count = 0;
    responses.forEach(r => {
        qIds.forEach(qId => {
            const val = r.answers[qId];
            if (typeof val === 'number') {
                total += val;
                count++;
            }
        });
    });
    return count > 0 ? total / count : 0;
};

// --- HELPER: Get Group Text Answers ---
const getGroupTextAnswers = (responses: Response[], qIds: string[]) => {
    const answers: string[] = [];
    responses.forEach(r => {
        qIds.forEach(qId => {
            const isHidden = r.hiddenAnswers?.includes(qId) || false;
            if (isHidden) return;
            const val = r.answers[qId];
            if (val && typeof val === 'string' && val.trim() !== '') {
                answers.push(val.trim());
            }
        });
    });
    return answers;
};

export const exportToPDF = async (training: Training, mode: 'all' | 'facilitator' | 'organizer' = 'all') => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);
  const doc = new jsPDF();
  const timestamp = formatDateID(new Date().toISOString());

  // --- HALAMAN COVER ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  if (mode === 'all') {
      doc.text('Laporan Rekapitulasi Evaluasi Pelatihan', 14, 20);
  } else if (mode === 'facilitator') {
      doc.text('Laporan Evaluasi Pelatihan - Bagian Fasilitator', 14, 20);
  } else if (mode === 'organizer') {
      doc.text('Laporan Evaluasi Pelatihan - Bagian Penyelenggaraan', 14, 20);
  }
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const titleLines = doc.splitTextToSize(`Judul: ${training.title}`, 180);
  doc.text(titleLines, 14, 28);
  
  let y = 28 + (titleLines.length * 5); 
  
  let methodLocInfo = '';
  if (training.learningMethod) methodLocInfo += `Metode Pembelajaran ${training.learningMethod} `;
  if (training.location) methodLocInfo += `Di UPT Pelatihan Kesehatan Masyarakat Kampus ${training.location}`;
  
  if (methodLocInfo) {
      const mlLines = doc.splitTextToSize(methodLocInfo.trim(), 180);
      doc.text(mlLines, 14, y);
      y += (mlLines.length * 5);
  }

  doc.text(`Periode: ${formatDateID(training.startDate)} s/d ${formatDateID(training.endDate)}`, 14, y);
  y += 5;
  doc.text(`Dicetak pada: ${timestamp}`, 14, y);
  y += 10;

  // --- A. DETAIL FASILITATOR (CUSTOM VIEW) ---
  if (mode === 'all' || mode === 'facilitator') {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('A. Evaluasi Detail Fasilitator', 14, y);
    y += 2; 
    
    const flatSessions = getFlatChronologicalSessions(data.facilitators);

  flatSessions.forEach((session, index) => {
    if (index > 0) {
        doc.addPage();
        y = 20; 
    } else {
        y += 5;
    }

    // Find matching facilitator config to get custom labels and hidden IDs
    const facConfig = training.facilitators.find(f => 
        f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
        f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
    );

    const hiddenIds = facConfig?.hiddenQuestionIds || [];
    const customLabels = facConfig?.customLabels || {};

    // 1. Map questions with custom labels
    const mappedQuestions = training.facilitatorQuestions.map(q => ({
        ...q,
        label: customLabels[q.id] || q.label
    }));

    // 2. Group questions by label
    const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
    mappedQuestions.forEach(q => {
        const key = q.label.trim();
        if (!groups[key]) {
            groups[key] = { ids: [], type: q.type, label: q.label };
        }
        groups[key].ids.push(q.id);
    });
    const groupedQuestions = Object.values(groups);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 230, 250); 
    doc.rect(14, y - 5, 182, 7, 'F');
    doc.text(`Nama Fasilitator: ${session.name}`, 16, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bolditalic");
    const dateStr = session.sessionDate ? ` (${formatDateID(session.sessionDate)})` : '';
    const subjectLines = doc.splitTextToSize(`Materi: ${session.subject}${dateStr}`, 180);
    doc.text(subjectLines, 14, y);
    y += (subjectLines.length * 4); 

    // Filter and Calculate Scores
    const scoreRows = groupedQuestions
        .filter(q => q.type !== 'text')
        .filter(q => !q.ids.every(id => hiddenIds.includes(id))) // Only show if NOT ALL hidden
        .map(q => {
            const avg = calculateGroupAverage(session.responses, q.ids);
            const label = getScoreLabel(avg, q.type);
            return [q.label, `${avg.toFixed(2)} (${label})`];
        });

    // Recalculate Overall for this session based on VISIBLE questions
    let totalScore = 0;
    let totalCount = 0;
    let dominantType: QuestionType = 'slider';

    groupedQuestions
        .filter(q => q.type !== 'text')
        .filter(q => !q.ids.every(id => hiddenIds.includes(id)))
        .forEach(q => {
            const avg = calculateGroupAverage(session.responses, q.ids);
            totalScore += avg;
            totalCount++;
            dominantType = q.type;
        });
    
    const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
    const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

    scoreRows.push(['Rata-rata Keseluruhan', sessionOverallStr]);

    autoTable(doc, {
        startY: y,
        head: [['Variabel Penilaian', 'Rata-rata & Predikat']],
        body: scoreRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9, cellPadding: 1 },
        bodyStyles: { fontSize: 9, cellPadding: 1 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { fontStyle: 'bold' } },
        didParseCell: function (data) {
            if (data.row.index === scoreRows.length - 1 && data.section === 'body') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 240, 255]; 
            }
        },
        margin: { left: 14, right: 14 }
    });
    
    y = (doc as any).lastAutoTable.finalY + 5;

    // Comments Section (Split 2 Columns with Divider)
    const textQs = groupedQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = getGroupTextAnswers(session.responses, q.ids);
        if (comments && comments.length > 0) {
            // Check page break before header
            if (y > 250) { doc.addPage(); y = 20; }
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(`Komentar - ${q.label}:`, 14, y);
            y += 4;

            const splitRows = splitCommentsToPairs(comments);
            
            autoTable(doc, {
                startY: y,
                body: splitRows,
                theme: 'plain', // Clean look
                // REDUCED PADDING FROM 3 to 1 to tighten spacing
                styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak', valign: 'top' },
                columnStyles: {
                    0: { cellWidth: 85 }, // Left column
                    1: { cellWidth: 85 }  // Right column
                },
                margin: { left: 14, right: 14 },
                didDrawCell: (data) => {
                    // Draw vertical line separator in the middle
                    if (data.column.index === 0 && data.section === 'body') {
                        // Position line exactly between columns
                        const lineX = data.cell.x + data.cell.width; 
                        doc.setDrawColor(0, 0, 0); // Black
                        doc.setLineWidth(0.5); // Thicker line
                        doc.line(lineX, data.cell.y, lineX, data.cell.y + data.cell.height);
                    }
                }
            });
            y = (doc as any).lastAutoTable.finalY + 5;
        }
    });
    
    // TTD Dynamic Close
    addPdfSignatureDynamic(doc, settings, y);
  });
  }

  // --- B. REKAPITULASI (Chunked 12 Rows/Page) ---
  if (mode === 'all' || mode === 'facilitator') {
  doc.addPage();
  y = 20;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('B. Rekapitulasi Nilai Keseluruhan', 14, y);
  y += 5;

  const summaryRows: any[] = [];
  let no = 1;
  let grandTotal = 0;
  let grandCount = 0;

  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);
  sortedNames.forEach((name) => {
      data.facilitators[name].forEach((session: SessionExportData) => {
        // Recalculate overall for recap as well to match detailed view
        const facConfig = training.facilitators.find(f => 
            f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
            f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
        );
        const hiddenIds = facConfig?.hiddenQuestionIds || [];
        const customLabels = facConfig?.customLabels || {};

        const mappedQuestions = training.facilitatorQuestions.map(q => ({
            ...q,
            label: customLabels[q.id] || q.label
        }));

        const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
        mappedQuestions.forEach(q => {
            const key = q.label.trim();
            if (!groups[key]) {
                groups[key] = { ids: [], type: q.type, label: q.label };
            }
            groups[key].ids.push(q.id);
        });
        const groupedQuestions = Object.values(groups);

        let totalScore = 0;
        let totalCount = 0;
        let dominantType: QuestionType = 'slider';

        groupedQuestions
            .filter(q => q.type !== 'text')
            .filter(q => !q.ids.every(id => hiddenIds.includes(id)))
            .forEach(q => {
                const avg = calculateGroupAverage(session.responses, q.ids);
                totalScore += avg;
                totalCount++;
                dominantType = q.type;
            });
        
        const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
        const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

        summaryRows.push([
            no++, 
            name, 
            session.subject || '-', 
            formatDateID(session.sessionDate), 
            sessionOverallStr
        ]);
        grandTotal += sessionOverall;
        grandCount++;
      });
  });

  // Calculate Average Row
  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;
  const grandTotalRow = ['', '', '', 'RATA-RATA TOTAL', grandDisplay];

  // Manual Pagination (Limit 12 rows)
  const rowsPerPage = 12;
  const totalSummaryRows = summaryRows.length;
  
  // If empty
  if (totalSummaryRows === 0) {
       doc.text("(Tidak ada data)", 14, y + 5);
       y += 10;
  } else {
      for (let i = 0; i < totalSummaryRows; i += rowsPerPage) {
          const chunk = summaryRows.slice(i, i + rowsPerPage);
          // If this is the very last chunk, append the Grand Total row
          if (i + rowsPerPage >= totalSummaryRows) {
              chunk.push(grandTotalRow);
          }

          if (i > 0) {
              doc.addPage();
              y = 20;
              // Removed title text for subsequent pages
          }

          autoTable(doc, {
              startY: y,
              head: [['No', 'Nama Fasilitator', 'Materi', 'Tanggal', 'Nilai Akhir']],
              body: chunk,
              theme: 'striped',
              headStyles: { fillColor: [50, 50, 50] },
              columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { fontStyle: 'bold', halign: 'center' } },
              margin: { left: 14, right: 14 },
              didParseCell: function (data) {
                  // Style Grand Total row
                  const isLastChunk = (i + rowsPerPage >= totalSummaryRows);
                  const isLastRowInChunk = (data.row.index === chunk.length - 1);
                  if (isLastChunk && isLastRowInChunk && data.section === 'body') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [229, 231, 235]; 
                  }
              }
          });
          y = (doc as any).lastAutoTable.finalY + 5;
      }
  }
  
  // TTD Dynamic Close
  addPdfSignatureDynamic(doc, settings, y);
  }


  // --- C. PENYELENGGARAAN (Breakdown + Split Comments) ---
  if (mode === 'all' || mode === 'organizer') {
  if (mode === 'all') {
      doc.addPage();
      y = 20;
  } else {
      y += 10;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('C. Evaluasi Penyelenggaraan', 14, y);
  y += 6;

  if (training.processOrganizer && training.processOrganizer.name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Penanggung Jawab: ${training.processOrganizer.name}`, 14, y);
    y += 6;
  }

  const procRows: any[] = [];
  let procNo = 1;

  training.processQuestions.filter(q => q.type !== 'text').forEach(q => {
      const dist = data.process.distributions[q.id] || { k:'0.0%', s:'0.0%', b:'0.0%', sb:'0.0%' };
      procRows.push([
          procNo++,
          q.label, 
          dist.k, 
          dist.s, 
          dist.b, 
          dist.sb
      ]);
  });

  autoTable(doc, {
    startY: y,
    head: [['No', 'Hal-hal yang dievaluasi', 'Kurang', 'Sedang', 'Baik', 'Sgt.Baik']],
    body: procRows,
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.1, fontSize: 9, halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 9, lineColor: [0,0,0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: { 
        0: { halign: 'center', cellWidth: 10 }, 
        1: { cellWidth: 90 }, 
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: 14, right: 14 }
  });
  
  y = (doc as any).lastAutoTable.finalY + 5;

  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  procTextQs.forEach(q => {
      const comments = data.process.comments[q.id];
      if (comments && comments.length > 0) {
          if (y > 250) { doc.addPage(); y = 20; }
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`Komentar - ${q.label}:`, 14, y);
          y += 4;

          const splitRows = splitCommentsToPairs(comments);
            
            autoTable(doc, {
                startY: y,
                body: splitRows,
                theme: 'plain',
                // REDUCED PADDING
                styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak', valign: 'top' },
                columnStyles: { 0: { cellWidth: 85 }, 1: { cellWidth: 85 } },
                margin: { left: 14, right: 14 },
                didDrawCell: (data) => {
                    if (data.column.index === 0 && data.section === 'body') {
                        const lineX = data.cell.x + data.cell.width;
                        doc.setDrawColor(0, 0, 0); // Black
                        doc.setLineWidth(0.5); // Thicker
                        doc.line(lineX, data.cell.y, lineX, data.cell.y + data.cell.height);
                    }
                }
            });
          y = (doc as any).lastAutoTable.finalY + 5;
      }
  });

  // TTD Dynamic Close
  addPdfSignatureDynamic(doc, settings, y);
  }

  let filenameSuffix = '';
  if (mode === 'facilitator') {
      filenameSuffix = '_Fasilitator';
  } else if (mode === 'organizer') {
      filenameSuffix = '_Penyelenggaraan';
  }
  doc.save(`Laporan_SIMEP${filenameSuffix}_${training.title.replace(/\s+/g, '_')}.pdf`);
};

export const exportToWord = async (training: Training) => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);

  // Helper Signature
  const createSignatureBlock = () => {
      const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
      const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
      const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';

      return [
          new Paragraph({
              children: [new TextRun({ text: sigTitle })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 100 } // Jarak 1/2 baris (reduced from 200)
          }),
          new Paragraph({
              children: [new TextRun({ text: sigName, bold: true, underline: { type: UnderlineType.SINGLE, color: '000000' } })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 1200 } // Space for signature
          }),
          new Paragraph({
              children: [new TextRun({ text: sigNIP })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 100 }
          })
      ];
  };

  const sections: any[] = [];

  sections.push(new Paragraph({
    text: "Laporan Rekapitulasi Evaluasi Pelatihan",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
  }));

  const infoText = [
      new TextRun({ text: `Judul Pelatihan: ${training.title}`, bold: true }),
  ];

  let methodLocWord = '';
  if (training.learningMethod) methodLocWord += `Metode Pembelajaran ${training.learningMethod} `;
  if (training.location) methodLocWord += `Di UPT Pelatihan Kesehatan Masyarakat Kampus ${training.location}`;

  if (methodLocWord) {
      infoText.push(new TextRun({ text: `\n${methodLocWord.trim()}`, break: 1 }));
  }

  infoText.push(new TextRun({ text: `\nPeriode: ${formatDateID(training.startDate)} - ${formatDateID(training.endDate)}`, break: 1 }));
  infoText.push(new TextRun({ text: `\nJumlah Responden: ${responses.length}`, break: 1 }));

  sections.push(new Paragraph({
    children: infoText,
    spacing: { after: 400 },
  }));

  // A. DETAIL FASILITATOR
  sections.push(new Paragraph({ text: "A. Evaluasi Detail Fasilitator", heading: HeadingLevel.HEADING_2 }));
  const flatSessions = getFlatChronologicalSessions(data.facilitators);
  flatSessions.forEach((session, idx) => {
    // Find matching facilitator config to get custom labels and hidden IDs
    const facConfig = training.facilitators.find(f => 
        f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
        f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
    );

    const hiddenIds = facConfig?.hiddenQuestionIds || [];
    const customLabels = facConfig?.customLabels || {};

    // 1. Map questions with custom labels
    const mappedQuestions = training.facilitatorQuestions.map(q => ({
        ...q,
        label: customLabels[q.id] || q.label
    }));

    // 2. Group questions by label
    const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
    mappedQuestions.forEach(q => {
        const key = q.label.trim();
        if (!groups[key]) {
            groups[key] = { ids: [], type: q.type, label: q.label };
        }
        groups[key].ids.push(q.id);
    });
    const groupedQuestions = Object.values(groups);

    sections.push(new Paragraph({ 
        children: [new TextRun({ text: `Nama Fasilitator: ${session.name}`, color: "4F46E5", bold: true })], 
        spacing: { before: 200 } 
    }));
    const sessionDateStr = session.sessionDate ? ` (${formatDateID(session.sessionDate)})` : '';
    sections.push(new Paragraph({ text: `Materi: ${session.subject}${sessionDateStr}`, bold: true, spacing: { before: 100 } }));
    
    // Scores Table
    const rows = [
        new TableRow({
            children: [
            new TableCell({ children: [new Paragraph({ text: "Variabel", bold: true })], width: { size: 60, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "Nilai & Predikat", bold: true })], width: { size: 40, type: WidthType.PERCENTAGE } }),
            ],
        }),
    ];

    // Filter and Calculate Scores
    let totalScore = 0;
    let totalCount = 0;
    let dominantType: QuestionType = 'slider';

    groupedQuestions
        .filter(q => q.type !== 'text')
        .filter(q => !q.ids.every(id => hiddenIds.includes(id))) // Only show if NOT ALL hidden
        .forEach(q => {
            const avg = calculateGroupAverage(session.responses, q.ids);
            const label = getScoreLabel(avg, q.type);
            rows.push(new TableRow({
                children: [
                new TableCell({ children: [new Paragraph(q.label)] }),
                new TableCell({ children: [new Paragraph(`${avg.toFixed(2)} (${label})`)] }),
                ],
            }));
            
            totalScore += avg;
            totalCount++;
            dominantType = q.type;
        });

    const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
    const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

    rows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: "Rata-rata Keseluruhan", bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: sessionOverallStr, bold: true })] }),
        ],
    }));
    sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        }
    }));

    // Comments Section (Split 2 Columns)
    const textQs = groupedQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = getGroupTextAnswers(session.responses, q.ids);
        if (comments && comments.length > 0) {
            sections.push(new Paragraph({ text: `Komentar - ${q.label}:`, bold: true, spacing: { before: 100 } }));
            
            const splitRows = splitCommentsToPairs(comments);
            const commentTableRows = splitRows.map(pair => new TableRow({
                children: [
                    new TableCell({ 
                        children: [new Paragraph({ 
                            text: pair[0], 
                            spacing: { after: 0, before: 0 } // Remove paragraph spacing to tighten rows
                        })], 
                        width: { size: 50, type: WidthType.PERCENTAGE }, 
                        borders: { right: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, left: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } } 
                    }),
                    new TableCell({ 
                        children: [new Paragraph({ 
                            text: pair[1], 
                            spacing: { after: 0, before: 0 } 
                        })], 
                        width: { size: 50, type: WidthType.PERCENTAGE }, 
                        borders: { left: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, right: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } } 
                    })
                ]
            }));

            sections.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: commentTableRows,
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, // Thicker black line
                }
            }));
        }
    });

    sections.push(...createSignatureBlock());
    sections.push(new Paragraph({ children: [new PageBreak()] })); 
  });

  // B. REKAPITULASI (Chunked 12 Rows/Page)
  sections.push(new Paragraph({ text: "B. Rekapitulasi Nilai Keseluruhan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  
  const summaryRows: TableRow[] = [];
  let no = 1; let grandTotal = 0; let grandCount = 0;
  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);
  
  sortedNames.forEach((name) => {
      data.facilitators[name].forEach((session: SessionExportData) => {
        // Recalculate overall for recap as well to match detailed view
        const facConfig = training.facilitators.find(f => 
            f.name.trim().toLowerCase() === session.name.trim().toLowerCase() && 
            f.subject.trim().toLowerCase() === session.subject.trim().toLowerCase()
        );
        const hiddenIds = facConfig?.hiddenQuestionIds || [];
        const customLabels = facConfig?.customLabels || {};

        const mappedQuestions = training.facilitatorQuestions.map(q => ({
            ...q,
            label: customLabels[q.id] || q.label
        }));

        const groups: Record<string, { ids: string[], type: QuestionType, label: string }> = {};
        mappedQuestions.forEach(q => {
            const key = q.label.trim();
            if (!groups[key]) {
                groups[key] = { ids: [], type: q.type, label: q.label };
            }
            groups[key].ids.push(q.id);
        });
        const groupedQuestions = Object.values(groups);

        let totalScore = 0;
        let totalCount = 0;
        let dominantType: QuestionType = 'slider';

        groupedQuestions
            .filter(q => q.type !== 'text')
            .filter(q => !q.ids.every(id => hiddenIds.includes(id)))
            .forEach(q => {
                const avg = calculateGroupAverage(session.responses, q.ids);
                totalScore += avg;
                totalCount++;
                dominantType = q.type;
            });
        
        const sessionOverall = totalCount > 0 ? totalScore / totalCount : 0;
        const sessionOverallStr = `${sessionOverall.toFixed(2)} (${getScoreLabel(sessionOverall, dominantType)})`;

        summaryRows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph((no++).toString())] }),
                new TableCell({ children: [new Paragraph(name)] }),
                new TableCell({ children: [new Paragraph(session.subject || '-')] }),
                new TableCell({ children: [new Paragraph({ text: sessionOverallStr, bold: true })] }),
            ]
        }));
        grandTotal += sessionOverall; grandCount++;
      });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;
  const grandTotalRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph({ text: "RATA-RATA TOTAL", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: grandDisplay, bold: true })] }),
      ]
  });

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: "No", bold: true })] }),
      new TableCell({ children: [new Paragraph({ text: "Fasilitator", bold: true })] }),
      new TableCell({ children: [new Paragraph({ text: "Materi", bold: true })] }),
      new TableCell({ children: [new Paragraph({ text: "Nilai Akhir", bold: true })] }),
    ],
  });

  // Chunking for Word
  const rowsPerPage = 12;
  const totalSummaryRows = summaryRows.length;

  if (totalSummaryRows === 0) {
      sections.push(new Paragraph({ text: "(Tidak ada data)" }));
  } else {
      for (let i = 0; i < totalSummaryRows; i += rowsPerPage) {
          const chunk = summaryRows.slice(i, i + rowsPerPage);
          if (i + rowsPerPage >= totalSummaryRows) {
              chunk.push(grandTotalRow);
          }

          if (i > 0) {
              sections.push(new Paragraph({ children: [new PageBreak()] }));
              // Removed text: sections.push(new Paragraph({ text: "B. Rekapitulasi (Lanjutan)", heading: HeadingLevel.HEADING_2 }));
          }

          sections.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...chunk],
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 },
            }
        }));
      }
  }

  sections.push(...createSignatureBlock());
  sections.push(new Paragraph({ children: [new PageBreak()] }));

  // C. PENYELENGGARAAN (Split Comments)
  sections.push(new Paragraph({ text: "C. Evaluasi Penyelenggaraan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  
  if (training.processOrganizer && training.processOrganizer.name) {
       sections.push(new Paragraph({ text: `Penanggung Jawab: ${training.processOrganizer.name}`, spacing: { after: 100 } }));
  }

  const procRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "No", bold: true })], width: { size: 5, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Hal-hal yang dievaluasi", bold: true })], width: { size: 55, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Kurang", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Sedang", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Baik", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Sgt.Baik", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        ],
      }),
  ];

  let procNo = 1;
  training.processQuestions.filter(q => q.type !== 'text').forEach(q => {
      const dist = data.process.distributions[q.id] || { k:'0.0%', s:'0.0%', b:'0.0%', sb:'0.0%' };
      procRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph((procNo++).toString())] }),
          new TableCell({ children: [new Paragraph(q.label)] }),
          new TableCell({ children: [new Paragraph(dist.k)] }),
          new TableCell({ children: [new Paragraph(dist.s)] }),
          new TableCell({ children: [new Paragraph(dist.b)] }),
          new TableCell({ children: [new Paragraph(dist.sb)] }),
        ],
      }));
  });

  sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: procRows,
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      }
  }));

  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  procTextQs.forEach(q => {
      const comments = data.process.comments[q.id];
      if (comments && comments.length > 0) {
          sections.push(new Paragraph({ text: `Komentar - ${q.label}:`, bold: true, spacing: { before: 100 } }));
          
          const splitRows = splitCommentsToPairs(comments);
            const commentTableRows = splitRows.map(pair => new TableRow({
                children: [
                    new TableCell({ 
                        children: [new Paragraph({ 
                            text: pair[0],
                            spacing: { after: 0, before: 0 } // Remove spacing
                        })], 
                        width: { size: 50, type: WidthType.PERCENTAGE }, 
                        borders: { right: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, left: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } } 
                    }, ),
                    new TableCell({ 
                        children: [new Paragraph({ 
                            text: pair[1],
                            spacing: { after: 0, before: 0 } 
                        })], 
                        width: { size: 50, type: WidthType.PERCENTAGE }, 
                        borders: { left: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, right: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } } 
                    })
                ]
            }));

            sections.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: commentTableRows,
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, // Thicker black line
                }
            }));
      }
  });

  sections.push(...createSignatureBlock());

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.docx`);
};
