import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Video dosyasını Firebase Storage'a yükler
 * @param file Video dosyası
 * @param groupId Grup ID (dosya yolu için)
 * @param onProgress Upload progress callback
 * @returns Download URL
 */
export async function uploadVideo(
    file: File,
    groupId: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    console.log('🔧 uploadVideo başladı', { fileSize: file.size, fileName: file.name });

    // Dosya boyut kontrolü (max 100MB)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
        throw new Error('Video dosyası çok büyük. Maksimum 100MB olmalıdır.');
    }

    // Dosya format kontrolü
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Desteklenmeyen video formatı. MP4, MOV, AVI veya WEBM formatında olmalıdır.');
    }

    // Unique dosya adı oluştur
    const timestamp = Date.now();
    const fileName = `${groupId}_${timestamp}.${file.name.split('.').pop()}`;
    console.log('📁 Storage path:', `kurban-videos/${fileName}`);
    
    try {
        const storageRef = ref(storage, `kurban-videos/${fileName}`);
        console.log('📦 Storage ref oluşturuldu');

        // Upload başlat
        const uploadTask = uploadBytesResumable(storageRef, file);
        console.log('🚀 Upload task başlatıldı');

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('📊 Progress update:', Math.round(progress), '%');
                    if (onProgress) {
                        onProgress(Math.round(progress));
                    }
                },
                (error) => {
                    console.error('❌ Upload error:', error);
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    
                    // Firebase Storage hata kodları
                    if (error.code === 'storage/unauthorized') {
                        reject(new Error('Yetki hatası. Firebase Storage rules kontrol edilmeli.'));
                    } else if (error.code === 'storage/canceled') {
                        reject(new Error('Yükleme iptal edildi.'));
                    } else if (error.code === 'storage/unknown') {
                        reject(new Error('Bilinmeyen hata. Lütfen internet bağlantınızı kontrol edin.'));
                    } else {
                        reject(new Error(`Video yüklenemedi: ${error.message}`));
                    }
                },
                async () => {
                    try {
                        console.log('✅ Upload tamamlandı, URL alınıyor...');
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('✅ Download URL alındı:', downloadURL);
                        resolve(downloadURL);
                    } catch (error) {
                        console.error('❌ Download URL alma hatası:', error);
                        reject(new Error('Video URL alınamadı.'));
                    }
                }
            );
        });
    } catch (error: any) {
        console.error('❌ Storage ref oluşturma hatası:', error);
        throw new Error(`Storage hatası: ${error.message}`);
    }
}

/**
 * Video dosyasını Firebase Storage'dan siler
 * @param videoUrl Video URL
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
