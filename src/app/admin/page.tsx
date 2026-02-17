'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { FiLock, FiSettings, FiTag, FiLogOut, FiSave, FiPlus, FiTrash2, FiList, FiSearch, FiEdit } from 'react-icons/fi';
import { getSettings, updateSettings, getShareTypes, addShareType, deleteShareType, getRecords } from '@/lib/firestore';
import type { Settings, ShareType, Record as RecordType } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { isAdmin, login, logout } = useAdmin();
    const [activeTab, setActiveTab] = useState<'settings' | 'shares' | 'collections'>('collections');

    // Data State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [records, setRecords] = useState<RecordType[]>([]);
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
        if (isAdmin) {
            loadData();
        }
    }, [isAdmin]);

    async function loadData() {
        setLoading(true);
        try {
            const [s, t, r] = await Promise.all([getSettings(), getShareTypes(), getRecords()]);
            setSettings(s);
            setShareTypes(t);
            setRecords(r);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!login(password)) {
            setError('Hatalı şifre!');
        }
    };

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
        (r.phone && r.phone.includes(searchQuery))
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

                <div className="tabs" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <button
                        className={`btn ${activeTab === 'collections' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('collections')}
                    >
                        <FiList /> Kayıtlar & Tahsilat
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
                                                placeholder="İsim veya telefon ile ara..."
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

                        {activeTab === 'shares' && (
                            <div className="card">
                                <h3 style={{ marginBottom: 15 }}>Hisse Tipleri Yönetimi</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                                <th style={{ padding: 10 }}>Ad</th>
                                                <th style={{ padding: 10 }}>Fiyat</th>
                                                <th style={{ padding: 10 }}>KG Aralığı</th>
                                                <th style={{ padding: 10 }}>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareTypes.map((st) => (
                                                <tr key={st.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: 10 }}>{st.name}</td>
                                                    <td style={{ padding: 10 }}>{st.price.toLocaleString('tr-TR')} ₺</td>
                                                    <td style={{ padding: 10 }}>{st.minKg} - {st.maxKg} KG</td>
                                                    <td style={{ padding: 10 }}>
                                                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDeleteShareType(st.id)}>
                                                            <FiTrash2 />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ background: '#f0f9ff' }}>
                                                <td style={{ padding: 10 }}>
                                                    <input
                                                        className="form-input"
                                                        placeholder="Örn: Büyükbaş 1/7"
                                                        value={newShareName}
                                                        onChange={e => setNewShareName(e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: 10 }}>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Fiyat"
                                                        value={newSharePrice}
                                                        onChange={e => setNewSharePrice(e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: 10 }}>
                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            placeholder="Min"
                                                            style={{ width: 60 }}
                                                            value={newShareMinKg}
                                                            onChange={e => setNewShareMinKg(e.target.value)}
                                                        />
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            placeholder="Max"
                                                            style={{ width: 60 }}
                                                            value={newShareMaxKg}
                                                            onChange={e => setNewShareMaxKg(e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: 10 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={handleAddShareType} disabled={saving}>
                                                        <FiPlus /> Ekle
                                                    </button>
                                                </td>
                                            </tr>
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
                        onSave={() => {
                            loadData(); // Refresh data after edit
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f5f7fa'
        }}>
            <form onSubmit={handleSubmit} style={{
                background: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                        background: '#e3f2fd',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px',
                        color: '#1976d2',
                        fontSize: '24px'
                    }}>
                        <FiLock />
                    </div>
                    <h2 style={{ margin: 0, color: '#333' }}>Yönetici Girişi</h2>
                </div>

                {error && (
                    <div style={{
                        background: '#ffebee',
                        color: '#c62828',
                        padding: '10px',
                        borderRadius: '4px',
                        marginBottom: '15px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#555' }}>Şifre</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '16px'
                        }}
                        placeholder="Admin şifresi..."
                    />
                </div>

                <button type="submit" style={{
                    width: '100%',
                    padding: '12px',
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}>
                    Giriş Yap
                </button>
            </form>
        </div>
    );
}
