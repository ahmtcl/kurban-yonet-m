'use client';

import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiSearch } from 'react-icons/fi';
import { getRecords, addMemberToGroup, updateRecord, getShareTypes } from '@/lib/firestore';
import type { Record, Group, ShareType } from '@/types';

interface AddMemberToGroupModalProps {
    group: Group;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddMemberToGroupModal({ group, onClose, onSuccess }: AddMemberToGroupModalProps) {
    const [records, setRecords] = useState<Record[]>([]);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadEligibleRecords();
    }, []);

    async function loadEligibleRecords() {
        try {
            const [allRecords, allShareTypes] = await Promise.all([
                getRecords(),
                getShareTypes()
            ]);
            setShareTypes(allShareTypes);

            const groupST = allShareTypes.find(st => st.id === group.shareTypeId);

            const eligible = allRecords.filter(r => {
                // Not in a group
                if (r.groupId && r.groupId !== '') return false;

                // Check kilo range compatibility
                const memberST = allShareTypes.find(st => st.id === r.shareTypeId);
                if (!groupST || !memberST) return r.shareTypeId === group.shareTypeId;

                return groupST.minKg === memberST.minKg && groupST.maxKg === memberST.maxKg;
            });
            setRecords(eligible);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const MAX_GROUP_MEMBERS = 7;
    const currentMemberCount = group.memberIds?.length || 0;
    const remainingSlots = MAX_GROUP_MEMBERS - currentMemberCount;

    async function handleAddMembers() {
        if (selectedRecordIds.length === 0) return;
        if (selectedRecordIds.length > remainingSlots) {
            alert(`Bu gruba en fazla ${remainingSlots} kişi daha eklenebilir. (Mevcut: ${currentMemberCount}, Maksimum: ${MAX_GROUP_MEMBERS})`);
            return;
        }
        setSaving(true);
        try {
            // Add each selected record to the group
            await Promise.all(selectedRecordIds.map(async (recordId) => {
                // 1. Update record groupId
                await updateRecord(recordId, { groupId: group.id });
                // 2. Add to group memberIds
                await addMemberToGroup(group.id, recordId);
            }));

            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Üyeler eklenirken hata oluştu.');
        } finally {
            setSaving(false);
        }
    }

    const filteredRecords = records.filter(r =>
        r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.phone.includes(searchTerm)
    );

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Gruba Üye Ekle: {group.name}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><FiX /></button>
                </div>

                <div className="modal-body">
                    <p style={{ marginBottom: 15, color: '#666', fontSize: 13 }}>
                        <strong>{group.shareTypeName}</strong> ile aynı kilo aralığında olan ve herhangi bir gruba atanmamış kişiler listelenmektedir.
                    </p>
                    {remainingSlots <= 0 ? (
                        <div style={{ padding: 10, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, marginBottom: 15, color: '#856404', fontSize: 13 }}>
                            ⚠️ Bu grup zaten maksimum üye sayısına ({MAX_GROUP_MEMBERS}) ulaşmış. Yeni üye eklenemez.
                        </div>
                    ) : (
                        <div style={{ padding: 10, background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 6, marginBottom: 15, color: '#2e7d32', fontSize: 13 }}>
                            ✅ Bu gruba en fazla <strong>{remainingSlots}</strong> kişi daha eklenebilir. (Mevcut: {currentMemberCount}/{MAX_GROUP_MEMBERS})
                        </div>
                    )}

                    <div className="search-bar" style={{ marginBottom: 15 }}>
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="İsim veya telefon ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="spinner"></div>
                    ) : (
                        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
                            {filteredRecords.length > 0 ? filteredRecords.map(r => (
                                <label key={r.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px',
                                    borderBottom: '1px solid #f5f5f5',
                                    cursor: 'pointer',
                                    backgroundColor: selectedRecordIds.includes(r.id) ? '#f0f9ff' : 'transparent'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRecordIds.includes(r.id)}
                                        disabled={!selectedRecordIds.includes(r.id) && selectedRecordIds.length >= remainingSlots}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                if (selectedRecordIds.length >= remainingSlots) return;
                                                setSelectedRecordIds([...selectedRecordIds, r.id]);
                                            } else {
                                                setSelectedRecordIds(selectedRecordIds.filter(id => id !== r.id));
                                            }
                                        }}
                                        style={{ marginRight: 10, width: 16, height: 16 }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{r.ownerName}</div>
                                        <div style={{ fontSize: 12, color: '#666' }}>{r.phone}</div>
                                    </div>
                                </label>
                            )) : (
                                <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                                    {searchTerm ? 'Sonuç bulunamadı.' : 'Eklenebilecek uygun üye bulunamadı.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div style={{ fontSize: 13, color: '#666' }}>
                        {selectedRecordIds.length}/{remainingSlots} kişi seçildi
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
                        <button className="btn btn-success" onClick={handleAddMembers} disabled={saving || selectedRecordIds.length === 0}>
                            <FiPlus /> Seçilenleri Ekle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
