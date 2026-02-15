'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiDownload, FiDollarSign, FiUsers } from 'react-icons/fi';
import { getRecords, getShareTypes } from '@/lib/firestore';
import type { Record as RecordType, ShareType } from '@/types';

export default function RaporlarPage() {
    const [records, setRecords] = useState<RecordType[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterShareType, setFilterShareType] = useState('');

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [recs, types] = await Promise.all([getRecords(), getShareTypes()]);
            setRecords(recs);
            setShareTypes(types);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    const filtered = useMemo(() => {
        return records.filter((r) => {
            const matchSearch = !search || r.ownerName.toLowerCase().includes(search.toLowerCase());
            const matchShare = !filterShareType || r.shareTypeId === filterShareType;
            return matchSearch && matchShare;
        });
    }, [records, search, filterShareType]);

    // Name-based grouping for sub-totals
    const nameGroups = useMemo(() => {
        const map: { [name: string]: { records: RecordType[]; total: number; paid: number } } = {};
        filtered.forEach((r) => {
            const key = r.ownerName.toLowerCase().trim();
            if (!map[key]) map[key] = { records: [], total: 0, paid: 0 };
            map[key].records.push(r);
            map[key].total += r.totalPrice || 0;
            map[key].paid += r.depositAmount || 0;
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    }, [filtered]);

    const totalCount = filtered.length;
    const totalAmount = filtered.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const totalPaid = filtered.reduce((s, r) => s + (r.depositAmount || 0), 0);
    const totalRemaining = totalAmount - totalPaid;

    function exportExcel() {
        import('xlsx').then((XLSX) => {
            const data = filtered.map((r) => ({
                'Ad Soyad': r.ownerName,
                'Telefon': r.phone,
                'Hisse Tipi': r.shareTypeName || '',
                'Toplam Tutar': r.totalPrice,
                'Ödenen Tutar': r.depositAmount,
                'Kalan Tutar': (r.totalPrice || 0) - r.depositAmount,
                'Ödeme Türü': r.paymentType === 'nakit' ? 'Nakit' : r.paymentType === 'kredi_karti' ? 'Kredi Kartı' : 'Havale',
                'Vade Tarihi': r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '',
                'Kayıt Tarihi': new Date(r.createdAt).toLocaleDateString('tr-TR'),
                'Açıklama': r.notes,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
            XLSX.writeFile(wb, `rapor_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
        });
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>📊 Raporlar</h2>
                <button className="btn btn-success btn-sm" onClick={exportExcel}>
                    <FiDownload /> Excel İndir
                </button>
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
                <div className="filter-bar">
                    <div className="search-input">
                        <FiSearch className="search-icon" />
                        <input
                            placeholder="İsim ile arama yapın..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={filterShareType} onChange={(e) => setFilterShareType(e.target.value)}>
                        <option value="">Tüm Hisseler</option>
                        {shareTypes.map((st) => (<option key={st.id} value={st.id}>{st.name}</option>))}
                    </select>
                </div>

                {/* Report List */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Ad Soyad</th>
                                <th>Kayıt Sayısı</th>
                                <th>Toplam Tutar</th>
                                <th>Ödenen</th>
                                <th>Kalan</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nameGroups.length > 0 ? nameGroups.map(([name, data]) => {
                                const remaining = data.total - data.paid;
                                return (
                                    <tr key={name}>
                                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{name}</td>
                                        <td>
                                            <span className="badge badge-info">{data.records.length}</span>
                                        </td>
                                        <td>{data.total.toLocaleString('tr-TR')} ₺</td>
                                        <td style={{ color: 'var(--accent-success)' }}>{data.paid.toLocaleString('tr-TR')} ₺</td>
                                        <td>
                                            <span className={`badge ${remaining > 0 ? 'badge-warning' : 'badge-success'}`}>
                                                {remaining.toLocaleString('tr-TR')} ₺
                                            </span>
                                        </td>
                                        <td>
                                            {remaining <= 0 ? (
                                                <span className="badge badge-success">✓ Tamamlandı</span>
                                            ) : (
                                                <span className="badge badge-warning">Bekliyor</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        Kayıt bulunamadı
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {nameGroups.length > 0 && (
                            <tfoot>
                                <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)' }}>
                                    <td>GENEL TOPLAM</td>
                                    <td><span className="badge badge-primary">{totalCount}</span></td>
                                    <td>{totalAmount.toLocaleString('tr-TR')} ₺</td>
                                    <td style={{ color: 'var(--accent-success)' }}>{totalPaid.toLocaleString('tr-TR')} ₺</td>
                                    <td><span className="badge badge-warning">{totalRemaining.toLocaleString('tr-TR')} ₺</span></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </>
    );
}
