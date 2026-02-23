import { useState, useEffect } from 'react';
import { updateRecord, deleteRecord, getSettings, getShareTypes, getGroups, addMemberToGroup, removeMemberFromGroup } from '@/lib/firestore'; // Added group utils
import type { Record as RecordType, PaymentType, Settings, ShareType, Group } from '@/types';
import { generateReceipt } from '@/utils/pdfGenerator';
import { useAuth } from '@/context/AuthContext';
import { sendSMS, generateOTP } from '@/utils/sms';
import { FiX, FiCheck, FiDownload, FiTrash2, FiShield, FiUser, FiSend, FiMessageSquare } from 'react-icons/fi';

interface RecordEditModalProps {
    record: RecordType | null;
    onClose: () => void;
    onSave: () => void;
    isAdminView?: boolean; // Added to distinguish context
}

export default function RecordEditModal({ record, onClose, onSave, isAdminView = false }: RecordEditModalProps) {
    const { isAdmin } = useAuth();
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');

    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [sendSmsToggle, setSendSmsToggle] = useState(true); // New toggle state
    const [serverOtp, setServerOtp] = useState('');
    const [userOtp, setUserOtp] = useState('');
    const [depositInput, setDepositInput] = useState('');

    // Custom SMS State
    const [customMessage, setCustomMessage] = useState('');
    const [sendingSms, setSendingSms] = useState(false);

    const replaceVariables = (text: string) => {
        if (!record) return text;
        return text
            .replace(/{AD_SOYAD}/g, record.ownerName)
            .replace(/{SIPARIS_NO}/g, record.orderNumber?.toString() || '')
            .replace(/{KESIM_GUNU}/g, record.daySelection?.toString() || '');
    };

    useEffect(() => {
        setEditRecord(record);
        setOtpSent(false);
        setServerOtp('');
        setUserOtp('');
        // Fetch settings for receipt generation
        getSettings().then(setSettings).catch(console.error);
        getShareTypes().then(setShareTypes).catch(console.error);
        getGroups().then(setGroups).catch(console.error);
        setSelectedGroupId(record?.groupId || '');
        setDepositInput(record?.depositAmount ? record.depositAmount.toString() : '');
    }, [record]);

    if (!editRecord || !record) return null;

    async function handleRequestUpdate() {
        if (!editRecord) return;

        // Validation
        if (!editRecord.ownerName) return alert('Ad Soyad boş olamaz.');

        // If Admin AND in Admin View, proceed directly
        if (isAdmin && isAdminView) {
            await executeUpdate();
            return;
        }

        // If SMS toggle is OFF, proceed directly without OTP
        if (!sendSmsToggle) {
            await executeUpdate();
            return;
        }

        // If Normal User and SMS toggle is ON, send OTP
        setSaving(true);
        const code = generateOTP();
        setServerOtp(code);

        // Use phone or phoneBackup
        const targetPhone = editRecord.phone || editRecord.phoneBackup;
        if (!targetPhone) {
            alert('Kayıtlı telefon numarası bulunamadı, SMS gönderilemiyor.');
            setSaving(false);
            return;
        }

        const message = `Sayin ${editRecord.ownerName}, guncelleme islemi icin dogrulama kodunuz: ${code}`;

        try {
            await sendSMS(targetPhone, message);
            setOtpSent(true);
            alert(`Doğrulama kodu ${targetPhone} numarasına gönderildi. (Demo: ${code})`);
        } catch (error) {
            console.error('SMS Hatası:', error);
            alert('SMS gönderilemedi.');
        } finally {
            setSaving(false);
        }
    }

    async function verifyAndSave() {
        if (userOtp !== serverOtp) {
            alert('Hatalı doğrulama kodu!');
            return;
        }
        await executeUpdate();
    }

    async function executeUpdate() {
        if (!editRecord) return;
        setSaving(true);
        try {
            await updateRecord(editRecord.id, {
                ownerName: editRecord.ownerName,
                phone: editRecord.phone,
                phoneBackup: editRecord.phoneBackup,
                shareTypeId: editRecord.shareTypeId,
                shareTypeName: editRecord.shareTypeName,
                totalPrice: editRecord.totalPrice,
                depositAmount: editRecord.depositAmount,
                paymentType: editRecord.paymentType,
                notes: editRecord.notes,
                dueDate: editRecord.dueDate,
                daySelection: editRecord.daySelection,
                status: editRecord.status,
                groupId: selectedGroupId || null,
            });

            // Handle Group Membership Changes
            if (selectedGroupId !== (record?.groupId || '')) {
                // 1. Remove from old group if existed
                if (record?.groupId) {
                    await removeMemberFromGroup(record.groupId, record.id);
                }
                // 2. Add to new group if selected
                if (selectedGroupId) {
                    await addMemberToGroup(selectedGroupId, record!.id);
                }
            }

            // Send Confirmation SMS if not in Admin View (i.e., triggered by OTP flow) AND toggle is ON
            if (!isAdminView && sendSmsToggle) {
                const targetPhone = editRecord.phone || editRecord.phoneBackup;
                if (targetPhone) {
                    const confirmMessage = `SAYIN MUSTERIMIZ , ${editRecord.shareTypeName} KURBAN SIPARISINIZ GUNCELENMISTIR. SIPARIS NO: ${editRecord.orderNumber || ''} ALLAH KABUL ETSIN.`;
                    await sendSMS(targetPhone, confirmMessage);
                }
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Güncelleme hatası:', error);
            alert('Güncelleme sırasında bir hata oluştu.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!isAdmin) return;

        setDeleting(true);
        try {
            await deleteRecord(editRecord!.id);
            onSave(); // Refresh list
            onClose();
            setShowDeleteConfirm(false);
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Silme işlemi başarısız.');
        } finally {
            setDeleting(false);
        }
    }

    async function handleCancelRecord() {
        if (!confirm('Bu kaydı iptal etmek istediğinize emin misiniz?')) return;
        setSaving(true);
        try {
            // Normal users' cancellation requests go to 'pending_cancellation'
            // Admins can trigger this too if they want to use the explicit 'İptal Et' button
            const targetStatus = isAdmin ? 'cancelled' : 'pending_cancellation';
            await updateRecord(record!.id, { status: targetStatus });

            if (targetStatus === 'cancelled' && record?.groupId) {
                await removeMemberFromGroup(record.groupId, record.id);
            }

            alert(isAdmin ? 'Kayıt iptal edildi.' : 'İptal talebiniz alındı (Onay bekleniyor).');
            onSave();
            onClose();
        } catch (error) {
            console.error('İptal hatası:', error);
            alert('İptal işlemi başarısız.');
        } finally {
            setSaving(false);
        }
    }

    const handleDownloadReceipt = () => {
        if (editRecord) {
            generateReceipt(editRecord, settings);
        }
    };

    async function handleSendCustomSms() {
        const targetPhone = editRecord?.phone || editRecord?.phoneBackup;
        if (!targetPhone) return alert('Telefon numarası bulunamadı.');
        if (!customMessage.trim()) return alert('Lütfen mesaj yazın.');

        setSendingSms(true);
        try {
            await sendSMS(targetPhone, customMessage);
            alert('SMS başarıyla gönderildi.');
            setCustomMessage('');
        } catch (error) {
            console.error('Custom SMS error:', error);
            alert('SMS gönderilemedi.');
        } finally {
            setSendingSms(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h3>Kayıt Düzenle</h3>
                        {editRecord.orderNumber && <span className="badge badge-primary">#{editRecord.orderNumber}</span>}
                        {isAdmin && (
                            <select
                                className="form-select"
                                style={{ width: 'auto', padding: '2px 8px', fontSize: '12px', height: '28px' }}
                                value={editRecord.status || 'waiting_approval'}
                                onChange={(e) => setEditRecord({ ...editRecord, status: e.target.value as any })}
                            >
                                <option value="waiting_approval">⏳ Ödeme Onayı Bekleniyor</option>
                                <option value="approved">✅ Ödeme Onaylandı</option>
                                <option value="pending_cancellation">⏳ İptal Bekliyor</option>
                                <option value="cancelled">❌ İptal Edildi</option>
                            </select>
                        )}
                        {isAdmin && <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiShield /> Admin</span>}
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><FiX /></button>
                </div>

                {!otpSent ? (
                    <>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Ad Soyad</label>
                                <input
                                    className="form-input"
                                    value={editRecord.ownerName}
                                    onChange={(e) => setEditRecord({ ...editRecord, ownerName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefon</label>
                                <input
                                    className="form-input"
                                    value={editRecord.phone}
                                    onChange={(e) => setEditRecord({ ...editRecord, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Yedek Telefon</label>
                                <input
                                    className="form-input"
                                    value={editRecord.phoneBackup}
                                    onChange={(e) => setEditRecord({ ...editRecord, phoneBackup: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hisse Tipi (Paket)</label>
                                <select
                                    className="form-select"
                                    value={editRecord.shareTypeId}
                                    onChange={(e) => {
                                        const typeId = e.target.value;
                                        const selectedType = shareTypes.find(t => t.id === typeId);
                                        if (selectedType) {
                                            setEditRecord({
                                                ...editRecord,
                                                shareTypeId: selectedType.id,
                                                shareTypeName: selectedType.name,
                                                totalPrice: selectedType.price
                                            });
                                        }
                                    }}
                                    disabled={!!editRecord.groupId}
                                >
                                    {shareTypes.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.name} ({type.price.toLocaleString('tr-TR')} ₺)
                                        </option>
                                    ))}
                                </select>
                                {editRecord.groupId && <div style={{ fontSize: 11, color: 'var(--accent-warning)', marginTop: 4 }}>Grup üyesi olduğu için hisse tipi değiştirilemez.</div>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Toplam Tutar</label>
                                <input
                                    className="form-input"
                                    value={editRecord.totalPrice}
                                    disabled
                                    style={{ backgroundColor: '#f9fafb' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ödenen Tutar</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    inputMode="decimal"
                                    value={depositInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setDepositInput(val);
                                            setEditRecord({ ...editRecord, depositAmount: parseFloat(val) || 0 });
                                        }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Kesim Günü</label>
                                <select
                                    className="form-select"
                                    value={editRecord.daySelection}
                                    onChange={(e) => setEditRecord({ ...editRecord, daySelection: parseInt(e.target.value) as 1 | 2 | 3 })}
                                >
                                    <option value={1}>1. Gün</option>
                                    <option value={2}>2. Gün</option>
                                    <option value={3}>3. Gün</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ödeme Türü</label>
                                <select
                                    className="form-select"
                                    value={editRecord.paymentType}
                                    onChange={(e) => setEditRecord({ ...editRecord, paymentType: e.target.value as PaymentType })}
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
                                    className="form-input"
                                    type="date"
                                    value={editRecord.dueDate ? new Date(editRecord.dueDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setEditRecord({ ...editRecord, dueDate: e.target.value ? new Date(e.target.value) : null })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <textarea
                                className="form-textarea"
                                value={editRecord.notes}
                                onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ fontWeight: 600 }}>Grup Ataması</label>
                            <select
                                className="form-select"
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                style={{ border: '1px solid var(--accent-primary)', backgroundColor: '#f0f9ff' }}
                            >
                                <option value="">--- Gruptan Çıkar / Grupsuz ---</option>
                                {groups
                                    .filter(g => {
                                        const groupST = shareTypes.find(st => st.id === g.shareTypeId);
                                        const currentST = shareTypes.find(st => st.id === editRecord.shareTypeId);
                                        if (!groupST || !currentST) return g.shareTypeId === editRecord.shareTypeId;
                                        return groupST.minKg === currentST.minKg && groupST.maxKg === currentST.maxKg;
                                    })
                                    .map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} ({g.memberIds.length} Üye)
                                        </option>
                                    ))
                                }
                            </select>
                            <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                * <strong>{editRecord.shareTypeName}</strong> ile aynı kilo aralığındaki tüm gruplar listelenmektedir.
                            </p>
                        </div>

                        {isAdminView && (
                            <div style={{ padding: '10px 15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiUser style={{ color: '#1976d2' }} />
                                <span style={{ fontSize: 13, color: '#64748b' }}>
                                    Bu siparişi <strong>{record.createdBy || 'Bilinmiyor'}</strong> oluşturdu.
                                </span>
                            </div>
                        )}

                        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 20 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#166534' }}>
                                <FiMessageSquare /> Müşteriye SMS Gönder
                            </h4>
                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Mesajınızı buraya yazın..."
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    rows={3}
                                    style={{ background: 'white' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 15 }}>
                                {settings?.smsTemplates?.map(t => (
                                    <button
                                        key={t.id}
                                        className="btn btn-xs btn-ghost"
                                        style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #ccc' }}
                                        onClick={() => setCustomMessage(replaceVariables(t.text))}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                className="btn btn-success btn-sm"
                                style={{ width: '100%' }}
                                onClick={handleSendCustomSms}
                                disabled={sendingSms || !customMessage.trim()}
                            >
                                <FiSend /> {sendingSms ? 'Gönderiliyor...' : 'Manuel SMS Gönder'}
                            </button>
                        </div>

                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className="btn btn-outline-primary"
                                    onClick={handleDownloadReceipt}
                                    title="Mevcut bilgilerle makbuz oluştur"
                                >
                                    <FiDownload /> Makbuz Al
                                </button>
                                {isAdmin ? (
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={deleting || saving}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                    >
                                        <FiTrash2 /> Sil
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleCancelRecord}
                                        disabled={saving}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                    >
                                        <FiX /> Kaydı İptal Et
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        id="send-sms-toggle-edit"
                                        checked={sendSmsToggle}
                                        onChange={(e) => setSendSmsToggle(e.target.checked)}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                    />
                                    <label htmlFor="send-sms-toggle-edit" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}>Müşteriye SMS Gönder</label>
                                </div>
                                <button className="btn btn-primary" onClick={handleRequestUpdate} disabled={saving}>
                                    <FiCheck /> {isAdmin ? 'Güncelle' : 'Doğrula ve Güncelle'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <h4>SMS Doğrulama</h4>
                        <p>Lütfen <strong>{editRecord.phone || editRecord.phoneBackup}</strong> numarasına gönderilen 6 haneli kodu giriniz.</p>

                        <div style={{ margin: '20px auto', maxWidth: '200px' }}>
                            <input
                                type="text"
                                className="form-input"
                                style={{ textAlign: 'center', letterSpacing: 5, fontSize: 20 }}
                                value={userOtp}
                                onChange={(e) => setUserOtp(e.target.value)}
                                placeholder="******"
                                maxLength={6}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
                            <button className="btn btn-ghost" onClick={() => setOtpSent(false)}>Geri Dön</button>
                            <button className="btn btn-primary" onClick={verifyAndSave} disabled={saving || userOtp.length !== 6}>
                                Onayla ve Kaydet
                            </button>
                        </div>
                    </div>
                )}

                {showDeleteConfirm && (
                    <div className="modal-backdrop" style={{ zIndex: 2000 }}>
                        <div className="modal" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: 40, color: 'var(--accent-danger)', marginBottom: 15 }}>
                                <FiTrash2 />
                            </div>
                            <h4 style={{ marginBottom: 10 }}>Kayıt Silinsin mi?</h4>
                            <p style={{ color: '#666', marginBottom: 25, fontSize: 14 }}>
                                Bu kaydı silmek istediğinize emin misiniz?<br />
                                <strong>Bu işlem geri alınamaz!</strong>
                            </p>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                    Vazgeç
                                </button>
                                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                                    {deleting ? 'Siliniyor...' : 'Evet, Sil'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
