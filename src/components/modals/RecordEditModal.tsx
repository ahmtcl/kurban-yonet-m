import { useState, useEffect } from 'react';
import { FiX, FiCheck, FiDownload, FiTrash2, FiShield } from 'react-icons/fi';
import { updateRecord, deleteRecord, getSettings, getShareTypes } from '@/lib/firestore'; // Added deleteRecord
import type { Record as RecordType, PaymentType, Settings, ShareType } from '@/types';
import { generateReceipt } from '@/utils/pdfGenerator';
import { useAdmin } from '@/context/AdminContext'; // Added useAdmin
import { sendSMS, generateOTP } from '@/utils/sms'; // Added SMS utils

interface RecordEditModalProps {
    record: RecordType | null;
    onClose: () => void;
    onSave: () => void;
    isAdminView?: boolean; // Added to distinguish context
}

export default function RecordEditModal({ record, onClose, onSave, isAdminView = false }: RecordEditModalProps) {
    const { isAdmin } = useAdmin();
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [shareTypes, setShareTypes] = useState<ShareType[]>([]);

    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [serverOtp, setServerOtp] = useState('');
    const [userOtp, setUserOtp] = useState('');

    useEffect(() => {
        setEditRecord(record);
        setOtpSent(false);
        setServerOtp('');
        setUserOtp('');
        // Fetch settings for receipt generation
        getSettings().then(setSettings).catch(console.error);
        getShareTypes().then(setShareTypes).catch(console.error);
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

        // If Normal User, send OTP
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
                status: editRecord.status, // Included status update
            });
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
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;

        setDeleting(true);
        try {
            await deleteRecord(editRecord!.id);
            onSave(); // Refresh list
            onClose();
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Silme işlemi başarısız.');
        } finally {
            setDeleting(false);
        }
    }

    const handleDownloadReceipt = () => {
        if (editRecord) {
            generateReceipt(editRecord, settings);
        }
    };

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
                                    type="number"
                                    value={editRecord.depositAmount}
                                    onChange={(e) => setEditRecord({ ...editRecord, depositAmount: parseFloat(e.target.value) || 0 })}
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

                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className="btn btn-outline-primary"
                                    onClick={handleDownloadReceipt}
                                    title="Mevcut bilgilerle makbuz oluştur"
                                >
                                    <FiDownload /> Makbuz Al
                                </button>
                                {isAdmin && (
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDelete}
                                        disabled={deleting || saving}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                    >
                                        <FiTrash2 /> Sil
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
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
            </div>
        </div>
    );
}
