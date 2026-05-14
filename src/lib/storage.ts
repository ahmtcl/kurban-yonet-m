import { ref, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Video dosyasını server-side API üzerinden yükler (CORS sorunu yok)
 * @param file Video dosyası
 * @param groupId Grup ID
 * @param onProgress Upload progress callback
 * @returns { firebaseUrl, customUrl }
 */
export async function uploadVideo(
    file: File,
    groupId: string,
    onProgress?: (progress: number) => void
): Promise<{ firebaseUrl: string; customUrl: string }> {
    console.log('🔧 uploadVideo (server-side) başladı', { fileSize: file.size, fileName: file.name });

    // Dosya boyut kontrolü (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
        throw new Error('Video dosyası çok büyük. Maksimum 100MB olmalıdır.');
    }

    // Dosya format kontrolü
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Desteklenmeyen video formatı. MP4, MOV, AVI veya WEBM formatında olmalıdır.');
    }

    // XMLHttpRequest ile progress takipli server-side upload
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('groupId', groupId);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                console.log('📊 Upload progress:', progress, '%');
                onProgress?.(progress);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const result = JSON.parse(xhr.responseText);
                console.log('✅ Upload tamamlandı:', result);
                resolve(result);
            } else {
                const err = JSON.parse(xhr.responseText);
                console.error('❌ Upload hatası:', err);
                reject(new Error(err.error || 'Video yüklenemedi'));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Ağ hatası. İnternet bağlantınızı kontrol edin.'));
        };

        xhr.open('POST', '/api/upload-video');
        xhr.send(formData);
    });
}

/**
 * Video dosyasını Firebase Storage'dan siler
 */
export async function deleteVideo(videoUrl: string): Promise<void> {
    try {
        const videoRef = ref(storage, videoUrl);
        await deleteObject(videoRef);
    } catch (error) {
        console.error('Delete video error:', error);
        throw new Error('Video silinemedi.');
    }
}
