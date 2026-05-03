'use client';

import { useState, useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { getGroups, getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import { generateKesimListesiPDF } from '@/utils/pdfGenerator';
import type { Group, Record, ShareType, Settings } from '@/types';

interface Props {
    onClose: () => void;
}

export default function KesimListesiModal({ onClose }: Props) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [records, setRecords] = useState<Record[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    const [day, setDay] = useState<1 | 2 | 3>(1);
    const [kucukbasTypeId, setKucukbasTypeId] = useState('');
    const [generating, setGenerating] = useState<'kucukbas' | 'buyukbas' | null>(null);

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

    const handleGenerate = async (type: 'kucukbas' | 'buyukbas') => {
        setGenerating(type);
        try {
            await generateKesimListesiPDF(type, groups, records, shareTypes, settings, day, kucukbasTypeId);
        } catch (e) {
            console.error(e);
            alert('PDF oluşturulurken hata oluştu.');
        } finally {
            setGenerating(null);
        }
    };

    const dayLabel = (d: 1 | 2 | 3) => {
        if (d === 1) return settings?.day1Label || '1. Gün';
        if (d === 2) return settings?.day2Label || '2. Gün';
        return '3. Gün';
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                {/* Header */}
                <div className="modal-header" style={{ background: '#f59e0b', color: '#fff' }}>
                    <h3 style={{ margin: 0 }}>✂️ Kesim Listesi Oluştur</h3>
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
                    <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Veriler yükleniyor...</div>
                ) : (
                    <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

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
                                            border: `2px solid ${day === d ? '#f59e0b' : '#e2e8f0'}`,
                                            background: day === d ? '#fff7ed' : '#fafafa',
                                            fontWeight: day === d ? 700 : 400,
                                            cursor: 'pointer',
                                            color: day === d ? '#b45309' : '#555',
                                            fontSize: 13,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {dayLabel(d)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Küçükbaş */}
                        <div style={{ padding: 16, borderRadius: 10, border: '1.5px solid #d1fae5', background: '#f0fdf4' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#065f46' }}>🐑 Küçükbaş Listesi</div>
                            <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 5, fontWeight: 600 }}>
                                    Küçükbaş Hisse Tipi
                                </label>
                                <select
                                    className="form-select"
                                    value={kucukbasTypeId}
                                    onChange={(e) => setKucukbasTypeId(e.target.value)}
                                    style={{ fontSize: 13 }}
                                >
                                    <option value="">Seçiniz...</option>
                                    {shareTypes.map(st => (
                                        <option key={st.id} value={st.id}>{st.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                style={{
                                    width: '100%',
                                    padding: '9px 0',
                                    background: kucukbasTypeId && !generating ? '#10b981' : '#a7f3d0',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 7,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: kucukbasTypeId && !generating ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    transition: 'background 0.15s',
                                }}
                                disabled={!kucukbasTypeId || generating !== null}
                                onClick={() => handleGenerate('kucukbas')}
                            >
                                {generating === 'kucukbas'
                                    ? 'Oluşturuluyor...'
                                    : <><FiDownload /> A5 PDF Oluştur</>
                                }
                            </button>
                        </div>

                        {/* Büyükbaş */}
                        <div style={{ padding: 16, borderRadius: 10, border: '1.5px solid #fde68a', background: '#fffbeb' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#92400e' }}>🐄 Büyükbaş Listesi</div>
                            <p style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.5 }}>
                                Seçilen güne ait tüm büyükbaş grupları, kesim sırasına göre ayrı A5 sayfalar halinde PDF'e aktarılır.
                            </p>
                            <button
                                style={{
                                    width: '100%',
                                    padding: '9px 0',
                                    background: !generating ? '#f59e0b' : '#fde68a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 7,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: !generating ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    transition: 'background 0.15s',
                                }}
                                disabled={generating !== null}
                                onClick={() => handleGenerate('buyukbas')}
                            >
                                {generating === 'buyukbas'
                                    ? 'Oluşturuluyor...'
                                    : <><FiDownload /> A5 PDF Oluştur</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
