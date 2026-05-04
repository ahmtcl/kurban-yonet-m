'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FiLock, FiSettings, FiTag, FiLogOut, FiSave, FiPlus, FiTrash2, FiList, FiSearch, FiEdit, FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiMessageSquare } from 'react-icons/fi';
import { getSettings, updateSettings, getShareTypes, addShareType, deleteShareType, updateShareType, getRecords, getUsers, addUser, updateUser, deleteUser, getGroups } from '@/lib/firestore';
import type { Settings, ShareType, Record as RecordType, User, UserRole, Group } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const { user, isAdmin, logout, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'settings' | 'shares' | 'collections' | 'users' | 'sms'>('collections');

    // Data State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [records, setRecords] = useState<RecordType[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);

    // Search & Edit State
    // Filtreler
    const [search, setSearch] = useState('');
    const [filterShareType, setFilterShareType] = useState('');
    const [filterPayment, setFilterPayment] = useState('');
    const [filterGroup, setFilterGroup] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dateFilterType, setDateFilterType] = useState<'createdAt' | 'updatedAt'>('createdAt');
    const [filterCreatedBy, setFilterCreatedBy] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

    // New Share Type State
    const [newShareName, setNewShareName] = useState('');
    const [newSharePrice, setNewSharePrice] = useState('');
    const [newShareMinKg, setNewShareMinKg] = useState('');
    const [newShareMaxKg, setNewShareMaxKg] = useState('');
    const [newShareStock, setNewShareStock] = useState('');
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
        if (user && !isAdmin) {
            router.push('/');
        }
        if (user && isAdmin) {
            loadData();
        }
    }, [user, authLoading, isAdmin]);

    async function loadData() {
        setLoading(true);
        try {
            const [s, t, r, u, g] = await Promise.all([
                getSettings(),
                getShareTypes(),
                getRecords(),
                isAdmin ? getUsers() : Promise.resolve([]),
                getGroups()
            ]);
            setSettings(s);
            setShareTypes(t);
            setRecords(r);
            setUsers(u);
            setGroups(g);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    // User Management State
    const [newUserName, setNewUserName] = useState('');
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('employee');
    const [newSmsNumber, setNewSmsNumber] = useState('');

    async function handleAddUser() {
        if (!newUserName || !newUserUsername || !newUserPassword) return;
        setSaving(true);
        try {
            await addUser({
                fullName: newUserName,
                username: newUserUsername,
                password: newUserPassword,
                role: newUserRole,
                isActive: true
            });
            setNewUserName('');
            setNewUserUsername('');
            setNewUserPassword('');
            loadData();
        } catch (e) {
            alert('Hata!');
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleUser(user: User) {
        try {
            await updateUser(user.id, { isActive: !user.isActive });
            loadData();
        } catch (e) {
            alert('Hata');
        }
    }

    async function handleSaveSettings() {
        if (!settings) return;
        setSaving(true);
        try {
            const { lastOrderNumber, ...settingsToSave } = settings as Settings & { lastOrderNumber?: number };
            await updateSettings(settingsToSave);
            alert('Ayarlar kaydedildi!');
        } catch (e) {
            alert('Hata oluştu!');
        } finally {
            setSaving(false);
        }
    }

    async function handleAddShareType() {
        if (!newShareName || !newSharePrice) return;
        setSaving(true);
        try {
            await addShareType({
                name: newShareName,
                price: parseFloat(newSharePrice),
                minKg: parseFloat(newShareMinKg) || 0,
                maxKg: parseFloat(newShareMaxKg) || 0,
                stockQuantity: parseInt(newShareStock) || 0,
                isActive: true
            });
            setNewShareName('');
            setNewSharePrice('');
            setNewShareMinKg('');
            setNewShareMaxKg('');
            setNewShareStock('');
            loadData();
        } catch (e) {
            alert('Ekleme hatası');
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdateStock(id: string, value: number) {
        try {
            await updateShareType(id, { stockQuantity: value });
            setShareTypes(prev => prev.map(st => st.id === id ? { ...st, stockQuantity: value } : st));
            setSaveStatus(id);
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (e) {
            alert('Stok güncelleme hatası');
        }
    }

    async function handleDeleteShareType(id: string) {
        if (!confirm('Silmek istediğinize emin misiniz?')) return;
        try {
            await deleteShareType(id);
            loadData();
        } catch (e) {
            alert('Silme hatası');
        }
    }

    // Benzersiz personel listesi
    const createdByList = useMemo(() => {
        const names = records.map(r => r.createdBy || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [records]);

    const filteredRecords = useMemo(() => {
        let result = records.filter((r) => {
            const matchSearch = !search ||
                r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
                r.phone.includes(search) ||
                (r.orderNumber && r.orderNumber.toString().includes(search)) ||
                r.notes?.toLowerCase().includes(search.toLowerCase());
            const matchShare = !filterShareType || r.shareTypeId === filterShareType;
            const matchPayment = !filterPayment || r.paymentType === filterPayment;
            const matchGroup = !filterGroup || (filterGroup === 'null' ? !r.groupId : r.groupId === filterGroup);
            const matchDay = !filterDay || r.daySelection?.toString() === filterDay;
            const matchCreatedBy = !filterCreatedBy || r.createdBy === filterCreatedBy;

            let matchDate = true;
            if (startDate || endDate) {
                const targetDate = dateFilterType === 'updatedAt'
                    ? (r.updatedAt ? new Date(r.updatedAt) : null)
                    : new Date(r.createdAt);
                if (targetDate) {
                    targetDate.setHours(0, 0, 0, 0);
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (targetDate < start) matchDate = false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(0, 0, 0, 0);
                        if (targetDate > end) matchDate = false;
                    }
                }
            }
            return matchSearch && matchShare && matchPayment && matchGroup && matchDay && matchDate && matchCreatedBy;
        });
        // Sıralama
        return result.sort((a, b) => {
            const priorityA = a.status === 'pending_cancellation' ? 2 : (a.status === 'waiting_approval' ? 1 : 0);
            const priorityB = b.status === 'pending_cancellation' ? 2 : (b.status === 'waiting_approval' ? 1 : 0);
            if (priorityA !== priorityB) return priorityB - priorityA;
            const orderA = a.orderNumber || 0;
            const orderB = b.orderNumber || 0;
            return orderB - orderA;
        });
    }, [records, search, filterShareType, filterPayment, filterGroup, filterDay, startDate, endDate, dateFilterType, filterCreatedBy]);

    if (isAdmin) {
        return (
            <div className="page-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FiLock style={{ color: '#f59e0b' }} /> Yönetici Paneli
                    </h2>
                    <button className="btn btn-outline-danger btn-sm" onClick={logout}>
                        <FiLogOut /> Çıkış Yap
                    </button>
                </div>

                <div className="tabs" style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button
                        className={`btn ${activeTab === 'collections' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('collections')}
                    >
                        <FiList /> Kayıtlar & Tahsilat
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('users')}
                            >
                                <FiUsers /> Kullanıcı Yönetimi
                            </button>
                            <button
                                className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <FiSettings /> Genel Ayarlar
                            </button>
                            <button
                                className={`btn ${activeTab === 'shares' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('shares')}
                            >
                                <FiTag /> Hisse Tipleri
                            </button>
                            <button
                                className={`btn ${activeTab === 'sms' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('sms')}
                            >
                                <FiMessageSquare /> SMS Bildirimi
                            </button>
                        </>
                    )}
                </div>

                {loading ? <div className="loading">Yükleniyor...</div> : (
                    <>
                        {activeTab === 'collections' && (
                            <div className="card">
                                {/* Filtreler */}
                                <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    <div className="form-group" style={{ minWidth: 220, flex: 1 }}>
                                        <input
                                            className="form-input"
                                            placeholder="İsim, telefon veya sipariş no ile ara..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            style={{ paddingLeft: 35 }}
                                        />
                                        <FiSearch style={{ position: 'absolute', left: 10, top: 12, color: '#999', pointerEvents: 'none' }} />
                                    </div>
                                    <div className="form-group" style={{ minWidth: 160 }}>
                                        <select className="form-select" value={filterShareType} onChange={e => setFilterShareType(e.target.value)}>
                                            <option value="">Hisse Tipi (Tümü)</option>
                                            {shareTypes.map(st => (
                                                <option key={st.id} value={st.id}>{st.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 140 }}>
                                        <select className="form-select" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                                            <option value="">Ödeme Türü (Tümü)</option>
                                            <option value="nakit">Nakit</option>
                                            <option value="kredi_karti">Kredi Kartı</option>
                                            <option value="online_kredi_karti">Online K.K.</option>
                                            <option value="havale">Havale/EFT</option>
                                            <option value="teslimatta">Teslimatta</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 140 }}>
                                        <select className="form-select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                                            <option value="">Grup (Tümü)</option>
                                            <option value="null">Grupsuz</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 110 }}>
                                        <select className="form-select" value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                                            <option value="">Gün (Tümü)</option>
                                            <option value="1">1. Gün</option>
                                            <option value="2">2. Gün</option>
                                            <option value="3">3. Gün</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 170 }}>
                                        <select className="form-select" value={filterCreatedBy} onChange={e => setFilterCreatedBy(e.target.value)}>
                                            <option value="">Personel (Tümü)</option>
                                            {createdByList.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 120 }}>
                                        <select className="form-select" value={dateFilterType} onChange={e => setDateFilterType(e.target.value as any)}>
                                            <option value="createdAt">Kayıt Tarihi</option>
                                            <option value="updatedAt">Güncelleme Tarihi</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ minWidth: 140 }}>
                                        <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ minWidth: 140 }}>
                                        <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                    </div>
                                </div>

                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Durum</th>
                                                <th>Sipariş No</th>
                                                <th>Sipariş Tarihi</th>
                                                <th>Ad Soyad</th>
                                                <th>Telefon / Yedek</th>
                                                <th>Hisse / Grup</th>
                                                <th>Kesim Günü</th>
                                                <th>Toplam</th>
                                                <th>Ödenen / Kalan</th>
                                                <th>Personel</th>
                                                <th>Ödeme Türü</th>
                                                <th>Vade</th>
                                                <th>Açıklama</th>
                                                <th>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.length > 0 ? filteredRecords.map((r, i) => {
                                                const kalan = (r.totalPrice || 0) - r.depositAmount;
                                                const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && kalan > 0;
                                                const group = groups.find(g => g.id === r.groupId);

                                                return (
                                                    <tr key={r.id}>
                                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                                        <td>
                                                            {r.status === 'approved' ? (
                                                                <span className="badge badge-success" style={{ fontSize: 11 }}>Onaylandı</span>
                                                            ) : r.status === 'pending_cancellation' ? (
                                                                <span className="badge badge-warning" style={{ fontSize: 11 }}>⏳ İptal Bekliyor</span>
                                                            ) : r.status === 'cancelled' ? (
                                                                <span className="badge badge-danger" style={{ fontSize: 11 }}>İptal Edildi</span>
                                                            ) : (
                                                                <span className="badge badge-warning" style={{ fontSize: 11 }}>Bekliyor</span>
                                                            )}
                                                        </td>
                                                        <td style={{ fontWeight: 600, color: '#666' }}>#{r.orderNumber || '-'}</td>
                                                        <td style={{ fontSize: 12, color: '#555' }}>
                                                            {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                                                        </td>
                                                        <td style={{ fontWeight: 500 }}>
                                                            {r.ownerName}
                                                        </td>
                                                        <td>
                                                            <div style={{ fontSize: 13 }}>{r.phone}</div>
                                                            {r.phoneBackup && <div style={{ fontSize: 11, color: '#666' }}>Yedek: {r.phoneBackup}</div>}
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-primary" style={{ marginBottom: 2, display: 'inline-block' }}>{r.shareTypeName}</span>
                                                            {group && <div style={{ fontSize: 12, color: '#555' }}>{group.name}</div>}
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                color: r.daySelection === 1 ? '#2e7d32' : '#f57f17',
                                                                backgroundColor: r.daySelection === 1 ? '#e8f5e9' : '#fffde7',
                                                                padding: '2px 6px',
                                                                borderRadius: 4
                                                            }}>
                                                                {r.daySelection}. Gün
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{(r.totalPrice || 0).toLocaleString('tr-TR')} ₺</td>
                                                        <td>
                                                            <div style={{ color: r.depositAmount > 0 ? 'var(--accent-success)' : '#94a3b8', fontSize: 13, fontWeight: r.depositAmount > 0 ? 500 : 400 }}>
                                                                {r.depositAmount > 0 ? `${r.depositAmount.toLocaleString('tr-TR')} ₺` : '—'}
                                                            </div>
                                                            {kalan > 0 && <div style={{ color: 'var(--accent-danger)', fontSize: 12, fontWeight: 500 }}>Kalan: {kalan.toLocaleString('tr-TR')} ₺</div>}
                                                        </td>
                                                        <td style={{ fontSize: 12, color: '#666' }}>
                                                            {r.createdBy || '-'}
                                                        </td>
                                                        <td style={{ fontSize: 13, fontWeight: 500 }}>
                                                            {r.paymentType === 'nakit' ? 'Nakit' :
                                                                r.paymentType === 'kredi_karti' ? 'Kredi Kartı' :
                                                                    r.paymentType === 'online_kredi_karti' ? 'Online K.K.' :
                                                                        r.paymentType === 'teslimatta' ? 'Teslimatta' : 'Havale'}
                                                        </td>
                                                        <td style={{ color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: 13 }}>
                                                            {r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '—'}
                                                        </td>
                                                        <td style={{ maxWidth: 200 }}>
                                                            <div style={{ fontSize: 13, color: '#444', maxHeight: 60, overflowY: 'auto' }}>{r.notes || '—'}</div>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-icon btn-sm btn-ghost"
                                                                onClick={() => setSelectedRecord({ ...r })}
                                                                title="Düzenle / Tahsilat"
                                                            >
                                                                <FiEdit />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            }) : (
                                                <tr>
                                                    <td colSpan={15} style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                                                        Kayıt bulunamadı.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && settings && (
                            <div className="card" style={{ maxWidth: 600 }}>
                                <div className="form-group">
                                    <label className="form-label">Şirket Adı (Makbuz İçin)</label>
                                    <input
                                        className="form-input"
                                        value={settings.companyName}
                                        onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Panel Başlığı</label>
                                    <input
                                        className="form-input"
                                        value={settings.companyTitle}
                                        onChange={(e) => setSettings({ ...settings, companyTitle: e.target.value })}
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Hedef Hissedar Sayısı</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={settings.targetCount}
                                            onChange={(e) => setSettings({ ...settings, targetCount: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Aktif Kesim Günü (Yeni Kayıtlar İçin)</label>
                                        <select
                                            className="form-select"
                                            value={settings.activeDay}
                                            onChange={(e) => setSettings({ ...settings, activeDay: parseInt(e.target.value) as 1 | 2 | 3 })}
                                        >
                                            <option value={1}>1. Gün</option>
                                            <option value={2}>2. Gün</option>
                                            <option value={3}>3. Gün</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="btn btn-success" onClick={handleSaveSettings} disabled={saving} style={{ marginBottom: 30 }}>
                                    <FiSave /> {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                                </button>

                                {/* GRUP KİLİTLEME */}
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 22, marginBottom: 28 }}>
                                    <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                                        <FiLock /> Grup Kilitleme
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
                                        Kilitlenen günlerin gruplarında kullanıcılar (admin hariç) kişi ekleme/çıkarma, silme, düzenleme ve taşıma yapamaz.
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                        {([1, 2] as const).map(d => {
                                            const locked = d === 1 ? settings.groupsLockedDay1 : settings.groupsLockedDay2;
                                            const toggle = async () => {
                                                const key = d === 1 ? 'groupsLockedDay1' : 'groupsLockedDay2';
                                                const newVal = !locked;
                                                setSettings({ ...settings, [key]: newVal });
                                                await updateSettings({ [key]: newVal });
                                            };
                                            return (
                                                <div key={d} style={{
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                    background: locked ? '#fef2f2' : '#f0fdf4',
                                                    border: `1.5px solid ${locked ? '#fca5a5' : '#86efac'}`,
                                                    borderRadius: 10, padding: '12px 20px', minWidth: 220,
                                                }}>
                                                    <FiLock size={20} color={locked ? '#ef4444' : '#22c55e'} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                                                            {d}. Gün Grupları
                                                        </div>
                                                        <div style={{ fontSize: 12, color: locked ? '#ef4444' : '#16a34a', fontWeight: 600 }}>
                                                            {locked ? 'KİLİTLİ' : 'AÇIK'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={toggle}
                                                        style={{
                                                            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                                            background: locked ? '#ef4444' : '#22c55e',
                                                            color: '#fff', fontWeight: 700, fontSize: 13,
                                                            transition: 'background .15s',
                                                        }}
                                                    >
                                                        {locked ? 'Kilidi Aç' : 'Kilitle'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
                                    <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FiMessageSquare /> SMS Şablonları Yönetimi
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
                                        Kayıt düzenleme ekranında hızlıca kullanabileceğiniz mesaj şablonlarını buradan yönetebilirsiniz.
                                        <br />
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Değişkenler:</span> {`{AD_SOYAD}, {SIPARIS_NO}, {KESIM_GUNU}, {ODEME_YONTEMI}`}
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 20 }}>
                                        {settings.smsTemplates?.map((template, index) => (
                                            <div key={template.id} style={{ background: '#f8fafc', padding: 15, borderRadius: 8, border: '1px solid #e2e8f0', position: 'relative' }}>
                                                <button
                                                    className="btn btn-icon btn-sm btn-ghost"
                                                    style={{ position: 'absolute', right: 10, top: 10, color: 'var(--accent-danger)' }}
                                                    onClick={() => {
                                                        const newTemplates = [...settings.smsTemplates];
                                                        newTemplates.splice(index, 1);
                                                        setSettings({ ...settings, smsTemplates: newTemplates });
                                                    }}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                                <div className="form-group">
                                                    <label className="form-label" style={{ fontSize: 12 }}>Şablon Başlığı</label>
                                                    <input
                                                        className="form-input"
                                                        value={template.label}
                                                        onChange={(e) => {
                                                            const newTemplates = [...settings.smsTemplates];
                                                            newTemplates[index].label = e.target.value;
                                                            setSettings({ ...settings, smsTemplates: newTemplates });
                                                        }}
                                                        placeholder="Örn: Ödeme Hatırlatma"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: 12 }}>Mesaj Metni</label>
                                                    <textarea
                                                        className="form-textarea"
                                                        value={template.text}
                                                        onChange={(e) => {
                                                            const newTemplates = [...settings.smsTemplates];
                                                            newTemplates[index].text = e.target.value;
                                                            setSettings({ ...settings, smsTemplates: newTemplates });
                                                        }}
                                                        placeholder="Mesaj içeriği..."
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className="btn btn-ghost btn-outline-primary"
                                        style={{ width: '100%', borderStyle: 'dashed', marginBottom: 15 }}
                                        onClick={() => {
                                            const newTemplates = [...(settings.smsTemplates || [])];
                                            newTemplates.push({
                                                id: Math.random().toString(36).substr(2, 9),
                                                label: '',
                                                text: ''
                                            });
                                            setSettings({ ...settings, smsTemplates: newTemplates });
                                        }}
                                    >
                                        <FiPlus /> Yeni Şablon Ekle
                                    </button>

                                    <button
                                        className="btn btn-success"
                                        style={{ width: '100%' }}
                                        onClick={handleSaveSettings}
                                        disabled={saving}
                                    >
                                        <FiSave /> {saving ? 'Kaydediliyor...' : 'Şablonları Kaydet'}
                                    </button>
                                </div>

                            </div>

                        )}

                        {activeTab === 'sms' && isAdmin && settings && (
                            <div className="card" style={{ maxWidth: 600 }}>
                                <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiMessageSquare style={{ color: '#10b981' }} /> Yeni Kayıt SMS Bildirimi
                                </h3>
                                <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                                    Yeni bir kayıt oluşturulduğunda aşağıdaki numaralara otomatik SMS gönderilir.
                                    <br />
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Kullanılabilir değişkenler:</span>{' '}
                                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{AD_SOYAD}'}</code>{' '}
                                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{HISSE_TIPI}'}</code>{' '}
                                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{SIPARIS_NO}'}</code>{' '}
                                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{ODEME_YONTEMI}'}</code>
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                                    <input
                                        type="checkbox"
                                        id="new-record-sms-toggle"
                                        checked={settings.newRecordSmsEnabled ?? false}
                                        onChange={(e) => setSettings({ ...settings, newRecordSmsEnabled: e.target.checked })}
                                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
                                    />
                                    <label htmlFor="new-record-sms-toggle" style={{ fontSize: 14, cursor: 'pointer', fontWeight: 600, color: '#10b981' }}>
                                        Yeni kayıt geldiğinde SMS gönder
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Bildirim Alacak Telefon Numaraları
                                    </label>
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                                        <input
                                            className="form-input"
                                            value={newSmsNumber}
                                            onChange={(e) => setNewSmsNumber(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Örn: 05551234567"
                                            disabled={!settings.newRecordSmsEnabled}
                                            maxLength={11}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            disabled={!settings.newRecordSmsEnabled || newSmsNumber.length < 10}
                                            onClick={() => {
                                                const currentNumbers = settings.newRecordSmsNumbers
                                                    ? settings.newRecordSmsNumbers.split(',').map(n => n.trim()).filter(n => n)
                                                    : [];
                                                if (!currentNumbers.includes(newSmsNumber)) {
                                                    const updatedNumbers = [...currentNumbers, newSmsNumber].join(', ');
                                                    setSettings({ ...settings, newRecordSmsNumbers: updatedNumbers });
                                                    setNewSmsNumber('');
                                                } else {
                                                    alert('Bu numara zaten ekli.');
                                                }
                                            }}
                                        >
                                            <FiPlus /> Ekle
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {(settings.newRecordSmsNumbers || '').split(',').map(n => n.trim()).filter(n => n).map((number, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 12px',
                                                background: '#f8fafc',
                                                borderRadius: 6,
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <span style={{ fontWeight: 500, color: '#334155' }}>{number}</span>
                                                <button
                                                    className="btn btn-icon btn-sm btn-ghost"
                                                    style={{ color: 'var(--accent-danger)' }}
                                                    onClick={() => {
                                                        const updatedNumbers = settings.newRecordSmsNumbers
                                                            .split(',')
                                                            .map(n => n.trim())
                                                            .filter(n => n !== number)
                                                            .join(', ');
                                                        setSettings({ ...settings, newRecordSmsNumbers: updatedNumbers });
                                                    }}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        ))}
                                        {(!settings.newRecordSmsNumbers || settings.newRecordSmsNumbers.trim() === '') && (
                                            <div style={{ textAlign: 'center', padding: 15, color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0', borderRadius: 6 }}>
                                                Henüz numara eklenmemiş.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Mesaj Şablonu</label>
                                    <textarea
                                        className="form-textarea"
                                        value={settings.newRecordSmsTemplate ?? ''}
                                        onChange={(e) => setSettings({ ...settings, newRecordSmsTemplate: e.target.value })}
                                        placeholder="YENI KAYIT: {AD_SOYAD} - {HISSE_TIPI} - SIPARIS NO: {SIPARIS_NO}"
                                        rows={4}
                                        disabled={!settings.newRecordSmsEnabled}
                                    />
                                    {settings.newRecordSmsTemplate && (
                                        <div style={{ fontSize: 12, color: '#666', marginTop: 6, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                            <strong>Önizleme:</strong>{' '}
                                            {settings.newRecordSmsTemplate
                                                .replace(/{AD_SOYAD}/g, 'Ahmet Yılmaz')
                                                .replace(/{HISSE_TIPI}/g, '20-25 KG HİSSE')
                                                .replace(/{SIPARIS_NO}/g, '59794')
                                                .replace(/{ODEME_YONTEMI}/g, 'Nakit')}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="btn btn-success"
                                    style={{ width: '100%', marginTop: 10 }}
                                    onClick={handleSaveSettings}
                                    disabled={saving}
                                >
                                    <FiSave /> {saving ? 'Kaydediliyor...' : 'Bildirim Ayarlarını Kaydet'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'shares' && isAdmin && (

                            <div className="card">
                                <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiPlus /> Yeni Hisse Tipi Ekle
                                </h3>
                                <div className="form-row" style={{ background: '#f8fafc', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                                    <div className="form-group">
                                        <label className="form-label">Hisse Adı</label>
                                        <input className="form-input" value={newShareName} onChange={e => setNewShareName(e.target.value)} placeholder="Örn: 20-25 KG HİSSE" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fiyat (₺)</label>
                                        <input type="number" className="form-input" value={newSharePrice} onChange={e => setNewSharePrice(e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Min KG</label>
                                        <input type="number" className="form-input" value={newShareMinKg} onChange={e => setNewShareMinKg(e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Max KG</label>
                                        <input type="number" className="form-input" value={newShareMaxKg} onChange={e => setNewShareMaxKg(e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Stok Adedi</label>
                                        <input type="number" className="form-input" value={newShareStock} onChange={e => setNewShareStock(e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button className="btn btn-primary" onClick={handleAddShareType} disabled={saving} style={{ height: 42 }}>
                                            <FiPlus /> Ekle
                                        </button>
                                    </div>
                                </div>

                                <h3>Mevcut Hisse Tipleri</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                                <th style={{ padding: 10 }}>Hisse Adı</th>
                                                <th style={{ padding: 10 }}>Fiyat</th>
                                                <th style={{ padding: 10 }}>KG Aralığı</th>
                                                <th style={{ padding: 10 }}>HİSSE STOK ADEDİ</th>
                                                <th style={{ padding: 10 }}>SATILAN HİSSE ADEDİ</th>
                                                <th style={{ padding: 10 }}>KALAN STOK ADEDİ</th>
                                                <th style={{ padding: 10 }}>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareTypes.map(st => {
                                                const soldCount = records.filter(r => r.shareTypeId === st.id && r.status !== 'cancelled').length;
                                                const remainingStock = st.stockQuantity - soldCount;
                                                return (
                                                <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: 10, fontWeight: 500 }}>{st.name}</td>
                                                    <td style={{ padding: 10 }}>{st.price.toLocaleString('tr-TR')} ₺</td>
                                                    <td style={{ padding: 10 }}>{st.minKg} - {st.maxKg} KG</td>
                                                    <td style={{ padding: 10 }}>
                                                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ width: 70, padding: '4px 8px', textAlign: 'center' }}
                                                                value={st.stockQuantity}
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setShareTypes(prev => prev.map(s => s.id === st.id ? { ...s, stockQuantity: val } : s));
                                                                }}
                                                            />
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => handleUpdateStock(st.id, st.stockQuantity)}
                                                                style={{ padding: '4px 12px', fontSize: 12 }}
                                                            >
                                                                Kaydet
                                                            </button>
                                                            {saveStatus === st.id && (
                                                                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginLeft: 4 }}>
                                                                    Kaydedildi!
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: 10, fontWeight: 600, color: '#6366f1' }}>{soldCount}</td>
                                                    <td style={{ padding: 10, fontWeight: 700, color: remainingStock > 0 ? '#10b981' : remainingStock === 0 ? '#f59e0b' : '#ef4444' }}>
                                                        {remainingStock}
                                                    </td>
                                                    <td style={{ padding: 10 }}>
                                                        <button
                                                            className="btn btn-sm btn-icon btn-danger"
                                                            onClick={() => handleDeleteShareType(st.id)}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeTab === 'users' && isAdmin && (
                            <div className="card">
                                <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiUserPlus /> Yeni Personel Ekle
                                </h3>
                                <div className="form-row" style={{ background: '#f8fafc', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                                    <div className="form-group">
                                        <label className="form-label">Ad Soyad</label>
                                        <input className="form-input" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Örn: Ahmet Yılmaz" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kullanıcı Adı</label>
                                        <input className="form-input" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} placeholder="ahmet123" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Şifre</label>
                                        <input className="form-input" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} type="text" placeholder="123456" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Yetki</label>
                                        <select className="form-select" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}>
                                            <option value="employee">Çalışan</option>
                                            <option value="admin">Yönetici</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button className="btn btn-primary" onClick={handleAddUser} disabled={saving} style={{ height: 42 }}>
                                            <FiPlus /> Ekle
                                        </button>
                                    </div>
                                </div>

                                <h3>Sistemdeki Personeller</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                                <th style={{ padding: 10 }}>Ad Soyad</th>
                                                <th style={{ padding: 10 }}>Kullanıcı Adı</th>
                                                <th style={{ padding: 10 }}>Yetki</th>
                                                <th style={{ padding: 10 }}>Durum</th>
                                                <th style={{ padding: 10 }}>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: 10, fontWeight: 500 }}>{u.fullName}</td>
                                                    <td style={{ padding: 10 }}>{u.username}</td>
                                                    <td style={{ padding: 10 }}>
                                                        <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-ghost'}`}>
                                                            {u.role === 'admin' ? 'Yönetici' : 'Çalışan'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: 10 }}>
                                                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                            {u.isActive ? 'Aktif' : 'Pasif'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: 10 }}>
                                                        <div style={{ display: 'flex', gap: 5 }}>
                                                            <button
                                                                className={`btn btn-sm ${u.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                                                onClick={() => handleToggleUser(u)}
                                                                title={u.isActive ? 'Pasife Al' : 'Aktife Al'}
                                                            >
                                                                {u.isActive ? <FiUserX /> : <FiUserCheck />}
                                                            </button>
                                                            {u.id !== user?.id && (
                                                                <button
                                                                    className="btn btn-sm btn-icon btn-danger"
                                                                    onClick={async () => {
                                                                        if (confirm('Silinsin mi?')) {
                                                                            await deleteUser(u.id);
                                                                            loadData();
                                                                        }
                                                                    }}
                                                                >
                                                                    <FiTrash2 />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {selectedRecord && (
                    <RecordEditModal
                        record={selectedRecord}
                        onClose={() => setSelectedRecord(null)}
                        isAdminView={true}
                        onSave={() => {
                            loadData(); // Refresh data after edit
                        }}
                    />
                )}
            </div>
        );
    }

    if (authLoading) return <div className="loading">Yükleniyor...</div>;
    return null;
}
