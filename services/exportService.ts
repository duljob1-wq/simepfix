
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle, PageBreak, UnderlineType } from 'docx';
import saveAs from 'file-saver';
import { Training, Response, QuestionType } from '../types';
import { getResponses, getSettings } from './storageService';

// Helper untuk format tanggal Indonesia
const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper Logic for Labeling (Shared Logic)
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

// HELPER: Calculate Percentage Distribution (String Output with %)
const calculateDistributionExport = (responses: Response[], qId: string, type: QuestionType) => {
    const counts = { k: 0, s: 0, b: 0, sb: 0, total: 0 };
    responses.forEach(r => {
        const val = r.answers[qId];
        if (typeof val === 'number') {
            counts.total++;
            if (type === 'star') {
                // 1=Kurang, 2&3=Sedang, 4=Baik, 5=Sangat Baik
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
      distributions: {}, // Store distributions here
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
                session.comments[q.id] = session.responses.map((r: any) => r.answers[q.id]).filter((a: any) => a && a.trim() !== '');
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
      result.process.comments[q.id] = procResponses.map((r: any) => r.answers[q.id]).filter((a: any) => a && a.trim() !== '');
    } else {
      dominantProcType = q.type;
      const scores = procResponses.map((r: any) => r.answers[q.id]).filter((v: any) => typeof v === 'number');
      const avg = scores.length ? scores.reduce((a: any, b: any) => a + b, 0) / scores.length : 0;
      result.process.rawAverages[q.id] = avg;
      
      // Calculate Distribution for Process
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

// --- HELPER: ADD PDF SIGNATURE ---
const addPdfSignature = (doc: jsPDF, settings: any) => {
    const pageHeight = doc.internal.pageSize.height;
    // TTD Position: Bottom Right (Absolute)
    const sigY = pageHeight - 45; 
    const sigCenterX = 150; // Approx right center for A4

    const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
    const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
    const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sigTitle, sigCenterX, sigY, { align: 'center' });
    
    doc.setFont("helvetica", "bold");
    doc.text(sigName, sigCenterX, sigY + 25, { align: 'center' });
    
    // Manual Underline
    const textWidth = doc.getTextWidth(sigName);
    doc.line(sigCenterX - (textWidth / 2), sigY + 26, sigCenterX + (textWidth / 2), sigY + 26);

    doc.setFont("helvetica", "normal");
    doc.text(sigNIP, sigCenterX, sigY + 30, { align: 'center' });
};

export const exportToPDF = async (training: Training) => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);
  const doc = new jsPDF();
  const timestamp = formatDateID(new Date().toISOString());

  // --- HALAMAN COVER / DEPAN & FASILITATOR PERTAMA ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text('Laporan Rekapitulasi Evaluasi Pelatihan', 14, 20);
  
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

  // --- A. DETAIL FASILITATOR ---
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

    // Fac Header
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

    const scoreRows = training.facilitatorQuestions
    .filter(q => q.type !== 'text')
    .map(q => [q.label, session.averages[q.id] || '0.00 (Kurang)']);

    scoreRows.push(['Rata-rata Keseluruhan', session.overall]);

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

    // Comments Section
    const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = session.comments[q.id];
        if (comments && comments.length > 0) {
            if (y > 230) { doc.addPage(); y = 20; } 
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(`Komentar - ${q.label}:`, 14, y);
            y += 3;

            const commentRows = comments.map((c: string) => [`• ${c}`]);
            autoTable(doc, {
                startY: y,
                body: commentRows,
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 0.5, overflow: 'linebreak', rowHeight: 0, valign: 'top' },
                margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 2;
        }
    });
    
    addPdfSignature(doc, settings);
  });

  // --- B. REKAPITULASI ---
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
        summaryRows.push([
            no++, 
            name, 
            session.subject || '-', 
            formatDateID(session.sessionDate), 
            session.overall
        ]);
        grandTotal += session.overallVal;
        grandCount++;
      });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  summaryRows.push(['', '', '', 'RATA-RATA TOTAL', grandDisplay]);

  autoTable(doc, {
      startY: y,
      head: [['No', 'Nama Fasilitator', 'Materi', 'Tanggal', 'Nilai Akhir']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { fontStyle: 'bold', halign: 'center' } },
      margin: { left: 14, right: 14 },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.index === summaryRows.length - 1) {
             data.cell.styles.fontStyle = 'bold';
             data.cell.styles.fillColor = [229, 231, 235]; 
        }
      }
  });
  
  addPdfSignature(doc, settings);

  // --- C. PENYELENGGARAAN (UPDATED) ---
  doc.addPage();
  y = 20;

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

  // UPDATED: Proc Rows with Breakdown (No Column)
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

  // Note: We don't put Overall Avg in this specific table structure as it's percentage based, 
  // but we can add it as a summary row or a separate block. 
  // Based on request, we stick to the detailed percentage table.

  autoTable(doc, {
    startY: y,
    head: [['No', 'Hal-hal yang dievaluasi', 'Kurang', 'Sedang', 'Baik', 'Sgt.Baik']], // Header update
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
          if (y > 230) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`Komentar - ${q.label}:`, 14, y);
          y += 3;

          const commentRows = comments.map((c: string) => [`• ${c}`]);
          autoTable(doc, {
              startY: y,
              body: commentRows,
              theme: 'plain',
              styles: { fontSize: 8, cellPadding: 0.5 },
              margin: { left: 14, right: 14 }
          });
          y = (doc as any).lastAutoTable.finalY + 2;
      }
  });

  addPdfSignature(doc, settings);

  doc.save(`Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.pdf`);
};

