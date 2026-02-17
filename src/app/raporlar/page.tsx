'use client';

import { useState, useEffect } from 'react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import { getRecords, getShareTypes, getGroups } from '@/lib/firestore';
import type { Record as RecordType, ShareType, Group } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Font for PDF - Standard fonts used temporarily
// import '@/utils/Amiri-Regular-normal.js';

export default function RaporlarPage() {
    const [records, setRecords] = useState<RecordType[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    async function loadData(showFeedback = false) {
        setLoading(true);
        try {
            const [recs, types, grps] = await Promise.all([
                getRecords(),
                getShareTypes(),
                getGroups()
            ]);
            setRecords(recs);
            setShareTypes(types);
            setGroups(grps);
            if (showFeedback) alert('Veriler yenilendi.');
        } catch (err) {
            console.error(err);
        } finally { setLoading(false); }
    }

    // PDF Export
    async function exportPDF() {
        const robotoRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
        const robotoBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

        try {
            const doc = new jsPDF();

            const loadFont = async (url: string, name: string, style: string) => {
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const base64data = btoa(
                        new Uint8Array(arrayBuffer)
                            .reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    doc.addFileToVFS(`${name}-${style}.ttf`, base64data);
                    doc.addFont(`${name}-${style}.ttf`, name, style);
                    return true;
                } catch (e) {
                    console.error(`Font load failed: ${name} ${style}`, e);
                    return false;
                }
            };

            // Load fonts
            await Promise.all([
                loadFont(robotoRegularUrl, 'Roboto', 'normal'),
                loadFont(robotoBoldUrl, 'Roboto', 'bold')
            ]);

            const fontToUse = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';
            doc.setFont(fontToUse, 'normal');

            // Header
            doc.setFont(fontToUse, 'bold');
            doc.setFontSize(18);
            doc.setTextColor(0);
            doc.text('Kurban Yönetim Raporu', 14, 20);

            doc.setFont(fontToUse, 'normal');
            doc.setFontSize(12);
            doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

            // Summary
            const totalAmount = records.reduce((s, r) => s + (r.totalPrice || 0), 0);
            const totalPaid = records.reduce((s, r) => s + (r.depositAmount || 0), 0);

            doc.text(`Toplam Hissedar: ${records.length}`, 14, 40);
            doc.text(`Toplam Tutar: ${totalAmount.toLocaleString('tr-TR')} TL`, 14, 46);
            doc.text(`Toplanan: ${totalPaid.toLocaleString('tr-TR')} TL`, 14, 52);
            doc.text(`Kalan: ${(totalAmount - totalPaid).toLocaleString('tr-TR')} TL`, 14, 58);

            // Table
            const tableData = records.map((r, i) => [
                (i + 1).toString(),
                r.ownerName,
                r.shareTypeName || '-',
                r.daySelection ? `${r.daySelection}. Gün` : '-',
                (r.totalPrice || 0).toLocaleString('tr-TR'),
                r.depositAmount.toLocaleString('tr-TR'),
                ((r.totalPrice || 0) - r.depositAmount).toLocaleString('tr-TR')
            ]);

            autoTable(doc, {
                startY: 65,
                head: [['#', 'Ad Soyad', 'Hisse', 'Gün', 'Toplam', 'Ödenen', 'Kalan']],
                body: tableData,
                styles: {
                    font: fontToUse,
                    fontSize: 10,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200]
                },
                alternateRowStyles: { fillColor: [250, 250, 250] },
            });

            doc.save(`rapor_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('PDF oluşturulurken bir hata oluştu.');
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>📈 Raporlar</h2>
                <div className="top-bar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => loadData(true)} title="Yenile">
                        <FiRefreshCw /> Yenile
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={exportPDF}>
                        <FiDownload /> PDF İndir
                    </button>
                </div>
            </div>

            <div className="page-content">
                <div className="card">
                    <div className="card-header"><h3>Genel Durum</h3></div>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{records.length}</div>
                            <div className="stat-label">Kayıt</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{shareTypes.length}</div>
                            <div className="stat-label">Hisse Tipi</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{groups.length}</div>
                            <div className="stat-label">Grup</div>
                        </div>
                    </div>
                </div>

                {/* More reports coming soon */}
                <div className="empty-state">
                    <p>Detaylı raporlama ekranları geliştirme aşamasındadır.</p>
                </div>
            </div>
        </>
    );
}
