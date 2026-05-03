'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiFilePlus, FiDownload, FiTrash2 } from 'react-icons/fi';
import {
    getRecords,
    getGroups,
    getSettings,
    getVekaletSessions,
    addVekaletSession,
    deleteVekaletSession,
} from '@/lib/firestore';
import { generateVekaletListesiPDF } from '@/utils/pdfGenerator';
import type { Record, Group, Settings, VekaletSession } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface Props {
    onClose: () => void;
}

export default function VekaletListesiModal({ onClose }: Props) {
    const { user } = useAuth();

    const [day, setDay] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [sessions, setSessions] = useState<VekaletSession[]>([]);
    const [allRecords, setAllRecords] = useState<Record[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [newCount, setNewCount] = useState<number | null>(null);

    // ── Veri yükle ──
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [recs, grps, cfg, sess] = await Promise.all([
                getRecords(),
                getGroups(),
                getSettings(),
                getVekaletSessions(day),
            ]);
            setAllRecords(recs);
            setGroups(grps);
            setSettings(cfg);
            setSessions(sess);
        } finally {
            setLoading(false);
        }
    }, [day]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Gün değişince yeniden yükle ──
    useEffect(() => {
        loadData();
        setNewCount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [day]);

    // ── Seçili güne + duruma göre onaylı kayıtlar ──
    const eligibleRecords = allRecords.filter(
        r => r.daySelection === day && r.status === 'approved' && r.groupId,
    );

    // ── Hesapla: Son session'dan sonra eklenen yeni kayıtlar ──
    useEffect(() => {
        if (sessions.length === 0) {
            setNewCount(eligibleRecords.length);
            return;
        }
        const lastSession = sessions[sessions.length - 1];
        const alreadyIncluded = new Set(
            sessions.flatMap(s => s.recordIds),
        );
        const newRecs = eligibleRecords.filter(r => !alreadyIncluded.has(r.id));
        setNewCount(newRecs.length);
    }, [sessions, eligibleRecords]);

    // ── Snapshot mantığı: hangi kayıtlar bu PDF'e girecek ──
    const buildSessionRecords = (): Record[] => {
        if (sessions.length === 0) {
            // İlk liste → tüm onaylı kayıtlar
            return sortRecords(eligibleRecords, groups);
        }
        // Sonraki listeler → son snapshot'tan sonra eklenenler
        const alreadyIncluded = new Set(sessions.flatMap(s => s.recordIds));
        const newRecs = eligibleRecords.filter(r => !alreadyIncluded.has(r.id));
        return sortRecords(newRecs, groups);
    };

    // ── Sıralama: grup kesimSiraNo → grup içi memberIds sırası ──
    const sortRecords = (recs: Record[], grps: Group[]): Record[] => {
        return [...recs].sort((a, b) => {
            const gA = grps.find(g => g.id === a.groupId);
            const gB = grps.find(g => g.id === b.groupId);
            const siraA = gA?.kesimSiraNo ?? 999999;
            const siraB = gB?.kesimSiraNo ?? 999999;
            if (siraA !== siraB) return siraA - siraB;
            // Aynı gruptaysa memberIds sırası
            const membersA = gA?.memberIds ?? [];
            const membersB = gB?.memberIds ?? [];
            return membersA.indexOf(a.id) - membersB.indexOf(b.id);
        });
    };

    // ── Liste oluştur ──
    const handleGenerate = async () => {
        const sessionRecs = buildSessionRecords();
        if (sessionRecs.length === 0) {
            alert('Bu gün için eklenecek yeni kayıt bulunamadı.');
            return;
        }

        setGenerating(true);
        try {
            const listNo = sessions.length + 1;
            const isFirst = sessions.length === 0;
            const label = isFirst
                ? `${day}. Gün — Ana Liste`
                : `${day}. Gün — Ek Liste #${listNo}`;

            // Firestore'a kaydet
            await addVekaletSession({
                day,
                label,
                recordIds: sessionRecs.map(r => r.id),
                count: sessionRecs.length,
                createdBy: user?.username || '',
            });

            // PDF indir
            await generateVekaletListesiPDF(
                sessionRecs,
                groups,
                settings,
                label,
                day,
            );

            // Listeyi yenile
            await loadData();
        } catch (err) {
            console.error(err);
            alert('Liste oluşturulurken hata oluştu.');
        } finally {
            setGenerating(false);
        }
    };

    // ── Geçmiş PDF indir ──
    const handleDownload = async (session: VekaletSession) => {
        setGenerating(true);
        try {
            const recs = session.recordIds
                .map(id => allRecords.find(r => r.id === id))
                .filter((r): r is Record => !!r);
            const sorted = sortRecords(recs, groups);
            await generateVekaletListesiPDF(sorted, groups, settings, session.label, session.day as 1 | 2 | 3);
        } catch (err) {
            console.error(err);
            alert('PDF oluşturulurken hata oluştu.');
        } finally {
            setGenerating(false);
        }
    };

    // ── Session sil ──
    const handleDelete = async (id: string) => {
        if (!confirm('Bu listeyi silmek istediğinize emin misiniz?')) return;
        await deleteVekaletSession(id);
        await loadData();
    };

    const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                style={{ maxWidth: 680, width: '96%', maxHeight: '92vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Vekalet Alma Listesi</h2>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
                            Snap‑shot alır, PDF üretir ve geçmiş listeleri saklar
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onClose} title="Kapat">
                        <FiX size={20} />
                    </button>
                </div>

                {/* Gün seçimi */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                        Kesim Günü
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {([1, 2, 3] as const).map(d => (
                            <button
                                key={d}
                                onClick={() => setDay(d)}
                                style={{
                                    padding: '8px 22px',
                                    borderRadius: 8,
                                    border: day === d ? '2px solid #2563eb' : '2px solid #e5e7eb',
                                    background: day === d ? '#2563eb' : '#fff',
                                    color: day === d ? '#fff' : '#374151',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    transition: 'all .15s',
                                }}
                            >
                                {d}. Gün
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bilgi kutusu */}
                {!loading && newCount !== null && (
                    <div style={{
                        background: newCount > 0 ? '#f0fdf4' : '#fefce8',
                        border: `1.5px solid ${newCount > 0 ? '#86efac' : '#fde68a'}`,
                        borderRadius: 10,
                        padding: '12px 16px',
                        marginBottom: 18,
                        fontSize: 14,
                        color: newCount > 0 ? '#166534' : '#92400e',
                    }}>
                        {sessions.length === 0 ? (
                            <>
                                <strong>İlk Liste:</strong> {day}. gün için toplam{' '}
                                <strong>{newCount}</strong> onaylı kayıt listeye eklenecek.
                            </>
                        ) : newCount > 0 ? (
                            <>
                                Son listeden bu yana <strong>{newCount}</strong> yeni kayıt eklendi.
                                Bu liste yalnızca yeni kayıtları içerecek (<em>Ek Liste #{sessions.length + 1}</em>).
                            </>
                        ) : (
                            <>
                                Son listeden bu yana yeni kayıt eklenmedi. Yine de PDF almak için
                                aşağıdaki geçmiş listelerden tekrar indirebilirsiniz.
                            </>
                        )}
                    </div>
                )}

                {/* Oluştur butonu */}
                <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={generating || loading || (newCount !== null && newCount === 0)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 28,
                        opacity: (generating || loading || (newCount !== null && newCount === 0)) ? 0.6 : 1,
                        cursor: (generating || loading || (newCount !== null && newCount === 0)) ? 'not-allowed' : 'pointer',
                    }}
                >
                    <FiFilePlus size={18} />
                    {generating ? 'Oluşturuluyor...' : sessions.length === 0 ? 'Ana Liste Oluştur ve PDF İndir' : 'Ek Liste Oluştur ve PDF İndir'}
                </button>

                {/* Geçmiş listeler */}
                <div>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>
                        Geçmiş Listeler ({day}. Gün)
                    </h3>

                    {loading && (
                        <p style={{ color: '#888', fontSize: 14 }}>Yükleniyor...</p>
                    )}

                    {!loading && sessions.length === 0 && (
                        <p style={{ color: '#bbb', fontSize: 14 }}>Henüz liste oluşturulmamış.</p>
                    )}

                    {!loading && sessions.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead>
                                    <tr style={{ background: '#f3f4f6' }}>
                                        <th style={thStyle}>Etiket</th>
                                        <th style={thStyle}>Tarih / Saat</th>
                                        <th style={thStyle}>Kayıt Sayısı</th>
                                        <th style={thStyle}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((s, idx) => (
                                        <tr
                                            key={s.id}
                                            style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}
                                        >
                                            <td style={tdStyle}>
                                                <span style={{ fontWeight: 600 }}>{s.label}</span>
                                            </td>
                                            <td style={tdStyle}>{formatDate(s.createdAt)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <span style={{
                                                    background: '#dbeafe',
                                                    color: '#1e40af',
                                                    borderRadius: 12,
                                                    padding: '2px 10px',
                                                    fontWeight: 600,
                                                    fontSize: 13,
                                                }}>
                                                    {s.count}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                    <button
                                                        className="btn-secondary"
                                                        style={{ padding: '4px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
                                                        onClick={() => handleDownload(s)}
                                                        disabled={generating}
                                                        title="PDF İndir"
                                                    >
                                                        <FiDownload size={14} />
                                                        PDF
                                                    </button>
                                                    <button
                                                        className="btn-danger"
                                                        style={{ padding: '4px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
                                                        onClick={() => handleDelete(s.id)}
                                                        title="Sil"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 13,
    color: '#374151',
    borderBottom: '2px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
    padding: '9px 12px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
};
