'use client';

import { useState, useMemo } from 'react';
import { FiX, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import { addMemberToGroup, removeMemberFromGroup, updateRecord, deleteGroup } from '@/lib/firestore';
import type { Group, Record } from '@/types';

interface MergeGroupModalProps {
    targetGroup: Group;
    allGroups: Group[];
    records: Record[];
    onClose: () => void;
    onSuccess: () => void;
}

const MAX_MEMBERS = 7;

export default function MergeGroupModal({ targetGroup, allGroups, records, onClose, onSuccess }: MergeGroupModalProps) {
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Hedef grubun mevcut üyelerinin kesim günü
    const targetDays = useMemo(() => {
        const days = targetGroup.memberIds
            .map(mid => records.find(r => r.id === mid)?.daySelection)
            .filter((d): d is number => d !== undefined);
        return days.length > 0 ? days[0] : null;
    }, [targetGroup, records]);

    // Aynı hisse tipindeki diğer gruplar (kendisi hariç, boş olanlar hariç)
    const candidateGroups = useMemo(() => {
        return allGroups
            .filter(g => g.id !== targetGroup.id && g.shareTypeId === targetGroup.shareTypeId && g.memberIds.length > 0)
            .map(g => {
                const memberDays = g.memberIds
                    .map(mid => records.find(r => r.id === mid)?.daySelection)
                    .filter((d): d is number => d !== undefined);
                const groupDay = memberDays.length > 0 ? memberDays[0] : null;
                const dayMismatch = targetDays !== null && groupDay !== null && groupDay !== targetDays;
                return { group: g, groupDay, dayMismatch };
            });
    }, [allGroups, targetGroup, records, targetDays]);

    // Seçilen gruplardaki toplam üye sayısı
    const selectedMemberCount = useMemo(() => {
        return selectedGroupIds.reduce((acc, gid) => {
            const g = allGroups.find(x => x.id === gid);
            return acc + (g?.memberIds.length || 0);
        }, 0);
    }, [selectedGroupIds, allGroups]);

    const currentCount = targetGroup.memberIds.length;
    const totalAfterMerge = currentCount + selectedMemberCount;
    const overCapacity = totalAfterMerge > MAX_MEMBERS;

    function toggleGroup(gid: string) {
        setSelectedGroupIds(prev =>
            prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
        );
    }

    async function handleMerge() {
        if (selectedGroupIds.length === 0 || overCapacity) return;
        setSaving(true);
        try {
            for (const sourceGroupId of selectedGroupIds) {
                const sourceGroup = allGroups.find(g => g.id === sourceGroupId);
                if (!sourceGroup) continue;

                const memberIds = [...sourceGroup.memberIds];

                // Her üyeyi hedef gruba taşı
                for (const recordId of memberIds) {
                    await updateRecord(recordId, { groupId: targetGroup.id });
                    await addMemberToGroup(targetGroup.id, recordId);
                    await removeMemberFromGroup(sourceGroupId, recordId);
                }

                // Kaynak grup boşaldıysa sil
                const updatedSource = allGroups.find(g => g.id === sourceGroupId);
                const remainingMembers = (updatedSource?.memberIds || []).filter(mid => !memberIds.includes(mid));
                if (remainingMembers.length === 0) {
                    try { await deleteGroup(sourceGroupId); } catch (_) { /* silinemediyse bırak */ }
                }
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Birleştirme sırasında hata oluştu.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                <div className="modal-header" style={{ background: '#7b2d8b', color: '#fff' }}>
                    <h3 style={{ margin: 0 }}>Grupları Birleştir — {targetGroup.name}</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: 6,
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            fontSize: 18,
                            flexShrink: 0,
                        }}
                    >
                        <FiX />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '16px 20px' }}>
                    <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
                        Seçtiğiniz grupların tüm üyeleri <strong>{targetGroup.name}</strong> grubuna taşınacak.
                        Boşalan gruplar otomatik silinecek.
                    </p>

                    {/* Kapasite göstergesi */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: overCapacity ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${overCapacity ? '#fca5a5' : '#86efac'}`,
                        marginBottom: 16,
                        fontSize: 13,
                        fontWeight: 600,
                        color: overCapacity ? '#dc2626' : '#16a34a',
                    }}>
                        {overCapacity ? <FiAlertTriangle /> : <FiCheck />}
                        Birleşim sonrası toplam: {totalAfterMerge} / {MAX_MEMBERS} kişi
                        {overCapacity && ' — Kapasite aşılıyor!'}
                    </div>

                    {candidateGroups.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 30, color: '#999', fontStyle: 'italic' }}>
                            Aynı hisse tipinde birleştirilebilecek başka grup yok.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                            {candidateGroups.map(({ group, groupDay, dayMismatch }) => {
                                const selected = selectedGroupIds.includes(group.id);
                                return (
                                    <label
                                        key={group.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: `1.5px solid ${dayMismatch ? '#f97316' : selected ? '#7b2d8b' : '#e2e8f0'}`,
                                            background: dayMismatch ? '#fff7ed' : selected ? '#f5f0ff' : '#fff',
                                            cursor: dayMismatch ? 'not-allowed' : 'pointer',
                                            opacity: dayMismatch ? 0.7 : 1,
                                            transition: 'border-color 0.15s, background 0.15s',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            disabled={dayMismatch}
                                            onChange={() => toggleGroup(group.id)}
                                            style={{ width: 16, height: 16, accentColor: '#7b2d8b' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</span>
                                            <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                                                {group.memberIds.length} kişi · {groupDay ? `${groupDay}. Gün` : 'Gün belirsiz'}
                                            </span>
                                        </div>
                                        {dayMismatch && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                                                <FiAlertTriangle /> Farklı gün
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
                    <button
                        className="btn"
                        style={{ background: '#7b2d8b', color: '#fff', border: 'none' }}
                        onClick={handleMerge}
                        disabled={selectedGroupIds.length === 0 || overCapacity || saving}
                    >
                        {saving ? 'Birleştiriliyor...' : `Birleştir (${selectedGroupIds.length} grup)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
