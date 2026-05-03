'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiDownload, FiRefreshCw, FiX } from 'react-icons/fi';
import { getRecords, getShareTypes, deleteRecord, getGroups } from '@/lib/firestore';
import type { Record as RecordType, ShareType, Group } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import { useAuth } from '@/context/AuthContext';

interface Props {
    onClose: () => void;
}

export default function IptalEdilenlerModal({ onClose }: Props) {
    const [records, setRecords] = useState<RecordType[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAuth();

    // Filtreler
    const [search, setSearch] = useState('');
    const [filterShareType, setFilterShareType] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [filterCreatedBy, setFilterCreatedBy] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData(showFeedback = false) {
        setLoading(true);
        try {
            const [recs, types, grps] = await Promise.all([
                getRecords(),
                getShareTypes(),
                getGroups(),
            ]);
            // Sadece iptali onaylananlar
            setRecords(recs.filter(r => r.status === 'cancelled'));
            setShareTypes(types);
            setGroups(grps);
            if (showFeedback) showToast('success', 'Veriler yenilendi.');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

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
        } catch {
            showToast('error', 'Silme başarısız!');
        }
    }

    const filteredAndSorted = useMemo(() => {
        return records
            .filter(r => {
                const matchSearch =
                    !search ||
                    r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
                    r.phone.includes(search) ||
                    (r.orderNumber && r.orderNumber.toString().includes(search)) ||
                    r.notes?.toLowerCase().includes(search.toLowerCase());
                const matchShare = !filterShareType || r.shareTypeId === filterShareType;
                const matchDay = !filterDay || r.daySelection?.toString() === filterDay;
                const matchCreatedBy = !filterCreatedBy || r.createdBy === filterCreatedBy;

                let matchDate = true;
                if (startDate || endDate) {
                    const d = new Date(r.createdAt);
                    d.setHours(0, 0, 0, 0);
                    if (startDate) {
                        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
                        if (d < s) matchDate = false;
                    }
                    if (endDate) {
                        const e = new Date(endDate); e.setHours(0, 0, 0, 0);
                        if (d > e) matchDate = false;
                    }
                }

                return matchSearch && matchShare && matchDay && matchDate && matchCreatedBy;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [records, search, filterShareType, filterDay, filterCreatedBy, startDate, endDate]);

    // Özet
    const totalCount = filteredAndSorted.length;
    const totalAmount = filteredAndSorted.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const totalPaid = filteredAndSorted.reduce((s, r) => s + (r.depositAmount || 0), 0);

    // Export PDF
    async function exportPdf() {
        try {
            const jsPDFModule = await import('jspdf');
            const jsPDF = jsPDFModule.default;
            const autoTableModule = await import('jspdf-autotable');
            const autoTable = autoTableModule.default;
            const doc = new jsPDF();

            const robotoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
            const robotoBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

            const loadFont = async (url: string, name: string, style: string) => {
                try {
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
                    doc.addFileToVFS(`${name}-${style}.ttf`, b64);
                    doc.addFont(`${name}-${style}.ttf`, name, style);
                } catch { /* ignore */ }
            };

            await Promise.all([
                loadFont(robotoUrl, 'Roboto', 'normal'),
                loadFont(robotoBoldUrl, 'Roboto', 'bold'),
            ]);

            const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';
            doc.setFont(font, 'bold');
            doc.setFontSize(16);
            doc.text('İptal Edilen Kayıtlar', 14, 20);
            doc.setFont(font, 'normal');
            doc.setFontSize(10);
            doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

            const cols = ['Sıra', 'Sipariş No', 'Sipariş Tarihi', 'Ad Soyad', 'Telefon', 'Hisse', 'Gün', 'Toplam', 'Ödenen', 'Not'];
            const rows = filteredAndSorted.map((r, i) => [
                i + 1,
                r.orderNumber || '-',
                new Date(r.createdAt).toLocaleDateString('tr-TR'),
                r.ownerName,
                r.phone,
                r.shareTypeName || '-',
                r.daySelection ? `${r.daySelection}. Gün` : '-',
                `${(r.totalPrice || 0).toLocaleString('tr-TR')} ₺`,
                `${(r.depositAmount || 0).toLocaleString('tr-TR')} ₺`,
                r.notes || '',
            ]);

            // @ts-ignore
            autoTable(doc, {
                head: [cols],
                body: rows,
                startY: 33,
                styles: { font, fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
                headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [255, 245, 245] },
            });

            doc.save(`iptal-edilenler-${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.pdf`);
        } catch (err) {
            console.error(err);
            alert('PDF oluşturulurken hata oluştu.');
        }
    }

    // Export Excel
    async function exportExcel() {
        try {
            const ExcelJS = (await import('exceljs')).default;
            const { saveAs } = await import('file-saver');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('İptal Edilenler');

            const titleRow = sheet.addRow([`İPTAL EDİLEN KAYITLAR — ${new Date().toLocaleDateString('tr-TR')}`]);
            titleRow.font = { bold: true, size: 14, name: 'Calibri' };
            sheet.mergeCells('A1:L1');
            titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
            titleRow.height = 24;
            sheet.addRow([]);

            const headers = ['Sıra', 'Sipariş No', 'Sipariş Tarihi', 'Ad Soyad', 'Telefon', 'Yedek Tel', 'Hisse', 'Gün', 'Toplam', 'Ödenen', 'Kalan', 'Not'];
            const headerRow = sheet.addRow(headers);
            headerRow.height = 20;
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            });

            filteredAndSorted.forEach((r, i) => {
                const kalan = (r.totalPrice || 0) - (r.depositAmount || 0);
                const row = sheet.addRow([
                    i + 1,
                    r.orderNumber || '',
                    new Date(r.createdAt).toLocaleDateString('tr-TR'),
                    r.ownerName,
                    r.phone,
                    r.phoneBackup || '',
                    r.shareTypeName || '',
                    r.daySelection ? `${r.daySelection}. Gün` : '',
                    r.totalPrice || 0,
                    r.depositAmount || 0,
                    kalan,
                    r.notes || '',
                ]);
                row.height = 17;
                row.eachCell((cell, col) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFF5F5' : 'FFFFFFFF' } };
                    cell.font = { size: 10, name: 'Calibri' };
                    cell.alignment = { vertical: 'middle', horizontal: col === 4 || col === 12 ? 'left' : 'center' };
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                    if (col >= 9 && col <= 11) cell.numFmt = '#,##0" ₺"';
                });
            });

            sheet.columns = [
                { width: 6 }, { width: 12 }, { width: 14 }, { width: 28 }, { width: 14 },
                { width: 14 }, { width: 20 }, { width: 10 }, { width: 14 }, { width: 14 },
                { width: 14 }, { width: 35 },
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `iptal-edilenler-${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`);
        } catch (err) {
            console.error(err);
            alert('Excel oluşturulurken hata oluştu.');
        }
    }

    const createdByList = useMemo(() => Array.from(new Set(records.map(r => r.createdBy).filter(Boolean))), [records]);

    return (
        <>
            {/* Ana modal — tam ekran */}
            <div className="modal-backdrop" style={{ alignItems: 'flex-start', padding: '0', overflow: 'hidden' }}>
                <div style={{
                    background: '#fff',
                    width: '100%',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div className="top-bar" style={{ flexShrink: 0 }}>
                        <h2>🚫 İptal Edilenler</h2>
                        <div className="top-bar-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => loadData(true)}>
                                <FiRefreshCw /> Yenile
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={exportPdf}>
                                <FiDownload /> PDF
                            </button>
                            <button className="btn btn-success btn-sm" onClick={exportExcel}>
                                <FiDownload /> Excel
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={onClose}
                                style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)' }}
                            >
                                <FiX /> Kapat
                            </button>
                        </div>
                    </div>

                    {/* İçerik */}
                    <div className="page-content" style={{ flex: 1, overflowY: 'auto' }}>
                        {/* Özet */}
                        <div className="summary-bar">
                            <div className="summary-item">
                                <span className="summary-value" style={{ color: 'var(--accent-danger)' }}>{totalCount}</span>
                                <span className="summary-label">İptal Sayısı</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value">{totalAmount.toLocaleString('tr-TR')} ₺</span>
                                <span className="summary-label">Toplam Tutar</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value" style={{ color: 'var(--accent-success)' }}>{totalPaid.toLocaleString('tr-TR')} ₺</span>
                                <span className="summary-label">Alınan Kapora</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value" style={{ color: 'var(--accent-danger)' }}>{(totalAmount - totalPaid).toLocaleString('tr-TR')} ₺</span>
                                <span className="summary-label">İptal Edilen Kalan</span>
                            </div>
                        </div>

                        {/* Filtreler */}
                        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
                            <div className="search-input" style={{ minWidth: 200, flex: 1 }}>
                                <FiSearch className="search-icon" />
                                <input
                                    placeholder="İsim, telefon, sipariş no veya not ile ara..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>

                            <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                                <option value="">Tüm Günler</option>
                                <option value="1">1. Gün</option>
                                <option value="2">2. Gün</option>
                                <option value="3">3. Gün</option>
                            </select>

                            <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterShareType} onChange={e => setFilterShareType(e.target.value)}>
                                <option value="">Tüm Hisseler</option>
                                {shareTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                            </select>

                            <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={filterCreatedBy} onChange={e => setFilterCreatedBy(e.target.value)}>
                                <option value="">Tüm Personeller</option>
                                {createdByList.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>

                            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                <input
                                    type="date"
                                    className="form-input"
                                    style={{ width: 'auto', minWidth: 130 }}
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    title="Başlangıç Tarihi"
                                />
                                <span style={{ color: '#999' }}>-</span>
                                <input
                                    type="date"
                                    className="form-input"
                                    style={{ width: 'auto', minWidth: 130 }}
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    title="Bitiş Tarihi"
                                />
                            </div>
                        </div>

                        {/* Tablo */}
                        {loading ? (
                            <div className="loading"><div className="spinner" /></div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Sipariş No</th>
                                            <th>Sipariş Tarihi</th>
                                            <th>Ad Soyad</th>
                                            <th>Telefon / Yedek</th>
                                            <th>Hisse / Grup</th>
                                            <th>Kesim Günü</th>
                                            <th>Toplam</th>
                                            <th>Ödenen / Kalan</th>
                                            <th>Personel</th>
                                            <th>Ödeme Türü</th>
                                            <th>Açıklama</th>
                                            {isAdmin && <th>İşlem</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAndSorted.length > 0 ? filteredAndSorted.map((r, i) => {
                                            const kalan = (r.totalPrice || 0) - (r.depositAmount || 0);
                                            const group = groups.find(g => g.id === r.groupId);
                                            return (
                                                <tr key={r.id} style={{ background: '#fff5f5' }}>
                                                    <td style={{ color: '#999' }}>{i + 1}</td>
                                                    <td style={{ fontWeight: 600, color: '#666' }}>#{r.orderNumber || '-'}</td>
                                                    <td style={{ fontSize: 12, color: '#555' }}>
                                                        {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{r.ownerName}</td>
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
                                                            fontSize: 12, fontWeight: 600,
                                                            color: r.daySelection === 1 ? '#2e7d32' : '#f57f17',
                                                            backgroundColor: r.daySelection === 1 ? '#e8f5e9' : '#fffde7',
                                                            padding: '2px 6px', borderRadius: 4,
                                                        }}>
                                                            {r.daySelection}. Gün
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{(r.totalPrice || 0).toLocaleString('tr-TR')} ₺</td>
                                                    <td>
                                                        <div style={{ color: r.depositAmount > 0 ? 'var(--accent-success)' : '#94a3b8', fontSize: 13, fontWeight: r.depositAmount > 0 ? 500 : 400 }}>
                                                            {r.depositAmount > 0 ? `${r.depositAmount.toLocaleString('tr-TR')} ₺` : '—'}
                                                        </div>
                                                        {kalan > 0 && <div style={{ color: 'var(--accent-danger)', fontSize: 12, fontWeight: 500 }}>Kalan: {kalan.toLocaleString('tr-TR')} ₺</div>}
                                                    </td>
                                                    <td style={{ fontSize: 12, color: '#666' }}>{r.createdBy || '-'}</td>
                                                    <td style={{ fontSize: 13 }}>
                                                        {r.paymentType === 'nakit' ? 'Nakit' :
                                                            r.paymentType === 'kredi_karti' ? 'Kredi Kartı' :
                                                                r.paymentType === 'online_kredi_karti' ? 'Online K.K.' :
                                                                    r.paymentType === 'teslimatta' ? 'Teslimatta' : 'Havale'}
                                                    </td>
                                                    <td style={{ maxWidth: 180 }}>
                                                        <div style={{ fontSize: 13, color: '#444', maxHeight: 60, overflowY: 'auto' }}>{r.notes || '—'}</div>
                                                    </td>
                                                    {isAdmin && (
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
                                                                    className="btn btn-icon btn-sm btn-danger"
                                                                    onClick={() => setDeleteConfirm(r.id)}
                                                                    title="Sil"
                                                                >
                                                                    <FiTrash2 />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={isAdmin ? 13 : 12} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                                                    İptal edilmiş kayıt bulunamadı.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editRecord && (
                <RecordEditModal
                    record={editRecord}
                    onClose={() => setEditRecord(null)}
                    isAdminView={isAdmin}
                    onSave={() => {
                        showToast('success', 'Kayıt güncellendi!');
                        setEditRecord(null);
                        loadData();
                    }}
                />
            )}

            {/* Silme onayı */}
            {deleteConfirm && (
                <div className="modal-backdrop" style={{ zIndex: 400 }} onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h3>Kayıt Sil</h3></div>
                        <p style={{ color: '#666', marginBottom: 20 }}>Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?</p>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>İptal</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                <FiTrash2 /> Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`} style={{ zIndex: 500 }}>{toast.message}</div>}
        </>
    );
}
