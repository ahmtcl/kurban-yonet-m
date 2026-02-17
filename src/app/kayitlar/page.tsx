'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { getRecords, getShareTypes, deleteRecord, getGroups } from '@/lib/firestore';
import type { Record as RecordType, ShareType, Group } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';

export default function KayitlarPage() {
    const [records, setRecords] = useState<RecordType[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterShareType, setFilterShareType] = useState('');
    const [filterPayment, setFilterPayment] = useState('');
    const [filterGroup, setFilterGroup] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dateFilterType, setDateFilterType] = useState<'createdAt' | 'updatedAt'>('createdAt');

    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Edit modal
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);

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
            if (showFeedback) showToast('success', 'Veriler yenilendi.');
        } catch (err) {
            console.error(err);
        } finally { setLoading(false); }
    }

    const filteredAndSorted = useMemo(() => {
        const result = records.filter((r) => {
            const matchSearch = !search ||
                r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
                r.phone.includes(search) ||
                (r.orderNumber && r.orderNumber.toString().includes(search)) ||
                r.notes?.toLowerCase().includes(search.toLowerCase());
            const matchShare = !filterShareType || r.shareTypeId === filterShareType;
            const matchPayment = !filterPayment || r.paymentType === filterPayment;
            const matchGroup = !filterGroup || r.groupId === filterGroup;
            const matchDay = !filterDay || r.daySelection?.toString() === filterDay;

            let matchDate = true;
            if (startDate || endDate) {
                const targetDate = dateFilterType === 'updatedAt'
                    ? (r.updatedAt ? new Date(r.updatedAt) : null)
                    : new Date(r.createdAt);

                if (targetDate) {
                    targetDate.setHours(0, 0, 0, 0); // Compare dates only

                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (targetDate < start) matchDate = false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(0, 0, 0, 0);
                        if (targetDate > end) matchDate = false;
                    }
                } else if (dateFilterType === 'updatedAt') {
                    // If filtering by updated at but record matches search criteria otherwise, 
                    // and we have a filter active, maybe exclude? 
                    // If user selects a date range for updates, show only those with updates in that range.
                    // If record has no updatedAt, it shouldn't match.
                    matchDate = false;
                }
            }

            return matchSearch && matchShare && matchPayment && matchGroup && matchDay && matchDate;
        });

        // Default sort: waiting_approval first, then by createdAt desc
        return result.sort((a, b) => {
            // Prioritize waiting_approval
            if (a.status === 'waiting_approval' && b.status !== 'waiting_approval') return -1;
            if (a.status !== 'waiting_approval' && b.status === 'waiting_approval') return 1;

            // Secondary: newest first
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [records, search, filterShareType, filterPayment, filterGroup, filterDay, startDate, endDate, dateFilterType]);

    // Summary
    const totalCount = filteredAndSorted.length;
    const totalAmount = filteredAndSorted.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const totalPaid = filteredAndSorted.reduce((s, r) => s + (r.depositAmount || 0), 0);
    const totalRemaining = totalAmount - totalPaid;

    // Helper functions (Moved back into scope)
    function showToast(type: string, message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    async function handleDelete(id: string) {
        try {
            await deleteRecord(id);
            showToast('success', 'Kayıt silindi!');
            setDeleteConfirm(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }


    // Export PDF
    async function exportPdf() {
        const robotoRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
        const robotoBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

        try {
            const jsPDFModule = await import('jspdf');
            const jsPDF = jsPDFModule.default;
            const autoTableModule = await import('jspdf-autotable');
            const autoTable = autoTableModule.default;

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

            doc.setFont(fontToUse, 'bold');
            doc.setFontSize(18);
            doc.text('Kurban Hissedarları Listesi', 14, 22);

            doc.setFont(fontToUse, 'normal');
            doc.setFontSize(11);
            doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

            // PDF Export
            const tableColumn = ["Sıra", "Sipariş No", "Sipariş Tarihi", "Ad Soyad", "Telefon", "Hisse", "Grup", "Gün", "Toplam", "Kalan", "Not"];
            const tableRows: any[] = [];

            filteredAndSorted.forEach((r, index) => {
                const group = groups.find(g => g.id === r.groupId);
                const kalan = (r.totalPrice || 0) - r.depositAmount;
                const rowData = [
                    index + 1,
                    r.orderNumber || '-',
                    new Date(r.createdAt).toLocaleDateString('tr-TR'),
                    r.ownerName,
                    r.phone,
                    r.shareTypeName || '-',
                    group ? group.name : '-',
                    r.daySelection ? `${r.daySelection}. Gün` : '-',
                    `${(r.totalPrice || 0).toLocaleString('tr-TR')} ₺`,
                    `${kalan.toLocaleString('tr-TR')} ₺`,
                    r.notes || ''
                ];
                tableRows.push(rowData);
            });

            // Call autoTable as a function
            // @ts-ignore
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                styles: {
                    font: fontToUse,
                    fontSize: 8,
                    cellPadding: 2,
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

            doc.save(`kurban_listesi_${new Date().toLocaleDateString('tr-TR')}.pdf`);

        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('PDF oluşturulurken bir hata oluştu: ' + (error as any).message);
        }
    }

    function exportExcel() {
        import('xlsx').then((XLSX) => {
            // Prepare Data
            const title = [`KURBAN HİSSEDARLARI LİSTESİ - ${new Date().toLocaleDateString('tr-TR')}`];
            const headers = ['Sıra', 'Sipariş No', 'Sipariş Tarihi', 'Ad Soyad', 'Telefon', 'Yedek Tel', 'Hisse', 'Grup', 'Gün', 'Toplam', 'Ödenen', 'Kalan', 'Ödeme Türü', 'Vade', 'Açıklama'];

            const dataRows = filteredAndSorted.map((r, i) => {
                const group = groups.find(g => g.id === r.groupId);
                const kalan = (r.totalPrice || 0) - r.depositAmount;
                return [
                    i + 1,
                    r.orderNumber || '',
                    new Date(r.createdAt).toLocaleDateString('tr-TR'),
                    r.ownerName,
                    r.phone,
                    r.phoneBackup || '',
                    r.shareTypeName || '',
                    group ? group.name : 'Yok',
                    r.daySelection ? `${r.daySelection}. Gün` : '',
                    r.totalPrice || 0,
                    r.depositAmount || 0,
                    kalan,
                    r.paymentType === 'nakit' ? 'Nakit' : r.paymentType === 'kredi_karti' ? 'Kredi Kartı' : r.paymentType === 'online_kredi_karti' ? 'Online Kredi Kartı' : r.paymentType === 'teslimatta' ? 'Tamamı Teslimatta' : 'Havale',
                    r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '',
                    r.notes || ''
                ];
            });

            // Calculate Totals
            const totalTutar = filteredAndSorted.reduce((acc, r) => acc + (r.totalPrice || 0), 0);
            const totalOdenen = filteredAndSorted.reduce((acc, r) => acc + (r.depositAmount || 0), 0);
            const totalKalan = totalTutar - totalOdenen;

            const footerRow = ['', '', '', '', '', '', '', 'GENEL TOPLAM:', totalTutar, totalOdenen, totalKalan, '', '', '', ''];

            // Combine all data
            const wsData = [
                title,
                [], // Empty row
                headers,
                ...dataRows,
                [], // Empty row
                footerRow
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Column Widths
            const colWidths = [
                { wch: 5 },  // Sıra
                { wch: 10 }, // Sipariş No
                { wch: 25 }, // Ad Soyad
                { wch: 15 }, // Telefon
                { wch: 15 }, // Yedek Tel
                { wch: 15 }, // Hisse
                { wch: 20 }, // Grup
                { wch: 10 }, // Gün
                { wch: 15 }, // Toplam
                { wch: 15 }, // Ödenen
                { wch: 15 }, // Kalan
                { wch: 15 }, // Ödeme Türü
                { wch: 12 }, // Vade
                { wch: 12 }, // Kayıt Tarihi
                { wch: 40 }  // Açıklama
            ];
            ws['!cols'] = colWidths;

            // Merge Title
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Kayıtlar');
            XLSX.writeFile(wb, `kurban_listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
        });
    }

    if (loading && records.length === 0) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>📋 Kayıtlar</h2>
                <div className="top-bar-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => loadData(true)} title="Yenile">
                        <FiRefreshCw /> Yenile
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={exportPdf}>
                        <FiDownload /> PDF
                    </button>
                    <button className="btn btn-success btn-sm" onClick={exportExcel}>
                        <FiDownload /> Excel
                    </button>
                </div>
            </div>

            <div className="page-content">
                {/* Summary */}
                <div className="summary-bar">
                    <div className="summary-item">
                        <span className="summary-value" style={{ color: 'var(--accent-primary)' }}>{totalCount}</span>
                        <span className="summary-label">Kayıt Sayısı</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-value">{totalAmount.toLocaleString('tr-TR')} ₺</span>
                        <span className="summary-label">Toplam Tutar</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-value" style={{ color: 'var(--accent-success)' }}>{totalPaid.toLocaleString('tr-TR')} ₺</span>
                        <span className="summary-label">Ödenen Tutar</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-value" style={{ color: 'var(--accent-danger)' }}>{totalRemaining.toLocaleString('tr-TR')} ₺</span>
                        <span className="summary-label">Kalan Tutar</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
                    <div className="search-input" style={{ minWidth: 200, flex: 1 }}>
                        <FiSearch className="search-icon" />
                        <input
                            placeholder="İsim, telefon, sipariş no veya açıklama ile ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                        <option value="">Tüm Günler</option>
                        <option value="1">1. Gün</option>
                        <option value="2">2. Gün</option>
                        <option value="3">3. Gün</option>
                    </select>

                    <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
                        <option value="">Tüm Gruplar</option>
                        <option value="null">Grupsuzlar</option>
                        {groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
                    </select>

                    <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterShareType} onChange={(e) => setFilterShareType(e.target.value)}>
                        <option value="">Tüm Hisseler</option>
                        {shareTypes.map((st) => (<option key={st.id} value={st.id}>{st.name}</option>))}
                    </select>

                    <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
                        <option value="">Tüm Ödemeler</option>
                        <option value="nakit">Nakit</option>
                        <option value="kredi_karti">Kredi Kartı</option>
                        <option value="online_kredi_karti">Online Kredi Kartı</option>
                        <option value="havale">Havale</option>
                        <option value="teslimatta">Tamamı Teslimatta</option>
                    </select>

                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <select
                            className="form-select"
                            style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
                            value={dateFilterType}
                            onChange={(e) => setDateFilterType(e.target.value as 'createdAt' | 'updatedAt')}
                        >
                            <option value="createdAt">Sipariş Tarihi</option>
                            <option value="updatedAt">Güncelleme Tarihi</option>
                        </select>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', minWidth: 130 }}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            title="Başlangıç Tarihi"
                        />
                        <span style={{ color: '#999' }}>-</span>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', minWidth: 130 }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            title="Bitiş Tarihi"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Durum</th>
                                <th>Sipariş No</th>
                                <th>{dateFilterType === 'updatedAt' ? 'Güncelleme T.' : 'Sipariş Tarihi'}</th>
                                <th>Ad Soyad</th>
                                <th>Telefon / Yedek</th>
                                <th>Hisse / Grup</th>
                                <th>Kesim Günü</th>
                                <th>Toplam</th>
                                <th>Ödenen / Kalan</th>
                                <th>Personel</th>
                                <th>Ödeme Türü</th>
                                <th>Vade</th>
                                <th>Açıklama</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSorted.length > 0 ? filteredAndSorted.map((r, i) => {
                                const kalan = (r.totalPrice || 0) - r.depositAmount;
                                const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && kalan > 0;
                                const group = groups.find(g => g.id === r.groupId);

                                return (
                                    <tr key={r.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td>
                                            {r.status === 'approved' ? (
                                                <span className="badge badge-success" style={{ fontSize: 11 }}>Onaylandı</span>
                                            ) : (
                                                <span className="badge badge-warning" style={{ fontSize: 11 }}>Bekliyor</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600, color: '#666' }}>#{r.orderNumber || '-'}</td>
                                        <td style={{ fontSize: 12, color: '#555' }}>
                                            {dateFilterType === 'updatedAt'
                                                ? (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('tr-TR') : '-')
                                                : new Date(r.createdAt).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>
                                            {r.ownerName}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13 }}>{r.phone}</div>
                                            {r.phoneBackup && <div style={{ fontSize: 11, color: '#666' }}>Yedek: {r.phoneBackup}</div>}
                                        </td>
                                        <td>
                                            <span className="badge badge-primary" style={{ marginBottom: 2, display: 'inline-block' }}>{r.shareTypeName}</span>
                                            {group && <div style={{ fontSize: 12, color: '#555' }}>{group.name}</div>}
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: r.daySelection === 1 ? '#2e7d32' : '#f57f17',
                                                backgroundColor: r.daySelection === 1 ? '#e8f5e9' : '#fffde7',
                                                padding: '2px 6px',
                                                borderRadius: 4
                                            }}>
                                                {r.daySelection}. Gün
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{(r.totalPrice || 0).toLocaleString('tr-TR')} ₺</td>
                                        <td>
                                            <div style={{ color: 'var(--accent-success)', fontSize: 13 }}>{r.depositAmount.toLocaleString('tr-TR')} ₺</div>
                                            {kalan > 0 && <div style={{ color: 'var(--accent-danger)', fontSize: 12, fontWeight: 500 }}>Kalan: {kalan.toLocaleString('tr-TR')} ₺</div>}
                                        </td>
                                        <td style={{ fontSize: 12, color: '#666' }}>
                                            {r.createdBy || '-'}
                                        </td>
                                        <td style={{ fontSize: 13, fontWeight: 500 }}>
                                            {r.paymentType === 'nakit' ? 'Nakit' :
                                                r.paymentType === 'kredi_karti' ? 'Kredi Kartı' :
                                                    r.paymentType === 'online_kredi_karti' ? 'Online K.K.' :
                                                        r.paymentType === 'teslimatta' ? 'Teslimatta' : 'Havale'}
                                        </td>
                                        <td style={{ color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: 13 }}>
                                            {r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '—'}
                                        </td>
                                        <td style={{ maxWidth: 200 }}>
                                            <div style={{ fontSize: 13, color: '#444', maxHeight: 60, overflowY: 'auto' }}>{r.notes || '—'}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    className="btn btn-icon btn-sm btn-ghost"
                                                    onClick={() => setEditRecord({ ...r })}
                                                    title="Düzenle"
                                                >
                                                    <FiEdit />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-sm btn-ghost"
                                                    style={{ color: 'var(--accent-danger)' }}
                                                    onClick={() => setDeleteConfirm(r.id)}
                                                    title="Sil"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={14} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        Kayıt bulunamadı
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shared Edit Modal */}
            {editRecord && (
                <RecordEditModal
                    record={editRecord}
                    onClose={() => setEditRecord(null)}
                    isAdminView={false}
                    onSave={() => {
                        showToast('success', 'Kayıt güncellendi!');
                        loadData();
                    }}
                />
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h3>Kayıt Sil</h3></div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Bu kaydı silmek istediğinize emin misiniz?</p>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>İptal</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}><FiTrash2 /> Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </>
    );
}