export const exportToExcel = async (training: Training) => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);
  const wb = XLSX.utils.book_new();

  // Signature Data Rows
  const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
  const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
  const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';
  
  const getSigRows = () => [
      ['', '', '', ''],
      ['', '', '', sigTitle],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', sigName],
      ['', '', '', sigNIP],
      ['', '', '', ''] 
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
      detailRows.push([`NAMA FASILITATOR: ${session.name}`]);
      detailRows.push([`Materi: ${session.subject}`, `Tanggal: ${formatDateID(session.sessionDate)}`]);
      
      detailRows.push(['Variabel', 'Nilai']);
      training.facilitatorQuestions.filter(q => q.type !== 'text').forEach(q => {
          detailRows.push([q.label, session.averages[q.id]]);
      });
      detailRows.push(['Rata-rata Keseluruhan', session.overall]);

      const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
      if (textQs.length > 0) {
          detailRows.push(['Komentar / Saran Responden:']);
          textQs.forEach(q => {
              const cmts = session.comments[q.id];
              if (cmts && cmts.length > 0) {
                 detailRows.push([`[${q.label}]`]);
                 cmts.forEach((c: string) => detailRows.push([` - ${c}`]));
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
        summaryRows.push([no++, name, session.subject || '-', formatDateID(session.sessionDate), session.overall]);
        grandTotal += session.overallVal;
        grandCount++;
    });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  summaryRows.push(['', '', '', 'RATA-RATA TOTAL', grandDisplay]);

  const rekapFinalRows = [...infoData, ['B. REKAPITULASI NILAI KESELURUHAN'], [], summaryHeader, ...summaryRows, ...getSigRows()];

  const rekapWs = XLSX.utils.aoa_to_sheet(rekapFinalRows);
  XLSX.utils.book_append_sheet(wb, rekapWs, 'B. Rekapitulasi');

  // --- C. PENYELENGGARAAN (UPDATED with Breakdown) ---
  const procRows: any[] = [...infoData, ['C. EVALUASI PENYELENGGARAAN']];
  
  if (training.processOrganizer && training.processOrganizer.name) {
      procRows.push([`Penanggung Jawab: ${training.processOrganizer.name}`]);
  }
  
  procRows.push([]);
  // Updated Header
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
      procRows.push(['Komentar / Saran Penyelenggaraan:']);
      procTextQs.forEach(q => {
          const cmts = data.process.comments[q.id];
          if (cmts && cmts.length > 0) {
             procRows.push([`[${q.label}]`]);
             cmts.forEach((c: string) => procRows.push([` - ${c}`]));
          }
      });
  }

  procRows.push(...getSigRows());

  const procWs = XLSX.utils.aoa_to_sheet(procRows);
  XLSX.utils.book_append_sheet(wb, procWs, 'C. Penyelenggaraan');

  XLSX.writeFile(wb, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.xlsx`);
};

export const exportToWord = async (training: Training) => {
  const responses = await getResponses(training.id);
  const settings = await getSettings(); 
  const data = processDataForExport(training, responses);

  // Helper Signature Generator for Word
  const createSignatureBlock = () => {
      const sigTitle = settings.signatureTitle || 'Kepala Seksi Penyelenggaraan Pelatihan';
      const sigName = settings.signatureName || 'MUNCUL WIYANA, S.Kep., Ns., M.Kep.';
      const sigNIP = settings.signatureNIP ? `NIP. ${settings.signatureNIP}` : '';

      return [
          new Paragraph({
              children: [new TextRun({ text: sigTitle })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 800 }
          }),
          new Paragraph({
              children: [new TextRun({ text: sigName, bold: true, underline: { type: UnderlineType.SINGLE, color: '000000' } })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 1200 } 
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

  // A. DETAIL FASILITATOR (Unchanged - omitted for brevity logic matches original)
  sections.push(new Paragraph({ text: "A. Evaluasi Detail Fasilitator", heading: HeadingLevel.HEADING_2 }));
  const flatSessions = getFlatChronologicalSessions(data.facilitators);
  flatSessions.forEach((session, idx) => {
    sections.push(new Paragraph({ 
        children: [new TextRun({ text: `Nama Fasilitator: ${session.name}`, color: "4F46E5", bold: true })], 
        spacing: { before: 200 } 
    }));
    const sessionDateStr = session.sessionDate ? ` (${formatDateID(session.sessionDate)})` : '';
    sections.push(new Paragraph({ text: `Materi: ${session.subject}${sessionDateStr}`, bold: true, spacing: { before: 100 } }));
    const rows = [
        new TableRow({
            children: [
            new TableCell({ children: [new Paragraph({ text: "Variabel", bold: true })], width: { size: 60, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "Nilai & Predikat", bold: true })], width: { size: 40, type: WidthType.PERCENTAGE } }),
            ],
        }),
    ];
    training.facilitatorQuestions.filter(q => q.type !== 'text').forEach(q => {
        rows.push(new TableRow({
            children: [
            new TableCell({ children: [new Paragraph(q.label)] }),
            new TableCell({ children: [new Paragraph(session.averages[q.id] || "0.00")] }),
            ],
        }));
    });
    rows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: "Rata-rata Keseluruhan", bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: session.overall, bold: true })] }),
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
    const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = session.comments[q.id];
        if (comments && comments.length > 0) {
            sections.push(new Paragraph({ text: `Komentar - ${q.label}:`, bold: true, spacing: { before: 100 } }));
            comments.forEach((c: string) => {
                sections.push(new Paragraph({ text: `• ${c}`, bullet: { level: 0 }, spacing: { after: 0 } }));
            });
        }
    });
    sections.push(...createSignatureBlock());
    sections.push(new Paragraph({ children: [new PageBreak()] })); 
  });

  // B. REKAP (Unchanged - omitted for brevity logic matches original)
  sections.push(new Paragraph({ text: "B. Rekapitulasi Nilai Keseluruhan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  const summaryRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "No", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Fasilitator", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Materi", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Nilai Akhir", bold: true })] }),
        ],
      }),
  ];
  let no = 1; let grandTotal = 0; let grandCount = 0;
  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);
  sortedNames.forEach((name) => {
      data.facilitators[name].forEach((session: SessionExportData) => {
        summaryRows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph((no++).toString())] }),
                new TableCell({ children: [new Paragraph(name)] }),
                new TableCell({ children: [new Paragraph(session.subject || '-')] }),
                new TableCell({ children: [new Paragraph({ text: session.overall, bold: true })] }),
            ]
        }));
        grandTotal += session.overallVal; grandCount++;
      });
  });
  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;
  summaryRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph({ text: "RATA-RATA TOTAL", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: grandDisplay, bold: true })] }),
      ]
  }));
  sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: summaryRows,
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      }
  }));
  sections.push(...createSignatureBlock());
  sections.push(new Paragraph({ children: [new PageBreak()] }));

  // --- C. PENYELENGGARAAN (UPDATED) ---
  sections.push(new Paragraph({ text: "C. Evaluasi Penyelenggaraan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  
  if (training.processOrganizer && training.processOrganizer.name) {
       sections.push(new Paragraph({ text: `Penanggung Jawab: ${training.processOrganizer.name}`, spacing: { after: 100 } }));
  }

  // Updated Word Table Header
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
          comments.forEach((c: string) => {
              sections.push(new Paragraph({ text: `• ${c}`, bullet: { level: 0 }, spacing: { after: 0 } }));
          });
      }
  });

  sections.push(...createSignatureBlock());

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.docx`);
};
