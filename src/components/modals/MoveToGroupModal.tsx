'use client';

import { useState, useEffect } from 'react';
import { FiX, FiArrowRight, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { getGroups, updateRecord, addMemberToGroup, removeMemberFromGroup } from '@/lib/firestore';
import type { Group, Record } from '@/types';

interface MoveToGroupModalProps {
    record: Record;
    currentGroupId: string;
    onClose: () => void;
    onMoveSuccess: () => void;
}

export default function MoveToGroupModal({ record, currentGroupId, onClose, onMoveSuccess }: MoveToGroupModalProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    async function loadGroups() {
        try {
            const res = await getGroups();
            // Filter out current group and groups with different share type (optional, but safer)
            // For now, let's filter by share type to prevent mixing basic/premium shares if that matters.
            // If share types don't matter for grouping, remove the filter.
            const compatibleGroups = res.filter(g => g.id !== currentGroupId && g.shareTypeId === record.shareTypeId && g.memberIds.length < 7);
            setGroups(compatibleGroups);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleMove() {
        if (!selectedGroupId) return;
        setSaving(true);
        try {
            // 1. Update record's groupId
            await updateRecord(record.id, { groupId: selectedGroupId });

            // 2. Add to new group's member list
            await addMemberToGroup(selectedGroupId, record.id);

            // 3. Remove from old group's member list
            await removeMemberFromGroup(currentGroupId, record.id);

            onMoveSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Taşıma işlemi sırasında hata oluştu.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <h3>Üye Taşı</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><FiX /></button>
                </div>

                <div className="modal-body">
                    <p style={{ marginBottom: 15 }}>
                        <strong>{record.ownerName}</strong> isimli üyeyi taşımak istediğiniz grubu seçin:
                    </p>

                    {loading ? (
                        <div className="spinner"></div>
                    ) : (
                        <div className="form-group">
                            {groups.length > 0 ? groups.map(g => (
                                <div
                                    key={g.id}
                                    onClick={() => setSelectedGroupId(g.id)}
                                    style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #eee',
                                        cursor: 'pointer',
                                        background: selectedGroupId === g.id ? '#e3f2fd' : '#fff',
                                        color: selectedGroupId === g.id ? '#0d47a1' : 'inherit',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span style={{ fontWeight: 500 }}>{g.name}</span>
                                    <span style={{ fontSize: 12, color: '#666' }}>{g.memberIds.length}/7 Üye</span>
                                </div>
                            )) : (
                                <div style={{ padding: 20, textAlign: 'center', color: '#dc3545', background: '#fff3cd', borderRadius: 4 }}>
                                    <FiAlertTriangle style={{ fontSize: 24, marginBottom: 8 }} />
                                    <div>Bu hisse tipine ({record.shareTypeName}) uygun taşınabilecek başka bir grup bulunamadı.</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
                    <button className="btn btn-primary" onClick={handleMove} disabled={!selectedGroupId || saving}>
                        {saving ? 'Taşınıyor...' : <><FiArrowRight /> Taşı</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
