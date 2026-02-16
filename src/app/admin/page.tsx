'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSave, FiX, FiSettings, FiTag, FiCheck } from 'react-icons/fi';
import { getShareTypes, getSettings, addShareType, updateShareType, deleteShareType, updateSettings } from '@/lib/firestore';
import type { ShareType, Settings } from '@/types';

export default function AdminPage() {
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'share-types' | 'settings'>('share-types');

    // Share type form
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formMinKg, setFormMinKg] = useState('');
    const [formMaxKg, setFormMaxKg] = useState('');
    const [formPrice, setFormPrice] = useState('');

    // Settings form
    const [settingsForm, setSettingsForm] = useState<Settings | null>(null);

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [types, sett] = await Promise.all([getShareTypes(), getSettings()]);
            setShareTypes(types);
            setSettings(sett);
            setSettingsForm(sett);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function resetForm() {
        setShowForm(false);
        setEditingId(null);
        setFormName('');
        setFormMinKg('');
        setFormMaxKg('');
        setFormPrice('');
    }

    function startEdit(st: ShareType) {
        setEditingId(st.id);
        setFormName(st.name);
        setFormMinKg(st.minKg.toString());
        setFormMaxKg(st.maxKg.toString());
        setFormPrice(st.price.toString());
        setShowForm(true);
    }

    async function handleSaveShareType() {
        if (!formName.trim() || !formPrice) return;
        try {
            const data = {
                name: formName.trim(),
                minKg: parseInt(formMinKg) || 0,
                maxKg: parseInt(formMaxKg) || 0,
                price: parseFloat(formPrice) || 0,
                isActive: true,
            };
            if (editingId) {
                await updateShareType(editingId, data);
                showToast('success', 'Hisse tipi güncellendi!');
            } else {
                await addShareType(data);
                showToast('success', 'Hisse tipi eklendi!');
            }
            resetForm();
            await loadData();
        } catch { showToast('error', 'Hata oluştu!'); }
    }

    async function handleDeleteShareType(id: string) {
        try {
            await deleteShareType(id);
            showToast('success', 'Hisse tipi silindi!');
            setDeleteConfirm(null);
            await loadData();
        } catch { showToast('error', 'Hata!'); }
    }

    async function handleSaveSettings() {
        if (!settingsForm) return;
        try {
            await updateSettings(settingsForm);
            showToast('success', 'Ayarlar kaydedildi!');
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
                <h2>⚙️ Admin Panel</h2>
            </div>

            <div className="page-content">
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button
                        className={`btn ${activeTab === 'share-types' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('share-types')}
                    >
                        <FiTag /> Hisse Tipleri
                    </button>
                    <button
                        className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <FiSettings /> Genel Ayarlar
                    </button>
                </div>

                {/* Share Types Tab */}
                {activeTab === 'share-types' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Hisse Tipleri</h3>
                            <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}>
                                <FiPlus /> Yeni Hisse Tipi
                            </button>
                        </div>

                        {/* Form */}
                        {showForm && (
                            <div style={{
                                padding: 20,
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: 20,
                                border: '1px solid var(--border-color)',
                            }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                                    <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                                        <label className="form-label">Hisse Adı</label>
                                        <input className="form-input" placeholder="Örn: 20-25 KG" value={formName} onChange={(e) => setFormName(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
                                        <label className="form-label">Min KG</label>
                                        <input className="form-input" type="number" placeholder="20" value={formMinKg} onChange={(e) => setFormMinKg(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
                                        <label className="form-label">Max KG</label>
                                        <input className="form-input" type="number" placeholder="25" value={formMaxKg} onChange={(e) => setFormMaxKg(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
                                        <label className="form-label">Fiyat (₺)</label>
                                        <input className="form-input" type="number" placeholder="15000" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-success btn-sm" onClick={handleSaveShareType}>
                                            <FiCheck /> {editingId ? 'Güncelle' : 'Ekle'}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={resetForm}>
                                            <FiX /> İptal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* List */}
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Hisse Adı</th>
                                        <th>KG Aralığı</th>
                                        <th>Fiyat</th>
                                        <th>Durum</th>
                                        <th>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shareTypes.length > 0 ? shareTypes.map((st) => (
                                        <tr key={st.id}>
                                            <td style={{ fontWeight: 600 }}>{st.name}</td>
                                            <td>{st.minKg} - {st.maxKg} KG</td>
                                            <td style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{st.price.toLocaleString('tr-TR')} ₺</td>
                                            <td>
                                                <span className={`badge ${st.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {st.isActive ? 'Aktif' : 'Pasif'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-icon btn-sm btn-ghost" onClick={() => startEdit(st)}><FiEdit /></button>
                                                    <button className="btn btn-icon btn-sm btn-ghost" style={{ color: 'var(--accent-danger)' }} onClick={() => setDeleteConfirm(st.id)}><FiTrash2 /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Henüz hisse tipi eklenmemiş</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && settingsForm && (
                    <div className="card" style={{ maxWidth: 600 }}>
                        <div className="card-header">
                            <h3 className="card-title">Genel Ayarlar</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Ticari Unvan</label>
                            <input className="form-input" placeholder="Şirket / İşletme Adı" value={settingsForm.companyName} onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Vergi / Ticaret Ünvanı</label>
                            <input className="form-input" placeholder="Makbuzda görünecek ünvan" value={settingsForm.companyTitle} onChange={(e) => setSettingsForm({ ...settingsForm, companyTitle: e.target.value })} />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Hedef Kurban Sayısı</label>
                                <input className="form-input" type="number" value={settingsForm.targetCount} onChange={(e) => setSettingsForm({ ...settingsForm, targetCount: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Varsayılan Gün</label>
                                <select className="form-select" value={settingsForm.daySelectionDefault} onChange={(e) => setSettingsForm({ ...settingsForm, daySelectionDefault: parseInt(e.target.value) as 1 | 2 | 3 })}>
                                    <option value={1}>1. Gün</option>
                                    <option value={2}>2. Gün</option>
                                    <option value={3}>3. Gün</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ padding: 15, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
                            <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Aktif Kesim Günü (Kayıt Ekranı İçin)</label>
                            <div style={{ display: 'flex', gap: 15 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="activeDay"
                                        value={1}
                                        checked={settingsForm.activeDay === 1}
                                        onChange={() => setSettingsForm({ ...settingsForm, activeDay: 1 })}
                                    />
                                    <span style={{ fontWeight: settingsForm.activeDay === 1 ? 'bold' : 'normal' }}>1. Gün</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="activeDay"
                                        value={2}
                                        checked={settingsForm.activeDay === 2}
                                        onChange={() => setSettingsForm({ ...settingsForm, activeDay: 2 })}
                                    />
                                    <span style={{ fontWeight: settingsForm.activeDay === 2 ? 'bold' : 'normal' }}>2. Gün</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="activeDay"
                                        value={3}
                                        checked={settingsForm.activeDay === 3}
                                        onChange={() => setSettingsForm({ ...settingsForm, activeDay: 3 })}
                                    />
                                    <span style={{ fontWeight: settingsForm.activeDay === 3 ? 'bold' : 'normal' }}>3. Gün</span>
                                </label>
                            </div>
                            <small style={{ display: 'block', marginTop: 5, color: '#666' }}>
                                Yeni kayıt ekranında sadece seçili olan gün aktif olacaktır. Personel değiştiremez.
                            </small>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">1. Gün Etiketi</label>
                                <input className="form-input" value={settingsForm.day1Label} onChange={(e) => setSettingsForm({ ...settingsForm, day1Label: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">2. Gün Etiketi</label>
                                <input className="form-input" value={settingsForm.day2Label} onChange={(e) => setSettingsForm({ ...settingsForm, day2Label: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={settingsForm.moveButtonEnabled}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, moveButtonEnabled: e.target.checked })}
                                    style={{ width: 16, height: 16 }}
                                />
                                Taşı Butonu Aktif (Gruplarda üye taşıma izni)
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={handleSaveSettings}>
                                <FiSave /> Ayarları Kaydet
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h3>Hisse Tipi Sil</h3></div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Bu hisse tipini silmek istediğinize emin misiniz?</p>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>İptal</button>
                            <button className="btn btn-danger" onClick={() => handleDeleteShareType(deleteConfirm)}><FiTrash2 /> Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
        </>
    );
}
