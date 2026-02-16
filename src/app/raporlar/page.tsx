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
    function exportPDF() {
        const doc = new jsPDF();

        // Add font
        doc.setFont('Amiri-Regular');
        doc.setFontSize(18);
        doc.text('Kurban Yönetim Raporu', 14, 20);

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
            styles: { font: 'Amiri-Regular', fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`rapor_${new Date().toISOString().split('T')[0]}.pdf`);
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
