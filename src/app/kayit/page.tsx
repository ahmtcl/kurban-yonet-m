'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiSave, FiUserPlus, FiCheck, FiX, FiPlus, FiUsers, FiInfo } from 'react-icons/fi';
import { getShareTypes, getGroups, getSettings, getRecords, addRecord, addGroup, addMemberToGroup, getGroupMembers, getRecordById, checkStockAvailability } from '@/lib/firestore';
import type { ShareType, Group, Settings, PaymentType, Record } from '@/types';
import { generateReceipt } from '@/utils/pdfGenerator';
import { sendSMS, generateOTP } from '@/utils/sms';
import { useAuth } from '@/context/AuthContext';

export default function YeniKayit() {
    const router = useRouter();
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [allRecords, setAllRecords] = useState<Record[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

    const { user, loading: authLoading } = useAuth();

    // Form state
    const [ownerName, setOwnerName] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneBackup, setPhoneBackup] = useState('');
    const [shareTypeId, setShareTypeId] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [paymentType, setPaymentType] = useState<PaymentType>('nakit');
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isStockAvailable, setIsStockAvailable] = useState(true);
    const [remainingStockCount, setRemainingStockCount] = useState<number | null>(null);
    const [checkingStock, setCheckingStock] = useState(false);
    const [isStockDefined, setIsStockDefined] = useState(false);

    // Auto-generated date (read-only)
    const [registrationDate] = useState(new Date().toISOString().split('T')[0]);

    // Group modal state
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupShareType, setNewGroupShareType] = useState('');
    const [groupMode, setGroupMode] = useState<'select' | 'new'>('select');
    const [assignedGroupId, setAssignedGroupId] = useState<string | null>(null);
    const [previewMembers, setPreviewMembers] = useState<Record[]>([]);

    // Receipt state
    const [lastRecord, setLastRecord] = useState<Record | null>(null);

    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [sendSmsToggle, setSendSmsToggle] = useState(true); // New toggle state
    const [serverOtp, setServerOtp] = useState('');
    const [userOtp, setUserOtp] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [types, grps, sett, recs] = await Promise.all([
                getShareTypes(),
                getGroups(),
                getSettings(),
                getRecords(),
            ]);
            setShareTypes(types.filter(t => t.isActive));
            setGroups(grps);
            setSettings(sett);
            setAllRecords(recs);
        } catch (err) {
            console.error('Veri yüklenirken hata:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (shareTypeId) {
            handleCheckStock(shareTypeId);
        } else {
            setIsStockAvailable(true);
            setRemainingStockCount(null);
        }
    }, [shareTypeId]);

    async function handleCheckStock(id: string) {
        setCheckingStock(true);
        try {
            const result = await checkStockAvailability(id);
            setIsStockAvailable(result.available);
            setRemainingStockCount(result.remaining);
            setIsStockDefined(result.stockDefined);
        } catch (err) {
            console.error('Stok kontrol hatası:', err);
            setIsStockAvailable(true);
            setRemainingStockCount(null);
            setIsStockDefined(false);
        } finally {
            setCheckingStock(false);
        }
    }

    const selectedShareType = shareTypes.find((st) => st.id === shareTypeId);
    const totalPrice = selectedShareType?.price || 0;
    const kalanTutar = totalPrice - (parseFloat(depositAmount) || 0);

    // Format phone: auto-add 0 prefix on blur
    function formatPhone(value: string, setter: (v: string) => void) {
        let cleaned = value.replace(/\D/g, '');
        // If 10 digits and not starting with 0, add 0 prefix
        if (cleaned.length === 10 && !cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }

        // If not empty and doesn't start with 0, add it
        if (cleaned.length > 0 && !cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }

        // Ensure max 11 digits
        cleaned = cleaned.slice(0, 11);
        setter(cleaned);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!ownerName.trim() || !shareTypeId) {
            showToast('error', 'Ad Soyad ve Hisse Tipi zorunludur!');
            return;
        }

        // Final stock check before proceeding
        const stockResult = await checkStockAvailability(shareTypeId);
        if (!stockResult.available) {
            setIsStockAvailable(false);
            setRemainingStockCount(0);
            setIsStockDefined(stockResult.stockDefined);
            if (stockResult.stockDefined) {
                alert('⛔ BU HİSSE TİPİNDE STOK TÜKENMİŞTİR! Kayıt yapılamaz.');
            } else {
                alert('⚠️ Bu hisse tipi için stok adedi tanımlanmamıştır. Lütfen önce admin panelinden stok adedi giriniz.');
            }
            return;
        }

        // If SMS toggle is OFF, bypass OTP and save directly
        if (!sendSmsToggle) {
            await handleVerifyAndSave(true);
            return;
        }

        setSaving(true);
        try {
            // Send SMS Verification Code
            const code = generateOTP();
            setServerOtp(code);

            const targetPhone = phone;
            if (!targetPhone || targetPhone.length < 10) {
                showToast('error', 'Geçerli bir telefon numarası giriniz.');
                setSaving(false);
                return;
            }

            const message = `Sayin ${ownerName}, kurban kayit islemi icin dogrulama kodunuz: ${code}`;
            const smsResult = await sendSMS(targetPhone, message);

            if (smsResult) {
                setOtpSent(true);
                showToast('success', `Doğrulama kodu ${targetPhone} numarasına gönderildi.`);
            } else {
                showToast('error', 'SMS gönderilemedi. Lütfen bilgileri kontrol edin.');
            }
        } catch (err) {
            console.error('SMS hatası:', err);
            showToast('error', 'SMS gönderilirken bir hata oluştu!');
        } finally {
            setSaving(false);
        }
    }

    async function handleVerifyAndSave(isBypassed: boolean = false) {
        if (!isBypassed && userOtp !== serverOtp) {
            showToast('error', 'Hatalı doğrulama kodu!');
            return;
        }

        const stockResult = await checkStockAvailability(shareTypeId);
        if (!stockResult.available) {
            if (stockResult.stockDefined) {
                alert('⛔ BU HİSSE TİPİNDE STOK TÜKENMİŞTİR! Kayıt yapılamaz.');
            } else {
                alert('⚠️ Bu hisse tipi için stok adedi tanımlanmamıştır.');
            }
            setIsStockAvailable(false);
            setRemainingStockCount(0);
            setIsStockDefined(stockResult.stockDefined);
            setSaving(false);
            return;
        }

        setSaving(true);
        try {
            const newRecordData = {
                ownerName: ownerName.trim(),
                phone,
                phoneBackup,
                shareTypeId,
                shareTypeName: selectedShareType?.name || '',
                totalPrice,
                depositAmount: parseFloat(depositAmount) || 0,
                paymentType,
                dueDate: dueDate ? new Date(dueDate) : null,
                groupId: assignedGroupId,
                daySelection: settings?.activeDay || 1,
                notes,
                smsVerified: sendSmsToggle, // Use toggle value
                status: 'waiting_approval' as const,
                createdBy: user?.fullName || 'Bilinmiyor',
                createdById: user?.id || '',
            };

            const docRef = await addRecord(newRecordData);

            // 2. Fetch the created record to get the generated orderNumber
            const createdRecord = await getRecordById(docRef.id);
            const orderNo = createdRecord?.orderNumber || '';

            // Set for receipt
            setLastRecord({ id: docRef.id, ...newRecordData, orderNumber: orderNo, createdAt: new Date() } as Record);

            if (assignedGroupId) {
                await addMemberToGroup(assignedGroupId, docRef.id);
            }

            // 3. Send Confirmation SMS if toggle is ON
            if (sendSmsToggle) {
                const confirmMessage = `SAYIN MUSTERIMIZ , ${selectedShareType?.name || ''} KURBAN SIPARISINIZ ALINMISTIR. KURBANINIZI BAYRAMIN 1. GUNU OLAN 27.05.2026 ÇARŞAMBA GUNU 18:00-23:00 SAATLERİ ICINDE TESLIM ALABILIRSINIZ. ALLAH KABUL ETSIN SIPARIS NO: ${orderNo}`;
                await sendSMS(phone, confirmMessage);
            }

            // 4. Send Admin Notification SMS if enabled in settings
            if (settings?.newRecordSmsEnabled && settings.newRecordSmsNumbers?.trim()) {
                const rawTemplate = settings.newRecordSmsTemplate || 'YENI KAYIT: {AD_SOYAD} - {HISSE_TIPI} - {ODEME_YONTEMI} - SIPARIS NO: {SIPARIS_NO}';
                const paymentLabels: { [key: string]: string } = {
                    'nakit': 'Nakit',
                    'kredi_karti': 'Kredi Kartı',
                    'online_kredi_karti': 'Online K.K.',
                    'havale': 'Havale/EFT',
                    'teslimatta': 'Teslimatta'
                };

                const adminMessage = rawTemplate
                    .replace(/{AD_SOYAD}/g, ownerName.trim())
                    .replace(/{HISSE_TIPI}/g, selectedShareType?.name || '')
                    .replace(/{SIPARIS_NO}/g, String(orderNo))
                    .replace(/{ODEME_YONTEMI}/g, paymentLabels[paymentType] || paymentType);

                const targetNumbers = settings.newRecordSmsNumbers
                    .split(',')
                    .map((n) => n.trim().replace(/\D/g, ''))
                    .filter((n) => n.length >= 10);

                for (const number of targetNumbers) {
                    const formattedNumber = number.startsWith('0') ? number : '0' + number;
                    await sendSMS(formattedNumber, adminMessage);
                }
            }

            showToast('success', 'Kayıt başarıyla oluşturuldu ve onay SMS\'i gönderildi!');

            // Reset form
            setOwnerName('');
            setPhone('');
            setPhoneBackup('');
            setShareTypeId('');
            setDepositAmount('');
            setPaymentType('nakit');
            setDueDate('');
            setNotes('');
            setAssignedGroupId(null);
            setAssignedGroupId(null);
            setOtpSent(false);
            setUserOtp('');
            setServerOtp('');
        } catch (err) {
            console.error('Kayıt hatası:', err);
            showToast('error', 'Kayıt oluşturulurken hata oluştu!');
        } finally {
            setSaving(false);
        }
    }

    const handleDownloadReceipt = () => {
        if (lastRecord) {
            generateReceipt(lastRecord, settings);
        }
    };

    async function handleCreateGroup() {
        if (!newGroupName.trim()) return;
        try {
            const shareType = shareTypes.find(s => s.id === (newGroupShareType || shareTypeId));
            const docRef = await addGroup({
                name: newGroupName.trim(),
                shareTypeId: newGroupShareType || shareTypeId,
                shareTypeName: shareType?.name || '',
                description: '',
                memberIds: [],
            });
            setAssignedGroupId(docRef.id);
            setShowGroupModal(false);
            setNewGroupName('');
            showToast('success', 'Grup oluşturuldu!');
            const grps = await getGroups();
            setGroups(grps);
        } catch (err) {
            showToast('error', 'Grup oluşturulamadı!');
        }
    }

    // Fetch members when a group is selected in the modal
    useEffect(() => {
        if (selectedGroupId) {
            getGroupMembers(selectedGroupId).then(setPreviewMembers);
        } else {
            setPreviewMembers([]);
        }
    }, [selectedGroupId]);

    function handleSelectGroup() {
        if (!selectedGroupId) return;
        setAssignedGroupId(selectedGroupId);
        setShowGroupModal(false);
    }

    function showToast(type: string, message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    const assignedGroup = groups.find(g => g.id === assignedGroupId);

    if (loading || authLoading) return <div className="loading">Yükleniyor...</div>;
    if (!user) return null;

    return (
        <>
            <div className="top-bar">
                <h2>Yeni Kayıt Ekle</h2>
            </div>

            <div className="page-content">
                <form onSubmit={handleSubmit} style={{ maxWidth: 800 }}>

                    {/* 1. Müşteri İsteği: Ad Soyad & Kayıt Tarihi */}
                    <div className="form-group">
                        <label className="form-label">Adı Soyadı</label>
                        <input
                            type="text"
                            className="form-input"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Kayıt Tarihi (Otomatik)</label>
                        <input
                            type="date"
                            className="form-input"
                            value={registrationDate}
                            disabled
                            style={{ backgroundColor: '#eee', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Kurban Kesim Günü</label>
                        <div style={{
                            padding: '10px 15px',
                            backgroundColor: '#e3f2fd',
                            color: '#0d47a1',
                            border: '1px solid #bbdefb',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <FiCheck />
                            {settings?.activeDay === 3 ? '3. Gün' : settings?.activeDay === 2 ? '2. Gün' : '1. Gün'} (Otomatik Seçili)
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            * Bu ayar sadece yönetici tarafından değiştirilebilir.
                        </div>
                    </div>

                    {/* 2. Müşteri İsteği: Hisse Seçimi ve Fiyat */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Hisse Tipini Seçin</label>
                            <select
                                className="form-select"
                                value={shareTypeId}
                                onChange={(e) => setShareTypeId(e.target.value)}
                                required
                                style={{
                                    borderColor: !isStockAvailable ? '#ef4444' : undefined,
                                    backgroundColor: !isStockAvailable ? '#fef2f2' : undefined
                                }}
                            >
                                <option value="">Bir öğe seçin</option>
                                {shareTypes.map((st) => (
                                    <option key={st.id} value={st.id}>
                                        {st.name} ({st.minKg}-{st.maxKg} KG)
                                    </option>
                                ))}
                            </select>
                            {shareTypeId && !checkingStock && isStockDefined && isStockAvailable && remainingStockCount !== null && (
                                <div style={{ marginTop: 5, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                                    Kalan Stok: {remainingStockCount}
                                </div>
                            )}
                            {shareTypeId && !checkingStock && !isStockAvailable && (
                                <div style={{
                                    marginTop: 8,
                                    padding: '10px 14px',
                                    backgroundColor: '#fef2f2',
                                    border: '2px solid #ef4444',
                                    borderRadius: 6,
                                    color: '#dc2626',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    textAlign: 'center'
                                }}>
                                    {isStockDefined
                                        ? '⛔ BU HİSSE TİPİNDE STOK TÜKENMİŞTİR!'
                                        : '⚠️ Bu hisse tipi için stok adedi bulunmamaktadır!'}
                                </div>
                            )}
                            {checkingStock && <div style={{ marginTop: 5, fontSize: 12, color: '#666' }}>Stok kontrol ediliyor...</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Hisse Fiyatı</label>
                            <input
                                type="text"
                                className="form-input"
                                value={totalPrice > 0 ? `${totalPrice.toLocaleString('tr-TR')} ₺` : ''}
                                disabled
                                style={{ backgroundColor: '#eee', fontWeight: 'bold' }}
                            />
                        </div>
                    </div>

                    <hr style={{ margin: '20px 0', border: 0, borderTop: '1px solid #ddd' }} />

                    {/* Diğer Bilgiler (Telefon, Ödeme, Grup vb.) */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Telefon 1</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="05XX..."
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                onBlur={() => formatPhone(phone, setPhone)}
                                maxLength={11}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefon 2</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="05XX..."
                                value={phoneBackup}
                                onChange={(e) => setPhoneBackup(e.target.value.replace(/\D/g, ''))}
                                onBlur={() => formatPhone(phoneBackup, setPhoneBackup)}
                                maxLength={11}
                            />
                        </div>
                    </div>

                    <div className="form-row-3">
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Kapora</label>
                            <input
                                type="number"
                                className="form-input"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ödeme Türü</label>
                            <select
                                className="form-select"
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                            >
                                <option value="nakit">Nakit</option>
                                <option value="kredi_karti">Kredi Kartı</option>
                                <option value="online_kredi_karti">Online Kredi Kartı</option>
                                <option value="havale">Havale / EFT</option>
                                <option value="teslimatta">Tamamı Teslimatta</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Vade Tarihi</label>
                            <input
                                type="date"
                                className="form-input"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {totalPrice > 0 && kalanTutar > 0 && (
                        <div className="form-group">
                            <label className="form-label" style={{ color: '#d32f2f' }}>Kalan Tutar</label>
                            <input
                                className="form-input"
                                value={`${kalanTutar.toLocaleString('tr-TR')} ₺`}
                                disabled
                                style={{ color: '#d32f2f', fontWeight: 'bold', backgroundColor: '#fff0f0' }}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Grup Ataması (İsteğe Bağlı)</label>

                        {assignedGroup ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid #ddd', borderRadius: 4, background: '#f9f9f9' }}>
                                <div style={{ flex: 1 }}>
                                    <strong>{assignedGroup.name}</strong>
                                    <div style={{ fontSize: 12, color: '#666' }}>{assignedGroup.shareTypeName}</div>
                                </div>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => setAssignedGroupId(null)}>
                                    <FiX /> Kaldır
                                </button>
                            </div>
                        ) : (
                            shareTypes.find(s => s.id === shareTypeId)?.name?.toLowerCase().includes('küçükbaş') ? (
                                <div style={{ padding: 10, border: '1px dashed #ddd', borderRadius: 4, background: '#f9f9f9', color: '#888', fontStyle: 'italic', fontSize: 13 }}>
                                    <FiInfo style={{ marginRight: 6 }} />
                                    Küçükbaş hisseler için grup oluşturulamaz.
                                </div>
                            ) : (
                                <button type="button" className="btn btn-ghost" onClick={() => setShowGroupModal(true)} style={{ width: '100%', justifyContent: 'flex-start', borderStyle: 'dashed' }}>
                                    <FiUsers /> Gruba Ekle / Oluştur
                                </button>
                            )
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Açıklama / Notlar</label>
                        <textarea
                            className="form-textarea"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 15 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                id="send-sms-toggle"
                                checked={sendSmsToggle}
                                onChange={(e) => setSendSmsToggle(e.target.checked)}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                            <label htmlFor="send-sms-toggle" style={{ fontSize: 14, cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}>Müşteriye SMS Gönder</label>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-success" 
                            disabled={saving || !isStockAvailable || checkingStock}
                        >
                            {saving ? 'Kaydediliyor...' : 'Kaydı Tamamla'}
                        </button>

                        {lastRecord && (
                            <button type="button" className="btn btn-primary" onClick={handleDownloadReceipt}>
                                📄 Makbuz İndir
                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>({lastRecord.ownerName})</span>
                            </button>
                        )}
                    </div>
                </form >

                {otpSent && (
                    <div className="modal-backdrop">
                        <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
                            <div className="modal-header">
                                <h3>SMS Doğrulama</h3>
                                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setOtpSent(false)}><FiX /></button>
                            </div>
                            <div style={{ padding: '20px 10px' }}>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                                    <strong>{phone}</strong> numarasına gönderilen 6 haneli kodu giriniz.
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 25 }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{
                                            maxWidth: 220,
                                            textAlign: 'center',
                                            fontSize: 28,
                                            letterSpacing: 6,
                                            fontWeight: 'bold',
                                            height: 60,
                                            border: '2px solid var(--accent-primary)'
                                        }}
                                        placeholder="000000"
                                        maxLength={6}
                                        value={userOtp}
                                        onChange={(e) => setUserOtp(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                    />
                                </div>
                                <div className="modal-footer" style={{ borderTop: 'none', padding: 0, justifyContent: 'center', gap: 12 }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setOtpSent(false)}
                                        style={{ minWidth: 100 }}
                                    >
                                        Vazgeç
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => handleVerifyAndSave(false)}
                                        disabled={saving || userOtp.length !== 6}
                                        style={{ minWidth: 160 }}
                                    >
                                        {saving ? 'Doğrulanıyor...' : 'Kaydı Tamamla'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div >

            {/* Group Modal - Advanced */}
            {
                showGroupModal && (
                    <div className="modal-backdrop" onClick={() => setShowGroupModal(false)}>
                        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Grup Seçimi</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowGroupModal(false)}><FiX /></button>
                            </div>

                            <div style={{ marginBottom: 20, borderBottom: '1px solid #eee', display: 'flex' }}>
                                <button
                                    className={`btn ${groupMode === 'select' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setGroupMode('select')}
                                    style={{ borderRadius: '4px 4px 0 0', borderBottom: 'none' }}
                                >
                                    Mevcut Grup Seç
                                </button>
                                <button
                                    className={`btn ${groupMode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setGroupMode('new')}
                                    style={{ borderRadius: '4px 4px 0 0', borderBottom: 'none' }}
                                >
                                    Yeni Grup Oluştur
                                </button>
                            </div>

                            {groupMode === 'select' ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Bir Grup Seçin ({shareTypes.find(s => s.id === shareTypeId)?.name})</label>
                                        <div style={{
                                            maxHeight: 250,
                                            overflowY: 'auto',
                                            border: '1px solid #ddd',
                                            borderRadius: 4,
                                            background: '#fff'
                                        }}>
                                            {groups.filter(g => {
                                                if (g.shareTypeId !== shareTypeId) return false;
                                                // Kesim günü kontrolü
                                                if (g.memberIds.length > 0) {
                                                    const memberDays = g.memberIds.map(mid => allRecords.find(r => r.id === mid)?.daySelection).filter(Boolean);
                                                    if (memberDays.length > 0 && memberDays[0] !== (settings?.activeDay || 1)) return false;
                                                }
                                                return true;
                                            }).length > 0 ? groups
                                                .filter(g => {
                                                    if (g.shareTypeId !== shareTypeId) return false;
                                                    if (g.memberIds.length > 0) {
                                                        const memberDays = g.memberIds.map(mid => allRecords.find(r => r.id === mid)?.daySelection).filter(Boolean);
                                                        if (memberDays.length > 0 && memberDays[0] !== (settings?.activeDay || 1)) return false;
                                                    }
                                                    return true;
                                                })
                                                .map(g => (
                                                    <div
                                                        key={g.id}
                                                        onClick={() => setSelectedGroupId(g.id)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderBottom: '1px solid #eee',
                                                            cursor: 'pointer',
                                                            backgroundColor: selectedGroupId === g.id ? '#e3f2fd' : 'transparent',
                                                            color: selectedGroupId === g.id ? '#0d47a1' : 'inherit',
                                                            fontWeight: selectedGroupId === g.id ? 600 : 400,
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        <span>{g.name}</span>
                                                        <span style={{ fontSize: 12, color: selectedGroupId === g.id ? '#0d47a1' : '#666' }}>
                                                            {g.shareTypeName} • {g.memberIds.length} Üye
                                                        </span>
                                                    </div>
                                                )) : (
                                                <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Bu hisse tipi için uygun grup bulunamadı.</div>
                                            )}
                                        </div>
                                    </div>

                                    {selectedGroupId && (
                                        <div style={{ marginTop: 20, border: '1px solid #ddd', borderRadius: 4, padding: 10, background: '#fafafa' }}>
                                            <label className="form-label">Gruptaki Hissedarlar:</label>
                                            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                                                {previewMembers.length > 0 ? (
                                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                                        {previewMembers.map(m => (
                                                            <li key={m.id} style={{ padding: '4px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
                                                                <FiUsers style={{ marginRight: 6, color: '#888' }} />
                                                                {m.ownerName} <span style={{ color: '#999' }}>({m.shareTypeName})</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div style={{ color: '#999', fontSize: 13, padding: 10, textAlign: 'center' }}>Bu grupta henüz hiç üye yok.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-primary" onClick={handleSelectGroup} disabled={!selectedGroupId}>Bu Gruba Ekle</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Grup Adı</label>
                                            <input className="form-input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Örn: 1. Gün Büyük Grup" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Hisse Tipini Seçin (KG Aralığı İçin)</label>
                                            <select className="form-select" value={newGroupShareType} onChange={(e) => setNewGroupShareType(e.target.value)}>
                                                <option value="">Seçiniz</option>
                                                {shareTypes.map(st => (
                                                    <option key={st.id} value={st.id}>{st.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-success" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Grup Oluştur ve Seç</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {
                toast && (
                    <div className={`toast toast-${toast.type}`}>
                        {toast.message}
                    </div>
                )
            }
        </>
    );
}
