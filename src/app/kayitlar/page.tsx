'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiDownload, FiX, FiCheck, FiFilter } from 'react-icons/fi';
import { getRecords, getShareTypes, deleteRecord, updateRecord, getGroups } from '@/lib/firestore';
import type { Record as RecordType, ShareType, PaymentType, Group } from '@/types';

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

    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Edit modal
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [recs, types, grps] = await Promise.all([
                getRecords(),
                getShareTypes(),
                getGroups()
            ]);
            setRecords(recs);
            setShareTypes(types);
            setGroups(grps);
        } catch (err) {
            console.error(err);
        } finally { setLoading(false); }
    }

    const filtered = useMemo(() => {
        return records.filter((r) => {
            const matchSearch = !search ||
                r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
                r.phone.includes(search) ||
                r.notes?.toLowerCase().includes(search.toLowerCase());
            const matchShare = !filterShareType || r.shareTypeId === filterShareType;
            const matchPayment = !filterPayment || r.paymentType === filterPayment;
            const matchGroup = !filterGroup || r.groupId === filterGroup;
            const matchDay = !filterDay || r.daySelection?.toString() === filterDay;

            return matchSearch && matchShare && matchPayment && matchGroup && matchDay;
        });
    }, [records, search, filterShareType, filterPayment, filterGroup, filterDay]);

    // Summary
    const totalCount = filtered.length;
    const totalAmount = filtered.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const totalPaid = filtered.reduce((s, r) => s + (r.depositAmount || 0), 0);
    const totalRemaining = totalAmount - totalPaid;

    async function handleDelete(id: string) {
        try {
            await deleteRecord(id);
            showToast('success', 'Kayıt silindi!');
            setDeleteConfirm(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    async function handleUpdateRecord() {
        if (!editRecord) return;
        try {
            await updateRecord(editRecord.id, {
                ownerName: editRecord.ownerName,
                phone: editRecord.phone,
                phoneBackup: editRecord.phoneBackup,
                depositAmount: editRecord.depositAmount,
                paymentType: editRecord.paymentType,
                notes: editRecord.notes,
                dueDate: editRecord.dueDate,
                daySelection: editRecord.daySelection,
                // Group update is not requested here, keeping simple edit
            });
            showToast('success', 'Kayıt güncellendi!');
            setEditRecord(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    function exportExcel() {
        import('xlsx').then((XLSX) => {
            const data = filtered.map((r) => {
                const group = groups.find(g => g.id === r.groupId);
                return {
                    'Ad Soyad': r.ownerName,
                    'Telefon': r.phone,
                    'Hisse': r.shareTypeName || '',
                    'Grup': group ? group.name : 'Yok',
                    'Gün': r.daySelection ? `${r.daySelection}. Gün` : '',
                    'Toplam': r.totalPrice,
                    'Ödenen': r.depositAmount,
                    'Kalan': (r.totalPrice || 0) - r.depositAmount,
                    'Ödeme Türü': r.paymentType === 'nakit' ? 'Nakit' : r.paymentType === 'kredi_karti' ? 'Kredi Kartı' : 'Havale',
                    'Vade': r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '',
                    'Kayıt Tarihi': new Date(r.createdAt).toLocaleDateString('tr-TR'),
                    'Açıklama': r.notes,
                };
            });
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Kayıtlar');
            XLSX.writeFile(wb, `kayitlar_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
        });
    }

    function showToast(type: string, message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>📋 Kayıtlar</h2>
                <div className="top-bar-actions">
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
                        <span className="summary-value" style={{ color: 'var(--accent-warning)' }}>{totalRemaining.toLocaleString('tr-TR')} ₺</span>
                        <span className="summary-label">Kalan Tutar</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
                    <div className="search-input" style={{ minWidth: 200, flex: 1 }}>
                        <FiSearch className="search-icon" />
                        <input
                            placeholder="Ad soyad, telefon veya açıklama ile ara..."
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
                        <option value="havale">Havale</option>
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Ad Soyad</th>
                                <th>Telefon</th>
                                <th>Hisse</th>
                                <th>Grup</th>
                                <th>Gün</th>
                                <th>Toplam</th>
                                <th>Ödenen</th>
                                <th>Kalan</th>
                                <th>Vade</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length > 0 ? filtered.map((r, i) => {
                                const kalan = (r.totalPrice || 0) - r.depositAmount;
                                const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && kalan > 0;
                                const group = groups.find(g => g.id === r.groupId);

                                return (
                                    <tr key={r.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ fontWeight: 500 }}>
                                            {r.ownerName}
                                            {r.notes && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes}</div>}
                                        </td>
                                        <td style={{ fontSize: 13 }}>{r.phone}</td>
                                        <td><span className="badge badge-primary">{r.shareTypeName}</span></td>
                                        <td>
                                            {group ? (
                                                <span style={{ fontSize: 13, fontWeight: 500 }}>{group.name}</span>
                                            ) : (
                                                <span style={{ color: '#ccc' }}>—</span>
                                            )}
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
                                        <td>{(r.totalPrice || 0).toLocaleString('tr-TR')} ₺</td>
                                        <td style={{ color: 'var(--accent-success)' }}>{r.depositAmount.toLocaleString('tr-TR')} ₺</td>
                                        <td>
                                            <span className={`badge ${kalan > 0 ? 'badge-warning' : 'badge-success'}`}>
                                                {kalan.toLocaleString('tr-TR')} ₺
                                            </span>
                                        </td>
                                        <td style={{ color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: 13 }}>
                                            {r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '—'}
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
                                    <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        Kayıt bulunamadı
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editRecord && (
                <div className="modal-backdrop" onClick={() => setEditRecord(null)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Kayıt Düzenle</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setEditRecord(null)}><FiX /></button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Ad Soyad</label>
                                <input className="form-input" value={editRecord.ownerName} onChange={(e) => setEditRecord({ ...editRecord, ownerName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefon</label>
                                <input className="form-input" value={editRecord.phone} onChange={(e) => setEditRecord({ ...editRecord, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Yedek Telefon</label>
                                <input className="form-input" value={editRecord.phoneBackup} onChange={(e) => setEditRecord({ ...editRecord, phoneBackup: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ödenen Tutar</label>
                                <input className="form-input" type="number" value={editRecord.depositAmount} onChange={(e) => setEditRecord({ ...editRecord, depositAmount: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Kesim Günü</label>
                                <select className="form-select" value={editRecord.daySelection} onChange={(e) => setEditRecord({ ...editRecord, daySelection: parseInt(e.target.value) as 1 | 2 | 3 })}>
                                    <option value={1}>1. Gün</option>
                                    <option value={2}>2. Gün</option>
                                    <option value={3}>3. Gün</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ödeme Türü</label>
                                <select className="form-select" value={editRecord.paymentType} onChange={(e) => setEditRecord({ ...editRecord, paymentType: e.target.value as PaymentType })}>
                                    <option value="nakit">Nakit</option>
                                    <option value="kredi_karti">Kredi Kartı</option>
                                    <option value="havale">Havale / EFT</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Vade Tarihi</label>
                                <input className="form-input" type="date" value={editRecord.dueDate ? new Date(editRecord.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => setEditRecord({ ...editRecord, dueDate: e.target.value ? new Date(e.target.value) : null })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <textarea className="form-textarea" value={editRecord.notes} onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setEditRecord(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleUpdateRecord}><FiCheck /> Güncelle</button>
                        </div>
                    </div>
                </div>
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
