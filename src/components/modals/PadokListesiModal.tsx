'use client';

import { useState, useEffect } from 'react';
import { FiX, FiDownload, FiFileText } from 'react-icons/fi';
import { getGroups, getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import { generatePadokListesiPDF } from '@/utils/pdfGenerator';
import { generatePadokListesiExcel } from '@/utils/excelGenerator';
import type { Group, Record, ShareType, Settings } from '@/types';

interface Props {
    onClose: () => void;
}

export default function PadokListesiModal({ onClose }: Props) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [records, setRecords] = useState<Record[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    const [day, setDay] = useState<1 | 2 | 3>(1);
    const [kucukbasTypeId, setKucukbasTypeId] = useState('');
    const [generating, setGenerating] = useState<'pdf' | 'excel' | null>(null);

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
                if (st.length > 0) setKucukbasTypeId(st[0].id);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Büyükbaş grupların önizleme sayısı
    const nonKucukbasIds = shareTypes.filter(st => st.id !== kucukbasTypeId).map(st => st.id);
    const previewGroups = groups.filter(g => {
        if (!nonKucukbasIds.includes(g.shareTypeId)) return false;
        if (g.memberIds.length === 0) return false;
        const fm = records.find(r => r.id === g.memberIds[0]);
        return fm?.daySelection === day;
    });

    // Tip bazlı özet
    const typeSummary: Record<string, number> = {};
    previewGroups.forEach(g => {
        const st = shareTypes.find(s => s.id === g.shareTypeId);
        const label = st?.name || 'Diğer';
        typeSummary[label] = (typeSummary[label] || 0) + 1;
    });

    const handleGenerate = async (format: 'pdf' | 'excel') => {
        if (!kucukbasTypeId) return;
        setGenerating(format);
        try {
            if (format === 'pdf') {
                await generatePadokListesiPDF(groups, records, shareTypes, settings, day, kucukbasTypeId);
            } else {
                await generatePadokListesiExcel(groups, records, shareTypes, settings, day, kucukbasTypeId);
            }
        } catch (e) {
            console.error(e);
            alert('Dosya oluşturulurken hata oluştu.');
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal modal-lg">
                <div className="modal-header">
                    <h3>Padok Listesi</h3>
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={onClose}
                        style={{
                            background: 'rgba(0,0,0,0.07)',
                            border: '1px solid rgba(0,0,0,0.15)',
                        }}
                    >
                        <FiX />
                    </button>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : (
                    <>
                        {/* Seçenekler */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                            <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Kesim Günü</label>
                                    <select
                                        className="form-select"
                                        value={day}
                                        onChange={e => setDay(Number(e.target.value) as 1 | 2 | 3)}
                                    >
                                        <option value={1}>1. Gün</option>
                                        <option value={2}>2. Gün</option>
                                        <option value={3}>3. Gün</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Küçükbaş Hisse Tipi (hariç tutulacak)</label>
                                    <select
                                        className="form-select"
                                        value={kucukbasTypeId}
                                        onChange={e => setKucukbasTypeId(e.target.value)}
                                    >
                                        {shareTypes.map(st => (
                                            <option key={st.id} value={st.id}>{st.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Özet */}
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
                                Büyükbaş Gruplar — {day}. Gün Özeti
                            </div>
                            {previewGroups.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#999' }}>
                                    Bu güne ait büyükbaş grubu bulunamadı.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                                    {Object.entries(typeSummary).map(([label, cnt]) => (
                                        <div key={label} style={{
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center',
                                            background: '#f0f4ff',
                                            border: '1px solid #c7d7f8',
                                            borderRadius: 4,
                                            padding: '6px 14px',
                                            minWidth: 80,
                                        }}>
                                            <span style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c' }}>{cnt}</span>
                                            <span style={{ fontSize: 11, color: '#666' }}>{label}</span>
                                        </div>
                                    ))}
                                    <div style={{
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center',
                                        background: '#e8f5e9',
                                        border: '1px solid #a5d6a7',
                                        borderRadius: 4,
                                        padding: '6px 14px',
                                        minWidth: 80,
                                    }}>
                                        <span style={{ fontSize: 20, fontWeight: 700, color: '#1b5e20' }}>{previewGroups.length}</span>
                                        <span style={{ fontSize: 11, color: '#666' }}>TOPLAM</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Butonlar */}
                        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
                            <button
                                className="btn btn-danger"
                                style={{ minWidth: 150, gap: 8 }}
                                disabled={!!generating || previewGroups.length === 0}
                                onClick={() => handleGenerate('pdf')}
                            >
                                {generating === 'pdf' ? (
                                    <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> PDF Oluşturuluyor...</>
                                ) : (
                                    <><FiFileText /> PDF İndir</>
                                )}
                            </button>
                            <button
                                className="btn btn-success"
                                style={{ minWidth: 150, gap: 8 }}
                                disabled={!!generating || previewGroups.length === 0}
                                onClick={() => handleGenerate('excel')}
                            >
                                {generating === 'excel' ? (
                                    <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Excel Oluşturuluyor...</>
                                ) : (
                                    <><FiDownload /> Excel İndir</>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
