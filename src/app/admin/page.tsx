'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FiLock, FiSettings, FiTag, FiLogOut, FiSave, FiPlus, FiTrash2, FiList, FiSearch, FiEdit, FiUsers, FiUserPlus, FiUserCheck, FiUserX } from 'react-icons/fi';
import { getSettings, updateSettings, getShareTypes, addShareType, deleteShareType, getRecords, getUsers, addUser, updateUser, deleteUser } from '@/lib/firestore';
import type { Settings, ShareType, Record as RecordType, User, UserRole } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const { user, isAdmin, logout, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'settings' | 'shares' | 'collections' | 'users'>('collections');

    // Data State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [records, setRecords] = useState<RecordType[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Search & Edit State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

    // New Share Type State
    const [newShareName, setNewShareName] = useState('');
    const [newSharePrice, setNewSharePrice] = useState('');
    const [newShareMinKg, setNewShareMinKg] = useState('');
    const [newShareMaxKg, setNewShareMaxKg] = useState('');

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
            const [s, t, r, u] = await Promise.all([
                getSettings(),
                getShareTypes(),
                getRecords(),
                isAdmin ? getUsers() : Promise.resolve([])
            ]);
            setSettings(s);
            setShareTypes(t);
            setRecords(r);
            setUsers(u);
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
            await updateSettings(settings);
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
                isActive: true
            });
            setNewShareName('');
            setNewSharePrice('');
            setNewShareMinKg('');
            setNewShareMaxKg('');
            loadData();
        } catch (e) {
            alert('Ekleme hatası');
        } finally {
            setSaving(false);
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

    const filteredRecords = records.filter(r =>
        r.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.phone && r.phone.includes(searchQuery)) ||
        (r.orderNumber && r.orderNumber.toString().includes(searchQuery))
    );

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
                        </>
                    )}
                </div>

                {loading ? <div className="loading">Yükleniyor...</div> : (
                    <>
                        {activeTab === 'collections' && (
                            <div className="card">
                                <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="form-input"
                                                placeholder="İsim, telefon veya sipariş no ile ara..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{ paddingLeft: 35 }}
                                            />
                                            <FiSearch style={{ position: 'absolute', left: 10, top: 12, color: '#999' }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                                <th style={{ padding: 12 }}>Sipariş No</th>
                                                <th style={{ padding: 12 }}>Hissedar</th>
                                                <th style={{ padding: 12 }}>Telefon</th>
                                                <th style={{ padding: 12 }}>Grup / Hisse</th>
                                                <th style={{ padding: 12, textAlign: 'right' }}>Toplam</th>
                                                <th style={{ padding: 12, textAlign: 'right' }}>Ödenen</th>
                                                <th style={{ padding: 12, textAlign: 'right' }}>Kalan</th>
                                                <th style={{ padding: 12 }}>Personel</th>
                                                <th style={{ padding: 12, textAlign: 'center' }}>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.map((rec) => {
                                                const remaining = (rec.totalPrice || 0) - (rec.depositAmount || 0);
                                                const shareTypeName = shareTypes.find(t => t.id === rec.shareTypeId)?.name || '-';

                                                return (
                                                    <tr key={rec.id} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: 12, fontWeight: 600, color: '#666' }}>#{rec.orderNumber || '-'}</td>
                                                        <td style={{ padding: 12, fontWeight: 500 }}>{rec.ownerName}</td>
                                                        <td style={{ padding: 12, color: '#666' }}>{rec.phone}</td>
                                                        <td style={{ padding: 12 }}>
                                                            <span className="badge badge-primary">{shareTypeName}</span>
                                                        </td>
                                                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>
                                                            {(rec.totalPrice || 0).toLocaleString('tr-TR')} ₺
                                                        </td>
                                                        <td style={{ padding: 12, textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                                            {(rec.depositAmount || 0).toLocaleString('tr-TR')} ₺
                                                        </td>
                                                        <td style={{ padding: 12, textAlign: 'right', color: remaining > 0 ? '#ef4444' : '#6b7280', fontWeight: 600 }}>
                                                            {remaining.toLocaleString('tr-TR')} ₺
                                                        </td>
                                                        <td style={{ padding: 12, fontSize: 12, color: '#666' }}>
                                                            {rec.createdBy || '-'}
                                                        </td>
                                                        <td style={{ padding: 12, textAlign: 'center' }}>
                                                            <button
                                                                className="btn btn-sm btn-outline-primary"
                                                                onClick={() => setSelectedRecord(rec)}
                                                            >
                                                                <FiEdit /> Düzenle / Tahsilat
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredRecords.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#999' }}>
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
                                <button className="btn btn-success" onClick={handleSaveSettings} disabled={saving}>
                                    <FiSave /> {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                                </button>
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
