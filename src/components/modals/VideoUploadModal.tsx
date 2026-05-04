'use client';
import { useState, useEffect } from 'react';
import { Group } from '@/types';
import { updateGroup } from '@/lib/firestore';
import { FiX, FiVideo, FiSend } from 'react-icons/fi';

interface Props {
    group: Group;
    onClose: () => void;
    onSuccess: () => void;
}

export default function VideoUploadModal({ group, onClose, onSuccess }: Props) {
    const [videoUrl, setVideoUrl] = useState(group.videoUrl || '');
    const [saving, setSaving] = useState(false);
    const [sendingSms, setSendingSms] = useState(false);

    const handleSave = async () => {
        if (!videoUrl.trim()) {
            alert('Lütfen video URL\'si giriniz.');
            return;
        }

        setSaving(true);
        try {
            await updateGroup(group.id, {
                videoUrl: videoUrl.trim(),
                videoSmsSent: false
            });
            alert('Video URL kaydedildi.');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Video URL kaydetme hatası:', error);
            alert('Video URL kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    const handleSendSms = async () => {
        if (!confirm(`${group.name} grubundaki tüm üyelere video SMS gönderilecek. Devam edilsin mi?`)) {
            return;
        }

        setSendingSms(true);
        try {
            // TODO: SMS gönderme API'si çağrılacak
            // Şimdilik sadece videoSmsSent durumunu güncelle
            await updateGroup(group.id, {
                videoSmsSent: true
            });
            alert('Video SMS gönderildi.');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Video SMS gönderme hatası:', error);
            alert('Video SMS gönderilemedi.');
        } finally {
            setSendingSms(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiVideo /> Video Yükleme - {group.name}
                    </h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Video URL</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="https://example.com/video.mp4"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            autoFocus
                        />
                        <small style={{ color: '#666', fontSize: 12 }}>
                            Video linkini buraya yapıştırın. Grup üyelerine SMS ile gönderilecek.
                        </small>
                    </div>

                    {group.videoUrl && (
                        <div style={{
                            padding: 12,
                            background: '#f0f9ff',
                            borderRadius: 6,
                            border: '1px solid #bae6fd',
                            marginTop: 15
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, color: '#0369a1' }}>
                                Mevcut Video
                            </div>
                            <div style={{ fontSize: 12, color: '#0c4a6e', wordBreak: 'break-all' }}>
                                {group.videoUrl}
                            </div>
                            <div style={{ fontSize: 11, color: '#0369a1', marginTop: 8 }}>
                                SMS Durumu: {group.videoSmsSent ? '✓ Gönderildi' : '⏳ Gönderilmedi'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    <div>
                        {videoUrl.trim() && group.videoUrl && !group.videoSmsSent && (
                            <button
                                className="btn btn-success"
                                onClick={handleSendSms}
                                disabled={sendingSms}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <FiSend /> {sendingSms ? 'Gönderiliyor...' : 'Video SMS Gönder'}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={onClose} disabled={saving || sendingSms}>
                            İptal
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving || sendingSms || !videoUrl.trim()}
                        >
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
