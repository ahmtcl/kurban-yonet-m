'use client';

import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSettings, FiX, FiDownload, FiCheckSquare, FiSquare, FiHash, FiLock, FiVideo, FiSend, FiCopy, FiCheck, FiMinus, FiSearch } from 'react-icons/fi';
import { getGroups, getShareTypes, getRecords, removeMemberFromGroup, updateRecord, updateGroup, deleteGroup, getSettings } from '@/lib/firestore';
import type { Group, ShareType, Record } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import MoveToGroupModal from '@/components/modals/MoveToGroupModal';
import AddMemberToGroupModal from '@/components/modals/AddMemberToGroupModal';
import MergeGroupModal from '@/components/modals/MergeGroupModal';
import VideoUploadModal from '@/components/modals/VideoUploadModal';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

export default function GruplarPage() {
    const { isAdmin } = useAuth();
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
    const [mergeGroup, setMergeGroup] = useState<Group | null>(null);
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

    // Grupsuzlar daraltma
    const [unassignedCollapsed, setUnassignedCollapsed] = useState(true);

    // Video Upload State
    const [videoUploadGroup, setVideoUploadGroup] = useState<Group | null>(null);
    const [sendingSmsGroupId, setSendingSmsGroupId] = useState<string | null>(null);

    // Video İstatistik Modal State
    const [videoStatsModal, setVideoStatsModal] = useState<{
        type: 'uploaded' | 'not-uploaded' | 'sms-pending' | null;
        groups: Group[];
    }>({ type: null, groups: [] });

    // Kesim Sıra No State
    const [editingKesimSiraGroupId, setEditingKesimSiraGroupId] = useState<string | null>(null);
    const [kesimSiraInput, setKesimSiraInput] = useState('');
    const [showBulkKesimModal, setShowBulkKesimModal] = useState(false);
    const [bulkKesimShareType, setBulkKesimShareType] = useState('');
    const [bulkKesimStartNo, setBulkKesimStartNo] = useState('');

    // Grup Arama State
    const [groupSearch, setGroupSearch] = useState('');

    useEffect(() => {
        console.log('🔄 refreshTrigger değişti:', refreshTrigger, '- loadData çağrılıyor');
        loadData();
    }, [refreshTrigger]);

    // Video İstatistikleri Hesapla
    const videoStats = {
        uploaded: groups.filter(g => g.videoUrl).length,
        notUploaded: groups.filter(g => !g.videoUrl).length,
        smsPending: groups.filter(g => g.videoUrl && !g.videoSmsSent).length
    };

    // Grup'a scroll + expand fonksiyonu
    const scrollToGroup = (groupId: string) => {
        const element = document.getElementById(`group-${groupId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight efekti için geçici style
            element.style.transition = 'all 0.3s';
            element.style.transform = 'scale(1.02)';
            element.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.boxShadow = '';
            }, 600);
        }
    };

    // İstatistik karta tıklayınca modal aç
    const openVideoStatsModal = (type: 'uploaded' | 'not-uploaded' | 'sms-pending') => {
        let filteredGroups: Group[] = [];
        if (type === 'uploaded') {
            filteredGroups = groups.filter(g => g.videoUrl);
        } else if (type === 'not-uploaded') {
            filteredGroups = groups.filter(g => !g.videoUrl);
        } else if (type === 'sms-pending') {
            filteredGroups = groups.filter(g => g.videoUrl && !g.videoSmsSent);
        }
        setVideoStatsModal({ type, groups: filteredGroups });
    };

    const closeVideoStatsModal = () => {
        setVideoStatsModal({ type: null, groups: [] });
    };

    // SMS Gönderme Fonksiyonu (Grup Kartından)
    const handleSendGroupSms = async (group: Group) => {
        if (!group.videoUrl) {
            alert('❌ Video yüklenmeden SMS gönderilemez!');
            return;
        }

        if (group.videoSmsSent) {
            if (!confirm('Bu gruba SMS zaten gönderilmiş. Tekrar göndermek istiyor musunuz?')) {
                return;
            }
        }

        const groupMembers = records.filter(r => group.memberIds.includes(r.id));
        
        if (groupMembers.length === 0) {
            alert('❌ Grupta üye bulunamadı!');
            return;
        }

        if (!confirm(`${group.name} grubundaki ${groupMembers.length} kişiye video SMS gönderilecek. Devam edilsin mi?`)) {
            return;
        }

        setSendingSmsGroupId(group.id);
        try {
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: groupMembers.map(m => ({
                        phone: m.phone,
                        name: m.ownerName,
                        videoUrl: group.videoUrl
                    })),
                    messageType: 'video',
                    groupName: group.name
                })
            });

            if (!response.ok) {
                throw new Error('SMS gönderilemedi');
            }

            // SMS gönderildi olarak işaretle
            await updateGroup(group.id, {
                videoSmsSent: true
            });

            alert(`✅ ${groupMembers.length} kişiye video SMS başarıyla gönderildi!`);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('SMS gönderme hatası:', error);
            alert('❌ Video SMS gönderilemedi. Lütfen tekrar deneyin.');
        } finally {
            setSendingSmsGroupId(null);
        }
    };

    // WhatsApp Helper Fonksiyonları
    const formatPhoneForWhatsApp = (phone: string): string => {
        // Telefon numarasını temizle: boşluk, tire, parantez vb. kaldır
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        
        // Eğer 0 ile başlıyorsa, +90 ile değiştir
        if (cleaned.startsWith('0')) {
            return '+90' + cleaned.substring(1);
        }
        
        // Eğer 90 ile başlıyorsa +90 ekle
        if (cleaned.startsWith('90')) {
            return '+' + cleaned;
        }
        
        // Eğer + ile başlıyorsa olduğu gibi kullan
        if (cleaned.startsWith('+')) {
            return cleaned;
        }
        
        // Varsayılan: +90 ekle
        return '+90' + cleaned;
    };

    const sendVideoViaWhatsApp = (member: Record, videoUrl: string) => {
        if (!member.phone) {
            alert('Bu üyenin telefon numarası kayıtlı değil!');
            return;
        }

        const formattedPhone = formatPhoneForWhatsApp(member.phone);
        const message = `SAYIN ${member.ownerName.toUpperCase()} KURBANINIZ KESİLMİŞTİR. ALLAH KABUL ETSİN. KURBAN KESİM VİDEONUZU LİNK ÜZERİNDEN İZLEYEBİLİRSİNİZ. ${videoUrl}`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodedMessage}`;
        
        // Yeni sekmede WhatsApp aç
        window.open(whatsappUrl, '_blank');
    };

    async function loadData() {
        console.log('📥 loadData başladı - gruplar Firestore\'dan çekiliyor...');
        setLoading(true);
        try {
            const [grps, types, recs, sett] = await Promise.all([
                getGroups(),
                getShareTypes(),
                getRecords(),
                getSettings()
            ]);
            console.log('✅ Gruplar yüklendi:', grps.length, 'grup');
            console.log('🔍 Video URL Debug:', grps.map(g => ({ id: g.id, name: g.name, videoUrl: g.videoUrl, videoSmsSent: g.videoSmsSent })));
            setGroups(grps);
            setShareTypes(types);
            setRecords(recs);
            setSettings(sett);
        } catch (error) {
            console.error('❌ loadData hatası:', error);
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

    // Kesim Sıra No - Manuel kaydet
    async function handleSaveKesimSiraNo(groupId: string) {
        const val = parseInt(kesimSiraInput);
        if (isNaN(val) || val < 0) {
            alert('Geçerli bir sıra numarası giriniz.');
            return;
        }
        try {
            await updateGroup(groupId, { kesimSiraNo: val } as any);
            setEditingKesimSiraGroupId(null);
            setKesimSiraInput('');
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            alert('Sıra no kaydedilemedi.');
        }
    }

    // Kesim Sıra No - Toplu atama
    async function handleBulkKesimSiraNo() {
        if (!bulkKesimShareType || !bulkKesimStartNo) return;
        const startNo = parseInt(bulkKesimStartNo);
        if (isNaN(startNo) || startNo < 0) {
            alert('Geçerli bir başlangıç numarası giriniz.');
            return;
        }
        try {
            const targetGroups = groups
                .filter(g => g.shareTypeId === bulkKesimShareType)
                .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

            await Promise.all(targetGroups.map(async (g, i) => {
                await updateGroup(g.id, { kesimSiraNo: startNo + i } as any);
            }));

            setShowBulkKesimModal(false);
            setBulkKesimShareType('');
            setBulkKesimStartNo('');
            setRefreshTrigger(prev => prev + 1);
            alert(`${targetGroups.length} gruba sıra numarası atandı (${startNo} - ${startNo + targetGroups.length - 1}).`);
        } catch (error) {
            console.error(error);
            alert('Toplu sıra no ataması başarısız.');
        }
    }

    async function handleBulkCreateGroup() {
        if (!newGroupName.trim() || !newGroupShareType || selectedUnassignedIds.length === 0) return;
        if (selectedUnassignedIds.length > 7) {
            alert('Bir gruba en fazla 7 kişi eklenebilir. Lütfen en fazla 7 kişi seçin.');
            return;
        }
        try {
            const st = shareTypes.find(s => s.id === newGroupShareType);
            if (!st) return;

            // Compatibility Check: Only same shareTypeId allowed
            const incompatibleMembers = selectedUnassignedIds.map(id => records.find(r => r.id === id)).filter(r => {
                if (!r) return false;
                return r.shareTypeId !== newGroupShareType;
            });

            if (incompatibleMembers.length > 0) {
                alert(`Seçtiğiniz ${incompatibleMembers.length} kişinin hisse tipi, seçilen grup tipi (${st.name}) ile eşleşmiyor. Farklı hisse tipindeki kişiler aynı gruba eklenemez.`);
                return;
            }

            // Kesim günü kontrolü: seçilen kişilerin hepsi aynı güne sahip olmalı
            const selectedRecords = selectedUnassignedIds.map(id => records.find(r => r.id === id)).filter(Boolean) as Record[];
            const uniqueDays = [...new Set(selectedRecords.map(r => r.daySelection))];
            if (uniqueDays.length > 1) {
                alert(`Seçtiğiniz kişilerin kesim günleri farklı (${uniqueDays.map(d => d + '. Gün').join(', ')}). Aynı grupta farklı kesim günlerindeki kişiler bulunamaz.`);
                return;
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

    // Kilit kontrol yardımcısı (admin her zaman serbest)
    function isGroupLocked(group: Group): boolean {
        if (isAdmin) return false;
        const firstMember = records.find(r => group.memberIds.includes(r.id));
        const day = firstMember?.daySelection ?? null;
        if (day === 1) return settings?.groupsLockedDay1 ?? false;
        if (day === 2) return settings?.groupsLockedDay2 ?? false;
        return false;
    }

    // Grup Arama Filtresi
    const filteredGroups = groups.filter(group => {
        if (!groupSearch.trim()) return true; // Arama boşsa tüm grupları göster
        
        const searchLower = groupSearch.toLowerCase();
        
        // Grup adında ara
        if (group.name.toLowerCase().includes(searchLower)) return true;
        
        // Grup üyelerinin isimlerinde ara
        const members = group.memberIds
            .map(mid => records.find(r => r.id === mid))
            .filter(Boolean);
        
        const foundInMembers = members.some(member => 
            member!.ownerName.toLowerCase().includes(searchLower) ||
            member!.phone.includes(searchLower)
        );
        
        if (foundInMembers) return true;
        
        // Kesim sıra numarasında ara
        if (group.kesimSiraNo && group.kesimSiraNo.toString().includes(searchLower)) return true;
        
        return false;
    });

    // Grouping logic
    const groupsByShareType = shareTypes.map(st => {
        const typeGroups = filteredGroups.filter(g => g.shareTypeId === st.id);
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
                <h2>👥 Gruplar</h2>
                <div className="top-bar-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
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
                    {isAdmin && (
                        <button
                            className="btn btn-sm"
                            onClick={() => setShowBulkKesimModal(true)}
                            title="Toplu Kesim Sıra No Ver"
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#e65100', color: '#fff', border: 'none' }}
                        >
                            <FiHash /> Toplu Kesim Sıra No Ver
                        </button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => {
                        setRefreshTrigger(prev => prev + 1);
                        alert('Veriler yenilendi.');
                    }}>
                        Yenile
                    </button>
                </div>
            </div>

            {/* VİDEO İSTATİSTİK KARTLARI */}
            <div style={{ 
                padding: '16px 24px', 
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderBottom: '2px solid #bae6fd'
            }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: 16,
                    maxWidth: 1200,
                    margin: '0 auto'
                }}>
                    {/* Video Yüklenen Gruplar */}
                    <div 
                        onClick={() => openVideoStatsModal('uploaded')}
                        style={{
                            background: '#dcfce7',
                            border: '2px solid #15803d',
                            borderRadius: 12,
                            padding: 16,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(21, 128, 61, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>
                            {videoStats.uploaded}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FiCheck size={16} /> Video Yüklenen
                        </div>
                    </div>

                    {/* Video Yüklenmeyen Gruplar */}
                    <div 
                        onClick={() => openVideoStatsModal('not-uploaded')}
                        style={{
                            background: '#fee2e2',
                            border: '2px solid #dc2626',
                            borderRadius: 12,
                            padding: 16,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                            {videoStats.notUploaded}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FiMinus size={16} /> Video Yüklenmeyen
                        </div>
                    </div>

                    {/* SMS Bekleyen Gruplar */}
                    <div 
                        onClick={() => openVideoStatsModal('sms-pending')}
                        style={{
                            background: '#fef3c7',
                            border: '2px solid #d97706',
                            borderRadius: 12,
                            padding: 16,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>
                            {videoStats.smsPending}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FiSend size={16} /> SMS Bekleyen
                        </div>
                    </div>
                </div>
            </div>

            {/* GRUP ARAMA */}
            <div style={{ 
                padding: '16px 24px', 
                background: '#fff',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <div style={{ position: 'relative', marginBottom: 0 }}>
                        <input
                            className="form-input"
                            placeholder="🔍 Grup adı, üye ismi, telefon veya kesim sıra no ile ara..."
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                            style={{ 
                                fontSize: 16, 
                                padding: '12px 16px',
                                paddingRight: groupSearch ? '40px' : '16px',
                                border: '2px solid #3b82f6',
                                borderRadius: 8,
                                width: '100%'
                            }}
                        />
                        {groupSearch && (
                            <button
                                onClick={() => setGroupSearch('')}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 'bold'
                                }}
                                title="Aramayı temizle"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    {groupSearch && (
                        <div style={{ 
                            marginTop: 8, 
                            fontSize: 13, 
                            color: '#666',
                            textAlign: 'center' 
                        }}>
                            <strong>{filteredGroups.length}</strong> grup bulundu
                        </div>
                    )}
                </div>
            </div>

            <div className="page-content" style={{ paddingBottom: 50 }}>
                {/* UNASSIGNED SECTION */}
                <div className="card unassigned-section" style={{ marginBottom: 24, border: '2px dashed var(--accent-primary)', background: '#f0f9ff' }}>
                    <div
                        style={{ padding: '12px 16px', borderBottom: unassignedCollapsed ? 'none' : '1px solid #e0f2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setUnassignedCollapsed(v => !v)}
                    >
                        <h3 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                            <span>{unassignedCollapsed ? '▶' : '▼'}</span>
                            📌 Grupsuz Hissedarlar ({unassignedShareholders.length})
                        </h3>
                        {selectedUnassignedIds.length > 0 && (
                            <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); setShowBulkGroupModal(true); }}>
                                <FiPlus /> Grup Oluştur ({selectedUnassignedIds.length})
                            </button>
                        )}
                    </div>
                    {!unassignedCollapsed && (
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
                                    padding: '10px 12px',
                                    border: '1px solid #e0f2fe',
                                    borderRadius: 6,
                                    background: selectedUnassignedIds.includes(r.id) ? '#dbeffe' : '#fff',
                                    cursor: 'pointer',
                                    minHeight: 48,
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedUnassignedIds.includes(r.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedUnassignedIds([...selectedUnassignedIds, r.id]);
                                            else setSelectedUnassignedIds(selectedUnassignedIds.filter(id => id !== r.id));
                                        }}
                                        style={{ width: 18, height: 18, flexShrink: 0 }}
                                    />
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.ownerName}</div>
                                        <div style={{ fontSize: 11, color: '#666' }}>{r.shareTypeName}</div>
                                    </div>
                                    <button
                                        className="btn btn-icon btn-ghost btn-sm"
                                        style={{ marginLeft: 'auto', padding: 6, flexShrink: 0 }}
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
                    )}
                </div>

                {/* Arama sonucu kontrolü */}
                {groupSearch && filteredGroups.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#999'
                    }}>
                        <FiSearch size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <h3 style={{ marginBottom: 8, color: '#666' }}>Sonuç bulunamadı</h3>
                        <p style={{ fontSize: 14 }}>
                            "<strong>{groupSearch}</strong>" araması için eşleşen grup bulunamadı.
                        </p>
                        <button
                            onClick={() => setGroupSearch('')}
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 16 }}
                        >
                            Aramayı Temizle
                        </button>
                    </div>
                )}

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

                        <div className="groups-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                            gap: 20
                        }}>
                            {typeGroups.map(group => {
                                // Get full record objects for members (maintain order if possible, but firestore array has no efficient order, assume append)
                                const members = group.memberIds
                                    .map(id => records.find(r => r.id === id))
                                    .filter(r => !!r) as Record[];

                                const locked = isGroupLocked(group);

                                return (
                                    <div 
                                        key={group.id} 
                                        id={`group-${group.id}`}
                                        className="card group-card" 
                                        style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                                    >
                                        {/* Group Header */}
                                        <div className="group-card-header" style={{
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
                                                <div>
                                                    <span style={{ fontWeight: 600, fontSize: 16 }}>{group.name}</span>
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: 400 }}>
                                                        {group.shareTypeName || shareTypes.find(st => st.id === group.shareTypeId)?.name || '—'}
                                                        {members.length > 0 && members[0].daySelection
                                                            ? ` · ${members[0].daySelection}. Gün`
                                                            : ''}
                                                    </div>
                                                </div>
                                            </label>
                                            {locked && (
                                                <span title="Bu grup kilitlenmiştir" style={{ color: '#fbbf24', display: 'flex', alignItems: 'center' }}>
                                                    <FiLock size={16} />
                                                </span>
                                            )}
                                            {!locked && (
                                                <button
                                                    className="btn btn-icon btn-sm"
                                                    style={{ 
                                                        color: '#fff', 
                                                        background: 'rgba(255,255,255,0.1)',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                    }}
                                                    onClick={() => setEditingGroup(group)}
                                                    title="Grup Ayarları"
                                                >
                                                    <FiSettings size={18} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Members Table */}
                                        <div style={{ flex: 1 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                    {members.map((member) => (
                                                        <tr key={member.id} className="group-member-row" style={{ borderBottom: '1px solid #eee' }}>
                                                            <td className="group-member-name" style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>
                                                                {member.ownerName}
                                                            </td>
                                                            <td className="group-member-actions" style={{ width: 220, padding: '4px 8px' }}>
                                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                                    {/* WhatsApp Video Gönder - Her zaman görünür */}
                                                                    <button
                                                                        className="btn btn-xs"
                                                                        onClick={() => {
                                                                            if (group.videoUrl) {
                                                                                sendVideoViaWhatsApp(member, group.videoUrl);
                                                                            } else {
                                                                                alert('❌ Bu gruba henüz video yüklenmedi! Önce video yükleyin.');
                                                                            }
                                                                        }}
                                                                        title={group.videoUrl ? "WhatsApp'tan Video Gönder" : "Henüz video yüklenmedi"}
                                                                        style={{ 
                                                                            fontSize: 11, 
                                                                            padding: '2px 6px', 
                                                                            background: group.videoUrl ? '#25D366' : '#95a5a6', 
                                                                            color: '#fff', 
                                                                            border: 'none',
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            gap: 3,
                                                                            opacity: group.videoUrl ? 1 : 0.6,
                                                                            cursor: group.videoUrl ? 'pointer' : 'not-allowed'
                                                                        }}
                                                                    >
                                                                        <FiSend size={11} /><span className="member-btn-label">WA Video</span>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-xs btn-ghost"
                                                                        onClick={() => setEditRecord(member)}
                                                                        title="Düzenle"
                                                                        style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 3 }}
                                                                    >
                                                                        <FiEdit size={11} /><span className="member-btn-label">Düzenle</span>
                                                                    </button>
                                                                    {!locked && (
                                                                        <button
                                                                            className="btn btn-xs btn-ghost"
                                                                            onClick={() => setDeleteConfirm({ groupId: group.id, recordId: member.id })}
                                                                            title="Gruptan Çıkar"
                                                                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 3 }}
                                                                        >
                                                                            <FiTrash2 size={11} /><span className="member-btn-label">Sil</span>
                                                                        </button>
                                                                    )}
                                                                    {/* Move Button - Only if Enabled in Settings AND group not locked */}
                                                                    {!locked && settings?.moveButtonEnabled && (
                                                                        <button
                                                                            className="btn btn-xs btn-ghost"
                                                                            onClick={() => setMoveRecord({ record: member, currentGroupId: group.id })}
                                                                            title="Başka Gruba Taşı"
                                                                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #ddd', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 3 }}
                                                                        >
                                                                            <FiX size={11} style={{ transform: 'rotate(45deg)' }} /><span className="member-btn-label">Taşı</span>
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
                                        <div className="group-card-footer" style={{
                                            padding: '10px 16px',
                                            background: '#f8f9fa',
                                            borderTop: '1px solid #eee',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            minHeight: 48,
                                            flexWrap: 'wrap',
                                            gap: 8,
                                        }}>
                                            {/* Kesim Sıra No */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {editingKesimSiraGroupId === group.id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            style={{ width: 80, padding: '2px 6px', fontSize: 13, height: 28 }}
                                                            value={kesimSiraInput}
                                                            onChange={(e) => setKesimSiraInput(e.target.value)}
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveKesimSiraNo(group.id);
                                                                if (e.key === 'Escape') { setEditingKesimSiraGroupId(null); setKesimSiraInput(''); }
                                                            }}
                                                        />
                                                        <button className="btn btn-xs btn-success" onClick={() => handleSaveKesimSiraNo(group.id)} style={{ padding: '2px 6px' }}>✓</button>
                                                        <button className="btn btn-xs btn-ghost" onClick={() => { setEditingKesimSiraGroupId(null); setKesimSiraInput(''); }} style={{ padding: '2px 6px' }}>✗</button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            cursor: isAdmin ? 'pointer' : 'default',
                                                            padding: '2px 8px',
                                                            borderRadius: 4,
                                                            background: group.kesimSiraNo ? '#fff3e0' : '#f5f5f5',
                                                            border: `1px solid ${group.kesimSiraNo ? '#ff9800' : '#ddd'}`,
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: group.kesimSiraNo ? '#e65100' : '#999',
                                                        }}
                                                        onClick={() => {
                                                            if (!isAdmin) return;
                                                            setEditingKesimSiraGroupId(group.id);
                                                            setKesimSiraInput(group.kesimSiraNo?.toString() || '');
                                                        }}
                                                        title={isAdmin ? 'Kesim sıra no düzenle' : ''}
                                                    >
                                                        <FiHash style={{ fontSize: 12 }} />
                                                        {group.kesimSiraNo ? `Kesim No: ${group.kesimSiraNo}` : 'Sıra No Yok'}
                                                        {isAdmin && <FiEdit style={{ fontSize: 10, opacity: 0.6 }} />}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Video Link Gösterimi */}
                                            {group.videoUrl && (
                                                <div style={{
                                                    width: '100%',
                                                    marginTop: 8,
                                                    padding: '8px 10px',
                                                    background: '#f0f9ff',
                                                    border: '1px solid #bae6fd',
                                                    borderRadius: 4,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <div style={{ flex: 1, minWidth: 200 }}>
                                                        <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>
                                                            📹 Video Linki
                                                        </div>
                                                        <div style={{
                                                            fontSize: 11,
                                                            color: '#0c4a6e',
                                                            wordBreak: 'break-all',
                                                            maxWidth: 400
                                                        }}>
                                                            {group.videoUrl.length > 60
                                                                ? `${group.videoUrl.substring(0, 60)}...`
                                                                : group.videoUrl
                                                            }
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(group.videoUrl || '');
                                                            alert('Video linki kopyalandı!');
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            fontSize: 11,
                                                            padding: '4px 8px',
                                                            border: '1px solid #0ea5e9'
                                                        }}
                                                    >
                                                        <FiCopy size={12} /> Link Kopyala
                                                    </button>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                {/* Video Yükle */}
                                                <button
                                                    className="btn btn-xs"
                                                    style={{ fontSize: 11, padding: '4px 8px', background: '#e11d48', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                                                    onClick={() => setVideoUploadGroup(group)}
                                                    title="Video Yükle"
                                                >
                                                    <FiVideo size={12} /> video yükle
                                                </button>

                                                {/* Video Durumu - Kompakt Icon */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                                        Video
                                                    </span>
                                                    <span 
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: 22,
                                                            height: 22,
                                                            borderRadius: '50%',
                                                            background: group.videoUrl ? '#dcfce7' : '#fee2e2',
                                                            border: group.videoUrl ? '1.5px solid #15803d' : '1.5px solid #dc2626',
                                                        }}
                                                        title={group.videoUrl ? 'Video Yüklendi' : 'Video Yüklenmedi'}
                                                    >
                                                        {group.videoUrl ? (
                                                            <FiCheck size={14} style={{ color: '#15803d', strokeWidth: 3 }} />
                                                        ) : (
                                                            <FiMinus size={14} style={{ color: '#dc2626', strokeWidth: 3 }} />
                                                        )}
                                                    </span>
                                                </div>

                                                {/* SMS Durumu - Kompakt Icon */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                                                        SMS
                                                    </span>
                                                    <span 
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: 22,
                                                            height: 22,
                                                            borderRadius: '50%',
                                                            background: group.videoSmsSent ? '#dcfce7' : '#fee2e2',
                                                            border: group.videoSmsSent ? '1.5px solid #15803d' : '1.5px solid #dc2626',
                                                        }}
                                                        title={group.videoSmsSent ? 'SMS Gönderildi' : 'SMS Gönderilmedi'}
                                                    >
                                                        {group.videoSmsSent ? (
                                                            <FiCheck size={14} style={{ color: '#15803d', strokeWidth: 3 }} />
                                                        ) : (
                                                            <FiMinus size={14} style={{ color: '#dc2626', strokeWidth: 3 }} />
                                                        )}
                                                    </span>
                                                </div>

                                                {/* SMS Gönder Butonu - Video varsa göster */}
                                                {group.videoUrl && (
                                                    <button
                                                        className="btn btn-xs"
                                                        style={{ 
                                                            fontSize: 11, 
                                                            padding: '4px 8px', 
                                                            background: group.videoSmsSent ? '#6b7280' : '#16a34a', 
                                                            color: '#fff', 
                                                            border: 'none', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: 4,
                                                            opacity: sendingSmsGroupId === group.id ? 0.6 : 1
                                                        }}
                                                        onClick={() => handleSendGroupSms(group)}
                                                        disabled={sendingSmsGroupId === group.id}
                                                        title={group.videoSmsSent ? 'SMS Tekrar Gönder' : 'Toplu SMS Gönder'}
                                                    >
                                                        {sendingSmsGroupId === group.id ? (
                                                            <><div style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> SMS...</>
                                                        ) : (
                                                            <><FiSend size={12} /> SMS Gönder</>
                                                        )}
                                                    </button>
                                                )}

                                                {!locked && (
                                                    <button
                                                        className="btn btn-xs btn-primary"
                                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                                        onClick={() => setAddMemberGroup(group)}
                                                    >
                                                        <FiPlus /> Üye Ekle
                                                    </button>
                                                )}
                                                {!locked && (
                                                    <button
                                                        className="btn btn-xs"
                                                        style={{ fontSize: 12, padding: '4px 8px', background: '#7b2d8b', color: '#fff', border: 'none' }}
                                                        onClick={() => setMergeGroup(group)}
                                                        title="Bu grupla başka bir grubu birleştir"
                                                    >
                                                        Birleştir
                                                    </button>
                                                )}
                                                {locked && (
                                                    <span style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                                        <FiLock size={13} /> Kilitli
                                                    </span>
                                                )}
                                            </div>
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

            {/* Video Upload Modal */}
            {videoUploadGroup && (
                <VideoUploadModal
                    group={videoUploadGroup}
                    onClose={() => setVideoUploadGroup(null)}
                    onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                />
            )}

            {/* Video İstatistik Modal */}
            {videoStatsModal.type && (
                <div className="modal-backdrop" onClick={closeVideoStatsModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {videoStatsModal.type === 'uploaded' && <><FiCheck style={{ color: '#15803d' }} /> Video Yüklenen Gruplar</>}
                                {videoStatsModal.type === 'not-uploaded' && <><FiMinus style={{ color: '#dc2626' }} /> Video Yüklenmeyen Gruplar</>}
                                {videoStatsModal.type === 'sms-pending' && <><FiSend style={{ color: '#d97706' }} /> SMS Bekleyen Gruplar</>}
                            </h3>
                            <button className="btn btn-icon btn-ghost" onClick={closeVideoStatsModal}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {videoStatsModal.groups.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                                    <p>Bu kategoride grup bulunmuyor.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {videoStatsModal.groups.map((group) => {
                                        const groupMembers = records.filter(r => group.memberIds.includes(r.id));
                                        return (
                                            <div
                                                key={group.id}
                                                style={{
                                                    padding: 16,
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: 8,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: 12
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>
                                                        {group.name}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>
                                                        {group.shareTypeName} • {groupMembers.length} kişi
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => {
                                                        closeVideoStatsModal();
                                                        setTimeout(() => scrollToGroup(group.id), 100);
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                                                >
                                                    <FiVideo size={14} /> Gruba Git
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={closeVideoStatsModal}>
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
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

            {/* Merge Group Modal */}
            {mergeGroup && (
                <MergeGroupModal
                    targetGroup={mergeGroup}
                    allGroups={groups}
                    records={records}
                    onClose={() => setMergeGroup(null)}
                    onSuccess={() => { setMergeGroup(null); setRefreshTrigger(prev => prev + 1); }}
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
                            {selectedUnassignedIds.length > 7 && (
                                <div style={{ padding: 10, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, marginBottom: 15, color: '#856404', fontSize: 13 }}>
                                    ⚠️ Bir gruba en fazla 7 kişi eklenebilir. Şu an {selectedUnassignedIds.length} kişi seçili. Lütfen en fazla 7 kişi seçin.
                                </div>
                            )}
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
                                disabled={!newGroupName.trim() || !newGroupShareType || selectedUnassignedIds.length > 7}
                            >
                                Grubu Oluştur ve Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toplu Kesim Sıra No Modal */}
            {showBulkKesimModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkKesimModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header" style={{ background: '#e65100', color: '#fff' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiHash /> Toplu Kesim Sıra No Ver
                            </h3>
                            <button className="btn btn-icon btn-ghost" style={{ color: '#fff' }} onClick={() => setShowBulkKesimModal(false)}><FiX /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 20, fontSize: 14, color: '#666' }}>
                                Bir ürün tipi seçin ve başlangıç numarasını girin. O tipteki tüm gruplara sıralı numara atanacaktır.
                            </p>

                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Ürün Tipi (Hisse Tipi)</label>
                                <select
                                    className="form-select"
                                    value={bulkKesimShareType}
                                    onChange={(e) => setBulkKesimShareType(e.target.value)}
                                >
                                    <option value="">-- Seçiniz --</option>
                                    {shareTypes.filter(st => groups.some(g => g.shareTypeId === st.id)).map(st => {
                                        const groupCount = groups.filter(g => g.shareTypeId === st.id).length;
                                        return (
                                            <option key={st.id} value={st.id}>
                                                {st.name} ({groupCount} grup)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Başlangıç Numarası</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="Örn: 1"
                                    value={bulkKesimStartNo}
                                    onChange={(e) => setBulkKesimStartNo(e.target.value)}
                                    min={0}
                                />
                            </div>

                            {bulkKesimShareType && bulkKesimStartNo && (
                                <div style={{ padding: 12, background: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7', marginBottom: 15, fontSize: 13 }}>
                                    <strong>Önizleme:</strong> {shareTypes.find(s => s.id === bulkKesimShareType)?.name} tipindeki{' '}
                                    <strong>{groups.filter(g => g.shareTypeId === bulkKesimShareType).length}</strong> gruba{' '}
                                    <strong>{bulkKesimStartNo}</strong> - <strong>{parseInt(bulkKesimStartNo) + groups.filter(g => g.shareTypeId === bulkKesimShareType).length - 1}</strong>{' '}
                                    arası sıra no atanacak.
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowBulkKesimModal(false)}>İptal</button>
                            <button
                                className="btn"
                                style={{ background: '#e65100', color: '#fff', border: 'none' }}
                                onClick={handleBulkKesimSiraNo}
                                disabled={!bulkKesimShareType || !bulkKesimStartNo}
                            >
                                <FiHash /> Sıra No Ata
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
