'use client';
import { useState, useEffect, useRef } from 'react';
import { Group, Record } from '@/types';
import { updateGroup, getRecords } from '@/lib/firestore';
import { uploadVideo } from '@/lib/storage';
import { FiX, FiVideo, FiSend, FiUpload, FiCheck, FiCopy } from 'react-icons/fi';

interface Props {
    group: Group;
    onClose: () => void;
    onSuccess: () => void;
}

export default function VideoUploadModal({ group, onClose, onSuccess }: Props) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [videoMetadata, setVideoMetadata] = useState<{
        duration: number;
        size: string;
        name: string;
        timestamp: string;
    } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
    const [sendingSms, setSendingSms] = useState(false);
    const [members, setMembers] = useState<Record[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            const allRecords = await getRecords();
            const groupMembers = allRecords.filter(r => group.memberIds.includes(r.id));
            setMembers(groupMembers);
        } catch (error) {
            console.error('Üyeler yüklenemedi:', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Dosya boyut kontrolü (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
            alert('Video dosyası çok büyük. Maksimum 100MB olmalıdır.');
            return;
        }

        setSelectedFile(file);
        setUploadSuccess(false);

        // Video önizleme URL'i oluştur
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        // Metadata'yı çıkar (video element yüklendikinde)
        const tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';
        tempVideo.onloadedmetadata = () => {
            setVideoMetadata({
                duration: tempVideo.duration,
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                name: file.name,
                timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            });
            tempVideo.remove();
        };
        tempVideo.src = url;

        // Preview mode'a geç
        setPreviewMode(true);
    };

    const handleChangeVideo = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setVideoMetadata(null);
        setPreviewMode(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirmVideo = () => {
        setPreviewMode(false);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            alert('Lütfen bir video dosyası seçin.');
            return;
        }

        console.log('🎬 Video yükleme başlıyor...', {
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type
        });

        setUploading(true);
        setUploadProgress(0);

        try {
            console.log('📤 uploadVideo fonksiyonu çağrılıyor...');
            const downloadURL = await uploadVideo(
                selectedFile,
                group.id,
                (progress) => {
                    console.log('📊 Progress:', progress);
                    setUploadProgress(progress);
                }
            );

            console.log('✅ Video URL alındı:', downloadURL);

            // URL'i Firestore'a kaydet
            await updateGroup(group.id, {
                videoUrl: downloadURL,
                videoSmsSent: false
            });

            console.log('✅ Firestore güncellendi - videoUrl:', downloadURL, 'videoSmsSent:', false);

            setUploadSuccess(true);
            setUploadedVideoUrl(downloadURL);
            setSelectedFile(null);
            setPreviewUrl(null);
            
            // Grup bilgisini güncelle (parent'ı refresh et)
            console.log('📢 onSuccess çağrılıyor - gruplar yenilenecek');
            onSuccess();
            
            // Başarı mesajı göster
            alert('✅ Video başarıyla yüklendi! Şimdi grup üyelerine SMS gönderebilirsiniz.');
            
            // MODAL AÇIK KALSIN - SMS gönderilebilsin
        } catch (error: any) {
            console.error('❌ Video yükleme hatası:', error);
            console.error('Hata detayı:', error.code, error.message);
            alert(`Video yükleme hatası: ${error.message || error.code || 'Bilinmeyen hata'}`);
            setUploadProgress(0);
        } finally {
            setUploading(false);
        }
    };

    const handleSendSms = async () => {
        const videoUrl = uploadedVideoUrl || group.videoUrl;
        
        if (!videoUrl) {
            alert('Video yüklenmeden SMS gönderilemez!');
            return;
        }

        if (!confirm(`${group.name} grubundaki ${members.length} kişiye video SMS gönderilecek. Devam edilsin mi?`)) {
            return;
        }

        setSendingSms(true);
        try {
            // SMS gönderme API'si
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: members.map(m => ({
                        phone: m.phone,
                        name: m.ownerName,
                        videoUrl: videoUrl
                    })),
                    messageType: 'video',
                    groupName: group.name
                })
            });

            if (!response.ok) {
                throw new Error('SMS gönderilemedi');
            }

            // SMS gönderildi olarak işaretle
            await updateGroup(group.id, {
                videoSmsSent: true
            });

            console.log('✅ SMS durumu güncellendi - videoSmsSent:', true);
            console.log('📢 onSuccess çağrılıyor - gruplar yenilenecek');
            
            // Önce state'i güncelle
            onSuccess();
            
            // Sonra mesajı göster ve kapat
            alert(`✓ ${members.length} kişiye video SMS başarıyla gönderildi!`);
            onClose();
        } catch (error) {
            console.error('SMS gönderme hatası:', error);
            alert('Video SMS gönderilemedi. Lütfen tekrar deneyin.');
        } finally {
            setSendingSms(false);
        }
    };

    const copyVideoLink = () => {
        if (group.videoUrl) {
            navigator.clipboard.writeText(group.videoUrl);
            alert('Video linki kopyalandı!');
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 550 }}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiVideo /> Video Yükleme - {group.name}
                    </h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                <div className="modal-body">
                    {/* PREVIEW MODE - Büyük Video Önizleme */}
                    {previewMode && previewUrl && selectedFile ? (
                        <div style={{ padding: 0 }}>
                            {/* Büyük Video Player */}
                            <div style={{ marginBottom: 20 }}>
                                <video
                                    ref={videoRef}
                                    src={previewUrl}
                                    controls
                                    autoPlay
                                    style={{
                                        width: '100%',
                                        maxHeight: '60vh',
                                        borderRadius: 8,
                                        backgroundColor: '#000'
                                    }}
                                />
                            </div>

                            {/* Video Meta Bilgileri */}
                            <div style={{
                                padding: 16,
                                background: '#f0f9ff',
                                borderRadius: 8,
                                border: '1px solid #bae6fd',
                                marginBottom: 20
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    📹 Video Bilgileri
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>📄</span>
                                        <span style={{ fontWeight: 500, color: '#334155' }}>{videoMetadata?.name || selectedFile.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>📊</span>
                                        <span style={{ color: '#334155' }}>{videoMetadata?.size || (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB'}</span>
                                    </div>
                                    {videoMetadata?.duration && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>⏱️</span>
                                            <span style={{ color: '#334155' }}>
                                                {Math.floor(videoMetadata.duration / 60)}:{String(Math.floor(videoMetadata.duration % 60)).padStart(2, '0')} ({Math.floor(videoMetadata.duration)} saniye)
                                            </span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>📅</span>
                                        <span style={{ color: '#334155' }}>Seçim: {videoMetadata?.timestamp || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Aksiyon Butonları */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button
                                    className="btn btn-success"
                                    onClick={handleConfirmVideo}
                                    style={{
                                        width: '100%',
                                        minHeight: 48,
                                        fontSize: 15,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    <FiCheck size={20} /> Bu Videoyu Yükle
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={handleChangeVideo}
                                    style={{
                                        width: '100%',
                                        minHeight: 48,
                                        fontSize: 15,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        border: '2px solid #ef4444',
                                        color: '#ef4444'
                                    }}
                                >
                                    <FiX size={20} /> Başka Video Seç
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* NORMAL MODE - Mevcut Video Bilgisi */}
                    {group.videoUrl && (
                        <div style={{
                            padding: 12,
                            background: '#f0f9ff',
                            borderRadius: 6,
                            border: '1px solid #bae6fd',
                            marginBottom: 20
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#0369a1' }}>
                                📹 Mevcut Video
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: '#0c4a6e',
                                wordBreak: 'break-all',
                                background: '#fff',
                                padding: 8,
                                borderRadius: 4,
                                marginBottom: 8
                            }}>
                                {group.videoUrl}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button
                                    className="btn btn-xs btn-ghost"
                                    onClick={copyVideoLink}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                    <FiCopy size={12} /> Link Kopyala
                                </button>
                                <span style={{ fontSize: 11, color: '#0369a1' }}>
                                    SMS: {group.videoSmsSent ? '✓ Gönderildi' : '⏳ Gönderilmedi'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Dosya Seçimi */}
                    {!previewMode && !uploading && !uploadSuccess && (
                        <div className="form-group">
                            <label>Galeriden Video Seç</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => fileInputRef.current?.click()}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, fontSize: 15 }}
                            >
                                <FiVideo size={20} /> Galeri veya Kameradan Video Seç
                            </button>
                        </div>
                    )}

                    {/* Upload Progress */}
                    {uploading && (
                        <div style={{ marginTop: 15 }}>
                            <div style={{ marginBottom: 5, fontSize: 13, color: '#666' }}>
                                Yükleniyor... {uploadProgress}%
                            </div>
                            <div style={{
                                width: '100%',
                                height: 8,
                                background: '#e5e7eb',
                                borderRadius: 4,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${uploadProgress}%`,
                                    height: '100%',
                                    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                                    transition: 'width 0.3s'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Başarı Mesajı */}
                    {uploadSuccess && (
                        <div style={{
                            marginTop: 15,
                            padding: 12,
                            background: '#dcfce7',
                            border: '1px solid #86efac',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: '#15803d',
                            fontWeight: 600
                        }}>
                            <FiCheck size={18} /> Video başarıyla yüklendi!
                        </div>
                    )}

                    {/* SMS Bilgisi */}
                    {!previewMode && (
                        <div style={{
                            marginTop: 20,
                            padding: 12,
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: 6,
                            fontSize: 12,
                            color: '#92400e'
                        }}>
                            <strong>SMS İçeriği:</strong>
                            <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                                "SAYIN [AD SOYAD] KURBANINIZ KESİLMİŞTİR. ALLAH KABUL ETSİN. 
                                KURBAN KESİM VİDEONUZU LİNK ÜZERİNDEN İZLEYEBİLİRSİNİZ. [VİDEO LİNKİ]"
                            </div>
                        </div>
                    )}
                    </>
                    )}
                </div>

                {!previewMode && (
                <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedFile && !uploading && !uploadSuccess && (
                            <button
                                className="btn btn-success"
                                onClick={handleUpload}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <FiUpload /> Videoyu Yükle
                            </button>
                        )}
                        {(uploadSuccess || (group.videoUrl && !group.videoSmsSent)) && (
                            <button
                                className="btn"
                                onClick={handleSendSms}
                                disabled={sendingSms}
                                style={{
                                    background: '#059669',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <FiSend /> {sendingSms ? 'Gönderiliyor...' : `TÜM GRUBA SMS GÖNDER (${members.length})`}
                            </button>
                        )}
                    </div>
                    <button className="btn btn-ghost" onClick={onClose} disabled={uploading || sendingSms}>
                        Kapat
                    </button>
                </div>
                )}
            </div>
        </div>
    );
}
