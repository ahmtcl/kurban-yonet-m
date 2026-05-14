import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Video dosyasını Firebase Storage'a yükler
 */
export async function uploadVideo(
    file: File,
    groupId: string,
    onProgress?: (progress: number) => void
): Promise<{ firebaseUrl: string; customUrl: string }> {
    console.log('🔧 uploadVideo başladı', { fileSize: file.size, fileName: file.name });

    if (file.size > 100 * 1024 * 1024) {
        throw new Error('Video dosyası çok büyük. Maksimum 100MB olmalıdır.');
    }

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Desteklenmeyen video formatı. MP4, MOV, AVI veya WEBM formatında olmalıdır.');
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const fileName = `kurban-videos/${groupId}_${timestamp}.${ext}`;

    const storageRef = ref(storage, fileName);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                console.log('📊 Progress:', progress, '%');
                onProgress?.(progress);
            },
            (error) => {
                console.error('❌ Upload error:', error.code, error.message);
                reject(new Error(`Video yüklenemedi: ${error.message}`));
            },
            async () => {
                const firebaseUrl = await getDownloadURL(uploadTask.snapshot.ref);
                const customUrl = `https://hisse.ankaraetkurban.com/api/video/${groupId}`;
                console.log('✅ Upload tamamlandı:', { firebaseUrl, customUrl });
                resolve({ firebaseUrl, customUrl });
            }
        );
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
