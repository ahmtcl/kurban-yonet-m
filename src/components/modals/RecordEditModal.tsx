'use client';

import { useState, useEffect } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import { updateRecord } from '@/lib/firestore';
import type { Record as RecordType, PaymentType } from '@/types';

interface RecordEditModalProps {
    record: RecordType | null;
    onClose: () => void;
    onSave: () => void;
}

export default function RecordEditModal({ record, onClose, onSave }: RecordEditModalProps) {
    const [editRecord, setEditRecord] = useState<RecordType | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setEditRecord(record);
    }, [record]);

    if (!editRecord || !record) return null;

    async function handleUpdateRecord() {
        if (!editRecord) return;
        setSaving(true);
        try {
            await updateRecord(editRecord.id, {
                ownerName: editRecord.ownerName,
                phone: editRecord.phone,
                phoneBackup: editRecord.phoneBackup,
                depositAmount: editRecord.depositAmount,
                paymentType: editRecord.paymentType,
                notes: editRecord.notes,
                dueDate: editRecord.dueDate,
                daySelection: editRecord.daySelection,
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

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Kayıt Düzenle</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><FiX /></button>
                </div>

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
                            <option value="havale">Havale / EFT</option>
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

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>İptal</button>
                    <button className="btn btn-primary" onClick={handleUpdateRecord} disabled={saving}>
                        <FiCheck /> {saving ? 'Kaydediliyor...' : 'Güncelle'}
                    </button>
                </div>
            </div>
        </div>
    );
}
