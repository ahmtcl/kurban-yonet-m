'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FiLock, FiSettings, FiTag, FiLogOut, FiSave, FiPlus, FiTrash2, FiList, FiSearch, FiEdit, FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiMessageSquare } from 'react-icons/fi';
import { getSettings, updateSettings, getShareTypes, addShareType, deleteShareType, getRecords, getUsers, addUser, updateUser, deleteUser, getGroups } from '@/lib/firestore';
import type { Settings, ShareType, Record as RecordType, User, UserRole, Group } from '@/types';
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
    const [groups, setGroups] = useState<Group[]>([]);

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
                                                            <div style={{ color: 'var(--accent-success)', fontSize: 13 }}>{r.depositAmount.toLocaleString('tr-TR')} ₺</div>
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

                                <div style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
                                    <h3 style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FiMessageSquare /> SMS Şablonları Yönetimi
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
                                        Kayıt düzenleme ekranında hızlıca kullanabileceğiniz mesaj şablonlarını buradan yönetebilirsiniz.
                                        <br />
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Değişkenler:</span> {`{AD_SOYAD}, {SIPARIS_NO}, {KESIM_GUNU}`}
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
                                                <th style={{ padding: 10 }}>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareTypes.map(st => (
                                                <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: 10, fontWeight: 500 }}>{st.name}</td>
                                                    <td style={{ padding: 10 }}>{st.price.toLocaleString('tr-TR')} ₺</td>
                                                    <td style={{ padding: 10 }}>{st.minKg} - {st.maxKg} KG</td>
                                                    <td style={{ padding: 10 }}>
                                                        <button
                                                            className="btn btn-sm btn-icon btn-danger"
                                                            onClick={() => handleDeleteShareType(st.id)}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
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
