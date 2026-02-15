'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiArrowRight, FiX, FiCheck, FiUsers } from 'react-icons/fi';
import { getGroups, getShareTypes, getRecords, addGroup, updateGroup, deleteGroup, removeMemberFromGroup, addMemberToGroup, updateRecord } from '@/lib/firestore';
import type { ShareType, Group, Record as RecordType } from '@/types';

export default function GruplarPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [records, setRecords] = useState<RecordType[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

    // Modal state
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupShareType, setNewGroupShareType] = useState('');

    // Move modal
    const [moveModal, setMoveModal] = useState<{ recordId: string; fromGroupId: string } | null>(null);
    const [moveTargetGroup, setMoveTargetGroup] = useState('');

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Edit description
    const [editingDesc, setEditingDesc] = useState<{ groupId: string; value: string } | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [grps, types, recs] = await Promise.all([getGroups(), getShareTypes(), getRecords()]);
            setGroups(grps);
            setShareTypes(types);
            setRecords(recs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Group by share type
    const groupsByShareType: { [key: string]: { shareType: ShareType; groups: Group[] } } = {};
    shareTypes.forEach((st) => {
        groupsByShareType[st.id] = { shareType: st, groups: [] };
    });
    groups.forEach((g) => {
        if (groupsByShareType[g.shareTypeId]) {
            groupsByShareType[g.shareTypeId].groups.push(g);
        }
    });

    function getRecordName(recordId: string) {
        return records.find((r) => r.id === recordId)?.ownerName || 'Bilinmeyen';
    }

    async function handleCreateGroup() {
        if (!newGroupName.trim() || !newGroupShareType) return;
        try {
            const st = shareTypes.find(s => s.id === newGroupShareType);
            await addGroup({
                name: newGroupName.trim(),
                shareTypeId: newGroupShareType,
                shareTypeName: st?.name || '',
                description: '',
                memberIds: [],
            });
            showToast('success', 'Grup oluşturuldu!');
            setShowNewGroup(false);
            setNewGroupName('');
            setNewGroupShareType('');
            await loadData();
        } catch { showToast('error', 'Hata oluştu!'); }
    }

    async function handleDeleteGroup(groupId: string) {
        try {
            await deleteGroup(groupId);
            showToast('success', 'Grup silindi!');
            setDeleteConfirm(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    async function handleRemoveMember(groupId: string, recordId: string) {
        try {
            await removeMemberFromGroup(groupId, recordId);
            await updateRecord(recordId, { groupId: null });
            showToast('success', 'Üye gruptan çıkartıldı!');
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    async function handleMoveMember() {
        if (!moveModal || !moveTargetGroup) return;
        try {
            await removeMemberFromGroup(moveModal.fromGroupId, moveModal.recordId);
            await addMemberToGroup(moveTargetGroup, moveModal.recordId);
            await updateRecord(moveModal.recordId, { groupId: moveTargetGroup });
            showToast('success', 'Üye taşındı!');
            setMoveModal(null);
            setMoveTargetGroup('');
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    async function handleSaveDescription(groupId: string, desc: string) {
        try {
            await updateGroup(groupId, { description: desc });
            setEditingDesc(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    function showToast(type: string, message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>;

    return (
        <>
            <div className="top-bar">
                <h2>👥 Gruplar</h2>
                <button className="btn btn-primary" onClick={() => setShowNewGroup(true)}>
                    <FiPlus /> Yeni Grup Oluştur
                </button>
            </div>

            <div className="page-content">
                {Object.entries(groupsByShareType).map(([stId, { shareType, groups: stGroups }]) => (
                    stGroups.length > 0 && (
                        <div key={stId} className="groups-category">
                            <h3>{shareType.name} HİSSELER</h3>
                            <div className="groups-grid">
                                {stGroups.map((group) => (
                                    <div key={group.id} className="group-card">
                                        <div className="group-card-header">
                                            <span><FiUsers style={{ marginRight: 8 }} />{group.name}</span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    className="btn btn-icon btn-sm btn-ghost"
                                                    title="Grubu Sil"
                                                    onClick={() => setDeleteConfirm(group.id)}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="group-card-body">
                                            {group.memberIds.length > 0 ? (
                                                group.memberIds.map((memberId) => (
                                                    <div key={memberId} className="group-member">
                                                        <span className="group-member-name">{getRecordName(memberId)}</span>
                                                        <div className="group-member-actions">
                                                            <button className="btn btn-sm btn-ghost" title="Düzenle">
                                                                <FiEdit />
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-ghost"
                                                                style={{ color: 'var(--accent-danger)' }}
                                                                title="Sil"
                                                                onClick={() => handleRemoveMember(group.id, memberId)}
                                                            >
                                                                <FiTrash2 />
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-ghost"
                                                                style={{ color: 'var(--accent-warning)' }}
                                                                title="Taşı"
                                                                onClick={() => setMoveModal({ recordId: memberId, fromGroupId: group.id })}
                                                            >
                                                                <FiArrowRight />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                                    Henüz üye yok
                                                </div>
                                            )}
                                        </div>
                                        <div className="group-card-footer">
                                            {editingDesc?.groupId === group.id ? (
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <input
                                                        className="form-input"
                                                        value={editingDesc.value}
                                                        onChange={(e) => setEditingDesc({ ...editingDesc, value: e.target.value })}
                                                        placeholder="Grup açıklaması"
                                                        style={{ fontSize: 13, padding: '6px 10px' }}
                                                    />
                                                    <button className="btn btn-sm btn-success" onClick={() => handleSaveDescription(group.id, editingDesc.value)}>
                                                        <FiCheck />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    style={{ cursor: 'pointer', fontStyle: 'italic', fontSize: 13, color: 'var(--text-muted)' }}
                                                    onClick={() => setEditingDesc({ groupId: group.id, value: group.description })}
                                                >
                                                    {group.description || 'Grup açıklaması ekle...'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}

                {groups.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">👥</div>
                        <p>Henüz grup oluşturulmamış</p>
                        <button className="btn btn-primary" onClick={() => setShowNewGroup(true)}>
                            <FiPlus /> İlk Grubu Oluştur
                        </button>
                    </div>
                )}
            </div>

            {/* New Group Modal */}
            {showNewGroup && (
                <div className="modal-backdrop" onClick={() => setShowNewGroup(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Yeni Grup Oluştur</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowNewGroup(false)}><FiX /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Grup Adı</label>
                            <input className="form-input" placeholder="Grup adı" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Hisse Tipi</label>
                            <select className="form-select" value={newGroupShareType} onChange={(e) => setNewGroupShareType(e.target.value)}>
                                <option value="">Seçin</option>
                                {shareTypes.map((st) => (<option key={st.id} value={st.id}>{st.name}</option>))}
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowNewGroup(false)}>İptal</button>
                            <button className="btn btn-success" onClick={handleCreateGroup} disabled={!newGroupName.trim() || !newGroupShareType}>
                                <FiPlus /> Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Modal */}
            {moveModal && (
                <div className="modal-backdrop" onClick={() => setMoveModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Üyeyi Taşı</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setMoveModal(null)}><FiX /></button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Hedef Grup</label>
                            <select className="form-select" value={moveTargetGroup} onChange={(e) => setMoveTargetGroup(e.target.value)}>
                                <option value="">Grup seçin</option>
                                {groups.filter(g => g.id !== moveModal.fromGroupId).map((g) => (
                                    <option key={g.id} value={g.id}>{g.name} ({g.shareTypeName})</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setMoveModal(null)}>İptal</button>
                            <button className="btn btn-warning" onClick={handleMoveMember} disabled={!moveTargetGroup}>
                                <FiArrowRight /> Taşı
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Grubu Sil</h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Bu grubu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                        </p>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>İptal</button>
                            <button className="btn btn-danger" onClick={() => handleDeleteGroup(deleteConfirm)}>
                                <FiTrash2 /> Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </>
    );
}
