'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiX, FiDownload, FiPrinter } from 'react-icons/fi';
import { getGroups, getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import { generateEtiketPDF, generateKucukbasEtiketPDF } from '@/utils/pdfGenerator';
import type { Group, Record, ShareType, Settings } from '@/types';

interface Props {
    onClose: () => void;
}

export default function EtiketModal({ onClose }: Props) {
    const [groups, setGroups]         = useState<Group[]>([]);
    const [records, setRecords]       = useState<Record[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [settings, setSettings]     = useState<Settings | null>(null);
    const [loading, setLoading]       = useState(true);
    const [day, setDay]               = useState<1 | 2 | 3>(1);
    const [hayvanTuru, setHayvanTuru] = useState<'buyukbas' | 'kucukbas-normal' | 'kucukbas-indirimli'>('buyukbas');
    const [generating, setGenerating] = useState<string | null>(null); // 'all' | groupId | recordId

    useEffect(() => {
        (async () => {
            try {
                const [g, r, st, s] = await Promise.all([
                    getGroups(), getRecords(), getShareTypes(), getSettings(),
                ]);
                setGroups(g);
                setRecords(r);
                setShareTypes(st);
                setSettings(s);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const dayLabel = (d: 1 | 2 | 3) => {
        if (d === 1) return settings?.day1Label || '1. Gün';
        if (d === 2) return settings?.day2Label || '2. Gün';
        return '3. Gün';
    };

    const filteredGroups = useMemo(() =>
        groups
            .filter(g => {
                if (g.memberIds.length === 0) return false;
                const first = records.find(r => r.id === g.memberIds[0]);
                return first?.daySelection === day;
            })
            .sort((a, b) => (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999)),
        [groups, records, day]
    );

    const filteredRecords = useMemo(() => {
        return records
            .filter(r => {
                if (r.daySelection !== day || r.status === 'cancelled') return false;
                const st = shareTypes.find(s => s.id === r.shareTypeId);
                const kt = st?.kucukbasType || 'buyukbas';
                return hayvanTuru === 'kucukbas-indirimli'
                    ? kt === 'kucukbas-indirimli'
                    : kt === 'kucukbas-normal';
            })
            .sort((a, b) => (a.orderNumber ?? 999999) - (b.orderNumber ?? 999999));
    }, [records, groups, day, hayvanTuru, shareTypes]);

    const handleAll = async () => {
        setGenerating('all');
        try {
            if (hayvanTuru === 'buyukbas') {
                await generateEtiketPDF(groups, records, shareTypes, settings, day);
            } else {
                const type = hayvanTuru === 'kucukbas-indirimli' ? 'indirimli' : 'normal';
                await generateKucukbasEtiketPDF(groups, records, shareTypes, settings, day, type);
            }
        } catch (e) {
            console.error(e);
            alert('PDF oluşturulurken hata oluştu.');
        } finally {
            setGenerating(null);
        }
    };

    const handleSingle = async (groupId: string) => {
        setGenerating(groupId);
        try {
            await generateEtiketPDF(groups, records, shareTypes, settings, day, groupId);
        } catch (e) {
            console.error(e);
            alert('PDF oluşturulurken hata oluştu.');
        } finally {
            setGenerating(null);
        }
    };

    const handleSingleRecord = async (recordId: string) => {
        setGenerating(recordId);
        try {
            const type = hayvanTuru === 'kucukbas-indirimli' ? 'indirimli' : 'normal';
            await generateKucukbasEtiketPDF(groups, records, shareTypes, settings, day, type, recordId);
        } catch (e) {
            console.error(e);
            alert('PDF oluşturulurken hata oluştu.');
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ background: '#10b981', color: '#fff', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>🏷️ Etiket Bas</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px solid rgba(255,255,255,0.5)',
                            borderRadius: 6,
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            fontSize: 18,
                        }}
                    >
                        <FiX />
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>
                        Veriler yükleniyor...
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '16px 20px', flexShrink: 0, borderBottom: '1px solid #e5e7eb' }}>
                            {/* Hayvan Türü */}
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#333' }}>
                                Hayvan Türü
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                {([
                                    { key: 'buyukbas',           label: '🐄 Büyükbaş',          color: '#6366f1' },
                                    { key: 'kucukbas-normal',    label: '🐑 Normal Küçükbaş',   color: '#10b981' },
                                    { key: 'kucukbas-indirimli', label: '🏷️ İndirimli Küçükbaş', color: '#f59e0b' },
                                ] as const).map(({ key, label, color }) => (
                                    <button
                                        key={key}
                                        onClick={() => setHayvanTuru(key)}
                                        style={{
                                            flex: 1,
                                            padding: '8px 4px',
                                            borderRadius: 8,
                                            border: `2px solid ${hayvanTuru === key ? color : '#e2e8f0'}`,
                                            background: hayvanTuru === key ? `${color}18` : '#fafafa',
                                            fontWeight: hayvanTuru === key ? 700 : 400,
                                            cursor: 'pointer',
                                            color: hayvanTuru === key ? color : '#555',
                                            fontSize: 12,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Kesim günü */}
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#333' }}>
                                Kesim Günü
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                {([1, 2, 3] as const).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDay(d)}
                                        style={{
                                            flex: 1,
                                            padding: '8px 4px',
                                            borderRadius: 8,
                                            border: `2px solid ${day === d ? '#10b981' : '#e2e8f0'}`,
                                            background: day === d ? '#ecfdf5' : '#fafafa',
                                            fontWeight: day === d ? 700 : 400,
                                            cursor: 'pointer',
                                            color: day === d ? '#065f46' : '#555',
                                            fontSize: 13,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {dayLabel(d)}
                                    </button>
                                ))}
                            </div>

                            {/* Özet + Tümünü Bas */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 13, color: '#6b7280' }}>
                                    {hayvanTuru === 'buyukbas'
                                        ? `${filteredGroups.length} grup · ${filteredGroups.reduce((a, g) => a + g.memberIds.length, 0)} kişi`
                                        : `${filteredRecords.length} kayıt`
                                    }
                                </span>
                                <button
                                    onClick={handleAll}
                                    disabled={generating !== null || (hayvanTuru === 'buyukbas' ? filteredGroups.length === 0 : filteredRecords.length === 0)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 14px',
                                        background: (() => {
                                            const empty = hayvanTuru === 'buyukbas' ? filteredGroups.length === 0 : filteredRecords.length === 0;
                                            if (generating !== null || empty) return '#a7f3d0';
                                            return hayvanTuru === 'kucukbas-indirimli' ? '#f59e0b' : '#10b981';
                                        })(),
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 7,
                                        fontWeight: 700,
                                        fontSize: 13,
                                        cursor: generating !== null ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {generating === 'all'
                                        ? 'Oluşturuluyor...'
                                        : <><FiPrinter /> Tümünü Bas ({hayvanTuru === 'buyukbas' ? filteredGroups.length : filteredRecords.length})</>
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Liste */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 20px 16px' }}>
                            {hayvanTuru === 'buyukbas' ? (
                                /* ── BÜYÜKBAŞ: Grup listesi ── */
                                filteredGroups.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: 13, marginTop: 24 }}>
                                        ⚠️ Seçilen güne ait grup bulunamadı.
                                    </p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>KESİM SIRA</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>GRUP ADI</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>HİSSE TİPİ</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>KİŞİ</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, color: '#6b7280', fontWeight: 600 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredGroups.map(group => {
                                                const st = shareTypes.find(s => s.id === group.shareTypeId);
                                                const isGenerating = generating === group.id;
                                                return (
                                                    <tr key={group.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '8px 6px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                                                            {group.kesimSiraNo ?? '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontSize: 13 }}>{group.name}</td>
                                                        <td style={{ padding: '8px 6px', fontSize: 12, color: '#6b7280' }}>
                                                            {st?.name || group.shareTypeName || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 13 }}>
                                                            {group.memberIds.length}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleSingle(group.id)}
                                                                disabled={generating !== null}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    padding: '4px 10px',
                                                                    background: generating !== null ? '#d1fae5' : '#10b981',
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    borderRadius: 5,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    cursor: generating !== null ? 'not-allowed' : 'pointer',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                            >
                                                                {isGenerating ? '...' : <><FiDownload size={11} /> Etiket Bas</>}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )
                            ) : (
                                /* ── KÜÇÜKBAŞ: Kayıt listesi ── */
                                filteredRecords.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: 13, marginTop: 24 }}>
                                        ⚠️ Seçilen güne ait kayıt bulunamadı.
                                    </p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>KESİM SIRA</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>AD SOYAD</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>HİSSE TİPİ</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, color: '#6b7280', fontWeight: 600 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.map((record, idx) => {
                                                const st = shareTypes.find(s => s.id === record.shareTypeId);
                                                const isGenerating = generating === record.id;
                                                const btnColor = hayvanTuru === 'kucukbas-indirimli' ? '#f59e0b' : '#10b981';
                                                const btnColorDisabled = hayvanTuru === 'kucukbas-indirimli' ? '#fde68a' : '#d1fae5';
                                                return (
                                                    <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '8px 6px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                                                            {idx + 1}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', fontSize: 13 }}>{record.ownerName}</td>
                                                        <td style={{ padding: '8px 6px', fontSize: 12, color: '#6b7280' }}>
                                                            {st?.name || record.shareTypeName || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleSingleRecord(record.id)}
                                                                disabled={generating !== null}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    padding: '4px 10px',
                                                                    background: generating !== null ? btnColorDisabled : btnColor,
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    borderRadius: 5,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    cursor: generating !== null ? 'not-allowed' : 'pointer',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                            >
                                                                {isGenerating ? '...' : <><FiDownload size={11} /> Etiket Bas</>}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
