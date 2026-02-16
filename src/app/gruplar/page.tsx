'use client';

import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSettings } from 'react-icons/fi';
import { getGroups, getShareTypes, getRecords, removeMemberFromGroup, updateRecord, updateGroup, deleteGroup, getSettings } from '@/lib/firestore';
import type { Group, ShareType, Record } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import MoveToGroupModal from '@/components/modals/MoveToGroupModal';
import AddMemberToGroupModal from '@/components/modals/AddMemberToGroupModal';

export default function GruplarPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [records, setRecords] = useState<Record[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modals
    const [editRecord, setEditRecord] = useState<Record | null>(null);
    const [moveRecord, setMoveRecord] = useState<{ record: Record; currentGroupId: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ groupId: string; recordId: string } | null>(null);
    const [addMemberGroup, setAddMemberGroup] = useState<Group | null>(null);

    // Group Edit
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    async function loadData() {
        setLoading(true);
        try {
            const [grps, types, recs, sett] = await Promise.all([
                getGroups(),
                getShareTypes(),
                getRecords(),
                getSettings()
            ]);
            setGroups(grps);
            setShareTypes(types);
            setRecords(recs);
            setSettings(sett);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleRemoveMember(groupId: string, recordId: string) {
        try {
            await removeMemberFromGroup(groupId, recordId);
            // Also update record to remove groupId
            await updateRecord(recordId, { groupId: null });
            setDeleteConfirm(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            alert('Silme işlemi başarısız.');
        }
    }

    async function handleUpdateGroup(group: Group) {
        try {
            await updateGroup(group.id, {
                name: group.name,
                description: group.description
            });
            setEditingGroup(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            alert('Grup güncellenemedi.');
        }
    }

    async function handleDeleteGroup(id: string) {
        if (!confirm('Bu grubu silmek istediğinize emin misiniz? Grup üyeleri silinmeyecek, sadece gruptan çıkarılacaktır.')) return;
        try {
            // Optional: Remove group ID from all members (backend trigger better, but manual here)
            // For now just delete group container. 
            // Better UX: Iterate members and set groupId = null.
            const group = groups.find(g => g.id === id);
            if (group && group.memberIds.length > 0) {
                await Promise.all(group.memberIds.map(mid => updateRecord(mid, { groupId: null })));
            }
            await deleteGroup(id);
            setEditingGroup(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            alert('Grup silinemedi.');
        }
    }

    // Grouping logic
    const groupsByShareType = shareTypes.map(st => {
        const typeGroups = groups.filter(g => g.shareTypeId === st.id);
        const totalMembersInGroups = typeGroups.reduce((acc, g) => acc + g.memberIds.length, 0);
        return {
            shareType: st,
            groups: typeGroups,
            stats: {
                totalGroups: typeGroups.length,
                totalMembers: totalMembersInGroups
            }
        };
    }).filter(item => item.groups.length > 0);

    if (loading && groups.length === 0) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>👥 Gruplar ve Hissedarlar</h2>
                <button className="btn btn-primary btn-sm" onClick={() => {
                    setRefreshTrigger(prev => prev + 1);
                    alert('Veriler yenilendi.');
                }}>
                    Yenile
                </button>
            </div>

            <div className="page-content" style={{ paddingBottom: 50 }}>
                {groupsByShareType.map(({ shareType, groups: typeGroups, stats }) => (
                    <div key={shareType.id} style={{ marginBottom: 40 }}>
                        {/* Header with Stats */}
                        <div style={{
                            textAlign: 'center',
                            borderBottom: '2px solid #ddd',
                            paddingBottom: 10,
                            marginBottom: 20,
                        }}>
                            <h3 style={{
                                textTransform: 'uppercase',
                                color: '#333',
                                letterSpacing: 1,
                                marginBottom: 5
                            }}>
                                {shareType.name}
                            </h3>
                            <div style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>
                                <span style={{ marginRight: 15 }}>📁 {stats.totalGroups} Grup</span>
                                <span>👥 {stats.totalMembers} Kişi</span>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                            gap: 20
                        }}>
                            {typeGroups.map(group => {
                                // Get full record objects for members (maintain order if possible, but firestore array has no efficient order, assume append)
                                const members = group.memberIds
                                    .map(id => records.find(r => r.id === id))
                                    .filter(r => !!r) as Record[];

                                // Fill empty slots if less than 7 (standard cow share) - just for visual consistency if needed
                                // or just show existing.
                                // Mockup shows standard table rows. 

                                return (
                                    <div key={group.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        {/* Group Header */}
                                        <div style={{
                                            padding: '12px 16px',
                                            background: '#2c3e50',
                                            color: '#fff',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ fontWeight: 600, fontSize: 16 }}>{group.name}</span>
                                            <button
                                                className="btn btn-icon btn-sm btn-ghost"
                                                style={{ color: '#fff', opacity: 0.8 }}
                                                onClick={() => setEditingGroup(group)}
                                            >
                                                <FiSettings />
                                            </button>
                                        </div>

                                        {/* Members Table */}
                                        <div style={{ flex: 1 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                    {members.map((member) => (
                                                        <tr key={member.id} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500 }}>
                                                                {member.ownerName}
                                                            </td>
                                                            <td style={{ width: 180, padding: '4px' }}>
                                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        className="btn btn-xs btn-ghost"
                                                                        onClick={() => setEditRecord(member)}
                                                                        title="Düzenle"
                                                                        style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd' }}
                                                                    >
                                                                        Düzenle
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-xs btn-ghost"
                                                                        onClick={() => setDeleteConfirm({ groupId: group.id, recordId: member.id })}
                                                                        title="Gruptan Çıkar"
                                                                        style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd', color: 'var(--accent-danger)' }}
                                                                    >
                                                                        Sil
                                                                    </button>

                                                                    {/* Move Button - Only if Enabled in Settings */}
                                                                    {settings?.moveButtonEnabled && (
                                                                        <button
                                                                            className="btn btn-xs btn-ghost"
                                                                            onClick={() => setMoveRecord({ record: member, currentGroupId: group.id })}
                                                                            title="Başka Gruba Taşı"
                                                                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd', color: 'var(--accent-primary)' }}
                                                                        >
                                                                            Taşı
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Empty Slots Visualization (Optional, creating 7 rows total) */}
                                                    {Array.from({ length: Math.max(0, 7 - members.length) }).map((_, i) => (
                                                        <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #eee', height: 41 }}>
                                                            <td colSpan={2} style={{ background: '#f9f9f9' }}></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Group Description Footer */}
                                        <div style={{
                                            padding: '8px 16px',
                                            background: '#f8f9fa',
                                            borderTop: '1px solid #eee',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            minHeight: 45
                                        }}>
                                            <span style={{ fontSize: 13, color: '#666', fontStyle: 'italic', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {group.description || 'Grup açıklaması yok'}
                                            </span>
                                            <button
                                                className="btn btn-xs btn-primary"
                                                style={{ fontSize: 12, padding: '4px 8px' }}
                                                onClick={() => setAddMemberGroup(group)}
                                            >
                                                <FiPlus /> Üye Ekle
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Record Modal */}
            {editRecord && (
                <RecordEditModal
                    record={editRecord}
                    onClose={() => setEditRecord(null)}
                    onSave={() => setRefreshTrigger(prev => prev + 1)}
                />
            )}

            {/* Move Modal */}
            {moveRecord && (
                <MoveToGroupModal
                    record={moveRecord.record}
                    currentGroupId={moveRecord.currentGroupId}
                    onClose={() => setMoveRecord(null)}
                    onMoveSuccess={() => setRefreshTrigger(prev => prev + 1)}
                />
            )}

            {/* Delete Member Confirm */}
            {deleteConfirm && (
                <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h3>Gruptan Çıkar</h3></div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Bu kişiyi gruptan çıkarmak istediğinize emin misiniz? <br />
                            <small>(Kişi silinmez, sadece gruptan çıkarılır.)</small>
                        </p>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>İptal</button>
                            <button className="btn btn-danger" onClick={() => handleRemoveMember(deleteConfirm.groupId, deleteConfirm.recordId)}>
                                <FiTrash2 /> Çıkar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Group Modal */}
            {editingGroup && (
                <div className="modal-backdrop" onClick={() => setEditingGroup(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Grup Düzenle</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setEditingGroup(null)}><FiEdit /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Grup Adı</label>
                            <input
                                className="form-input"
                                value={editingGroup.name}
                                onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <input
                                className="form-input"
                                value={editingGroup.description}
                                onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                            />
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteGroup(editingGroup.id)}>
                                <FiTrash2 /> Grubu Sil
                            </button>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-ghost" onClick={() => setEditingGroup(null)}>İptal</button>
                                <button className="btn btn-success" onClick={() => handleUpdateGroup(editingGroup)}>Kaydet</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {addMemberGroup && (
                <AddMemberToGroupModal
                    group={addMemberGroup}
                    onClose={() => setAddMemberGroup(null)}
                    onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                />
            )}
        </>
    );
}
