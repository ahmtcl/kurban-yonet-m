'use client';

import { useState, useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { getGroups, getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import { generateTahsilatListesiExcel } from '@/utils/excelGenerator';
import type { Group, Record, ShareType, Settings } from '@/types';

interface Props {
    onClose: () => void;
}

export default function TahsilatListesiModal({ onClose }: Props) {
    const [groups, setGroups]         = useState<Group[]>([]);
    const [records, setRecords]       = useState<Record[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [settings, setSettings]     = useState<Settings | null>(null);
    const [loading, setLoading]       = useState(true);
    const [day, setDay]               = useState<1 | 2 | 3>(1);
    const [generating, setGenerating] = useState(false);

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

    // Seçilen güne ait grup sayısı ve kişi sayısı
    const filteredGroups = groups.filter(g => {
        if (g.memberIds.length === 0) return false;
        const first = records.find(r => r.id === g.memberIds[0]);
        return first?.daySelection === day;
    });
    const totalMembers = filteredGroups.reduce((acc, g) => acc + g.memberIds.length, 0);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await generateTahsilatListesiExcel(groups, records, shareTypes, settings, day);
        } catch (e) {
            console.error(e);
            alert('Excel oluşturulurken hata oluştu.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                {/* Header */}
                <div className="modal-header" style={{ background: '#3b82f6', color: '#fff' }}>
                    <h3 style={{ margin: 0 }}>📋 Tahsilat Listesi Oluştur</h3>
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
                    <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Açıklama */}
                        <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.6 }}>
                            Seçilen güne ait tüm gruplar, <strong>kesim sırasına</strong> göre A4 yatay Excel
                            dosyasına aktarılır. Grup sınırları sayfa kesmez.
                        </p>

                        {/* Renk açıklaması */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, height: 14, background: '#FFFF99', border: '1px solid #ccc', borderRadius: 3, display: 'inline-block' }} />
                                Kapora ödenmiş
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, height: 14, background: '#FFD5D5', border: '1px solid #ccc', borderRadius: 3, display: 'inline-block' }} />
                                İptal edilmiş
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, height: 14, background: '#FFF0CC', border: '1px solid #ccc', borderRadius: 3, display: 'inline-block' }} />
                                İptale alınmış
                            </div>
                        </div>

                        {/* Kesim günü seçimi */}
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#333' }}>Kesim Günü</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {([1, 2, 3] as const).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDay(d)}
                                        style={{
                                            flex: 1,
                                            padding: '9px 4px',
                                            borderRadius: 8,
                                            border: `2px solid ${day === d ? '#3b82f6' : '#e2e8f0'}`,
                                            background: day === d ? '#eff6ff' : '#fafafa',
                                            fontWeight: day === d ? 700 : 400,
                                            cursor: 'pointer',
                                            color: day === d ? '#1d4ed8' : '#555',
                                            fontSize: 13,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {dayLabel(d)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Özet bilgi */}
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            fontSize: 13,
                            color: '#0369a1',
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}>
                            <span>📁 {filteredGroups.length} grup</span>
                            <span>👥 {totalMembers} kayıt</span>
                            <span>📄 ~{Math.ceil(filteredGroups.length * 7 / 44)} sayfa</span>
                        </div>

                        {/* İndir butonu */}
                        <button
                            onClick={handleGenerate}
                            disabled={generating || filteredGroups.length === 0}
                            style={{
                                padding: '11px 0',
                                background: generating || filteredGroups.length === 0 ? '#93c5fd' : '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: generating || filteredGroups.length === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'background 0.15s',
                            }}
                        >
                            {generating
                                ? 'Excel Oluşturuluyor...'
                                : <><FiDownload /> A4 Yatay Excel İndir</>
                            }
                        </button>

                        {filteredGroups.length === 0 && (
                            <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: 13, margin: 0 }}>
                                ⚠️ Seçilen güne ait grup bulunamadı.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
