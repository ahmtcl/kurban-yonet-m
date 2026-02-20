'use client';

import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSettings, FiX, FiDownload, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { getGroups, getShareTypes, getRecords, removeMemberFromGroup, updateRecord, updateGroup, deleteGroup, getSettings } from '@/lib/firestore';
import type { Group, ShareType, Record } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import MoveToGroupModal from '@/components/modals/MoveToGroupModal';
import AddMemberToGroupModal from '@/components/modals/AddMemberToGroupModal';
import * as XLSX from 'xlsx';

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
    const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);

    // Unassigned List State
    const [unassignedSearch, setUnassignedSearch] = useState('');
    const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupShareType, setNewGroupShareType] = useState('');

    // Group Selection for Export
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

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

    async function handleBulkCreateGroup() {
        if (!newGroupName.trim() || !newGroupShareType || selectedUnassignedIds.length === 0) return;
        try {
            const st = shareTypes.find(s => s.id === newGroupShareType);
            if (!st) return;

            // NEW: Compatibility Check
            const incompatibleMembers = selectedUnassignedIds.map(id => records.find(r => r.id === id)).filter(r => {
                if (!r) return false;
                const memberST = shareTypes.find(mst => mst.id === r.shareTypeId);
                if (!memberST) return false;
                return memberST.minKg !== st.minKg || memberST.maxKg !== st.maxKg;
            });

            if (incompatibleMembers.length > 0) {
                const confirmMix = confirm(
                    `Seçtiğiniz ${incompatibleMembers.length} kişinin kilo aralığı, grup tipi (${st.name}) ile tam eşleşmiyor. \n\nYine de devam etmek istiyor musunuz?`
                );
                if (!confirmMix) return;
            }

            const { addGroup, addMemberToGroup } = await import('@/lib/firestore');

            const groupRef = await addGroup({
                name: newGroupName.trim(),
                shareTypeId: newGroupShareType,
                shareTypeName: st.name || '',
                description: `${selectedUnassignedIds.length} kişi ile oluşturuldu.`,
                memberIds: []
            });

            await Promise.all(selectedUnassignedIds.map(async (rid) => {
                await updateRecord(rid, { groupId: groupRef.id });
                await addMemberToGroup(groupRef.id, rid);
            }));

            setShowBulkGroupModal(false);
            setSelectedUnassignedIds([]);
            setNewGroupName('');
            setRefreshTrigger(prev => prev + 1);
            alert('Yeni grup oluşturuldu ve üyeler atandı!');
        } catch (error) {
            console.error(error);
            alert('Hata oluştu.');
        }
    }

    // Unassigned Shareholders
    const unassignedShareholders = records.filter(r => !r.groupId || r.groupId === '');
    const filteredUnassigned = unassignedShareholders.filter(r =>
        r.ownerName.toLowerCase().includes(unassignedSearch.toLowerCase()) ||
        (r.phone && r.phone.includes(unassignedSearch))
    );

    // Group selection helpers
    const allGroupIds = groups.map(g => g.id);
    const allSelected = allGroupIds.length > 0 && allGroupIds.every(id => selectedGroupIds.includes(id));

    function toggleSelectAllGroups() {
        if (allSelected) {
            setSelectedGroupIds([]);
        } else {
            setSelectedGroupIds([...allGroupIds]);
        }
    }

    function toggleGroupSelection(groupId: string) {
        setSelectedGroupIds(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    }

    function exportSelectedGroupsToExcel() {
        const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));

        // Build rows: each member as a row
        type ExcelRow = {
            'Hisse Tipi': string;
            'Grup Adı': string;
            'Sıra No': number;
            'Ad Soyad': string;
            'Telefon': string;
            'Ödeme Türü': string;
            'Toplam Tutar (₺)': string | number;
            'Kapora (₺)': string | number;
            'Kalan (₺)': string | number;
        };

        const rows: ExcelRow[] = [];

        // Sort selected groups: first by shareType name (alphabetical), then by group name
        const sortedGroups = [...selectedGroups].sort((a, b) => {
            const stA = shareTypes.find(st => st.id === a.shareTypeId);
            const stB = shareTypes.find(st => st.id === b.shareTypeId);
            const nameA = stA ? `${stA.minKg ?? ''}-${stA.maxKg ?? ''} ${stA.name}` : a.shareTypeId;
            const nameB = stB ? `${stB.minKg ?? ''}-${stB.maxKg ?? ''} ${stB.name}` : b.shareTypeId;
            if (nameA !== nameB) return nameA.localeCompare(nameB, 'tr');
            return a.name.localeCompare(b.name, 'tr');
        });

        sortedGroups.forEach(group => {
            const shareType = shareTypes.find(st => st.id === group.shareTypeId);
            const shareTypeName = shareType ? shareType.name : group.shareTypeName || 'Bilinmiyor';
            const members = group.memberIds
                .map(id => records.find(r => r.id === id))
                .filter(r => !!r) as Record[];

            members.forEach((member, index) => {
                rows.push({
                    'Hisse Tipi': shareTypeName,
                    'Grup Adı': group.name,
                    'Sıra No': index + 1,
                    'Ad Soyad': member.ownerName || '',
                    'Telefon': member.phone || '',
                    'Ödeme Türü': member.paymentType || '',
                    'Toplam Tutar (₺)': member.totalPrice ?? '',
                    'Kapora (₺)': member.depositAmount ?? '',
                    'Kalan (₺)': member.totalPrice != null && member.depositAmount != null
                        ? member.totalPrice - member.depositAmount
                        : '',
                });
            });

            // Empty separator row between groups
            rows.push({
                'Hisse Tipi': '',
                'Grup Adı': '',
                'Sıra No': 0,
                'Ad Soyad': '',
                'Telefon': '',
                'Ödeme Türü': '',
                'Toplam Tutar (₺)': '',
                'Kapora (₺)': '',
                'Kalan (₺)': '',
            });
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 20 }, // Hisse Tipi
            { wch: 20 }, // Grup Adı
            { wch: 8 },  // Sıra No
            { wch: 25 }, // Ad Soyad
            { wch: 15 }, // Telefon
            { wch: 18 }, // Ödeme Durumu
            { wch: 18 }, // Toplam
            { wch: 14 }, // Ödenen
            { wch: 14 }, // Kalan
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gruplar');
        const fileName = `Gruplar_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedGroupIds.length > 0 && (
                        <span style={{
                            background: 'var(--accent-primary)',
                            color: '#fff',
                            borderRadius: 20,
                            padding: '2px 10px',
                            fontSize: 13,
                            fontWeight: 600
                        }}>
                            {selectedGroupIds.length} grup seçili
                        </span>
                    )}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={toggleSelectAllGroups}
                        title={allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                        {allSelected ? <FiCheckSquare /> : <FiSquare />}
                        {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </button>
                    <button
                        className="btn btn-success btn-sm"
                        onClick={exportSelectedGroupsToExcel}
                        disabled={selectedGroupIds.length === 0}
                        title="Seçili grupları Excel'e aktar"
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                        <FiDownload /> Excel'e Aktar
                        {selectedGroupIds.length > 0 && ` (${selectedGroupIds.length})`}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                        setRefreshTrigger(prev => prev + 1);
                        alert('Veriler yenilendi.');
                    }}>
                        Yenile
                    </button>
                </div>
            </div>

            <div className="page-content" style={{ paddingBottom: 50 }}>
                {/* UNASSIGNED SECTION */}
                <div className="card" style={{ marginBottom: 40, border: '2px dashed var(--accent-primary)', background: '#f0f9ff' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid #e0f2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            📌 Gruplandırılmamış Hissedarlar ({unassignedShareholders.length})
                        </h3>
                        {selectedUnassignedIds.length > 0 && (
                            <button className="btn btn-success btn-sm" onClick={() => setShowBulkGroupModal(true)}>
                                <FiPlus /> Seçilenlerden Grup Oluştur ({selectedUnassignedIds.length})
                            </button>
                        )}
                    </div>
                    <div style={{ padding: 16 }}>
                        <div className="form-group" style={{ maxWidth: 400, marginBottom: 15 }}>
                            <input
                                className="form-input"
                                placeholder="Grupsuzlar içinde ara..."
                                value={unassignedSearch}
                                onChange={(e) => setUnassignedSearch(e.target.value)}
                            />
                        </div>
                        <div style={{
                            maxHeight: 300,
                            overflowY: 'auto',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                            gap: 10
                        }}>
                            {filteredUnassigned.map(r => (
                                <label key={r.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    border: '1px solid #e0f2fe',
                                    borderRadius: 6,
                                    background: selectedUnassignedIds.includes(r.id) ? '#dbeffe' : '#fff',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedUnassignedIds.includes(r.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedUnassignedIds([...selectedUnassignedIds, r.id]);
                                            else setSelectedUnassignedIds(selectedUnassignedIds.filter(id => id !== r.id));
                                        }}
                                    />
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.ownerName}</div>
                                        <div style={{ fontSize: 11, color: '#666' }}>{r.shareTypeName}</div>
                                    </div>
                                    <button
                                        className="btn btn-icon btn-ghost btn-sm"
                                        style={{ marginLeft: 'auto', padding: 2 }}
                                        onClick={(e) => { e.preventDefault(); setEditRecord(r); }}
                                    >
                                        <FiEdit />
                                    </button>
                                </label>
                            ))}
                            {filteredUnassigned.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: '#999', fontStyle: 'italic' }}>
                                    Gruplandırılacak hissedar bulunamadı.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

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
                                            background: selectedGroupIds.includes(group.id) ? '#1a5276' : '#2c3e50',
                                            color: '#fff',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'background 0.2s'
                                        }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedGroupIds.includes(group.id)}
                                                    onChange={() => toggleGroupSelection(group.id)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#27ae60' }}
                                                />
                                                <span style={{ fontWeight: 600, fontSize: 16 }}>{group.name}</span>
                                            </label>
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
                    isAdminView={false}
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

            {/* Bulk Group Modal */}
            {showBulkGroupModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkGroupModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Seçilenlerden Yeni Grup Oluştur</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowBulkGroupModal(false)}><FiX /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 20, fontSize: 14 }}>
                                Seçilen <strong>{selectedUnassignedIds.length}</strong> hissedar için yeni bir grup oluşturulacaktır.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Grup Adı</label>
                                <input
                                    className="form-input"
                                    placeholder="Örn: 2. Gün B Grubu"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hisse Tipi</label>
                                <select
                                    className="form-select"
                                    value={newGroupShareType}
                                    onChange={(e) => setNewGroupShareType(e.target.value)}
                                >
                                    <option value="">Seçiniz...</option>
                                    {shareTypes.map(st => (
                                        <option key={st.id} value={st.id}>{st.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowBulkGroupModal(false)}>İptal</button>
                            <button
                                className="btn btn-success"
                                onClick={handleBulkCreateGroup}
                                disabled={!newGroupName.trim() || !newGroupShareType}
                            >
                                Grubu Oluştur ve Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reuse FiX from elsewhere in icons if needed */}
            <style jsx>{`
                .modal-backdrop { z-index: 1000; }
            `}</style>
        </>
    );
}
