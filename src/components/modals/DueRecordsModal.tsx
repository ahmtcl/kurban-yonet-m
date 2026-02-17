'use client';

import { useState } from 'react';
import { FiX, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import type { Record as RecordType } from '@/types';

interface DueRecordsModalProps {
    records: RecordType[];
    onClose: () => void;
    onSelectRecord: (record: RecordType) => void;
}

export default function DueRecordsModal({ records, onClose, onSelectRecord }: DueRecordsModalProps) {
    if (!records || records.length === 0) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiAlertTriangle /> Vadesi Gelen / Geçen Ödemeler
                    </h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><FiX /></button>
                </div>

                <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Sipariş No</th>
                                <th>Ad Soyad</th>
                                <th>Telefon</th>
                                <th>Kalan Tutar</th>
                                <th>Vade Tarihi</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r) => {
                                const remaining = (r.totalPrice || 0) - r.depositAmount;
                                const isPastDue = r.dueDate && new Date(r.dueDate) < new Date();

                                return (
                                    <tr key={r.id} style={{ backgroundColor: isPastDue ? '#fff5f5' : 'inherit' }}>
                                        <td style={{ fontWeight: 600, color: '#666' }}>#{r.orderNumber || '-'}</td>
                                        <td style={{ fontWeight: 500 }}>{r.ownerName}</td>
                                        <td>{r.phone}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--accent-danger)' }}>
                                            {remaining.toLocaleString('tr-TR')} ₺
                                        </td>
                                        <td style={{ color: isPastDue ? 'red' : 'inherit', fontWeight: isPastDue ? 'bold' : 'normal' }}>
                                            {r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '-'}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-ghost"
                                                onClick={() => onSelectRecord(r)}
                                                style={{ color: 'var(--accent-primary)' }}
                                            >
                                                Detay <FiArrowRight />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
                </div>
            </div>
        </div>
    );
}
