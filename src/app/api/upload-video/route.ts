import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Firebase Admin SDK init (server-side)
function getAdminApp() {
    if (getApps().length > 0) return getApps()[0];

    return initializeApp({
        credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('video') as File;
        const groupId = formData.get('groupId') as string;

        if (!file || !groupId) {
            return NextResponse.json({ error: 'Video veya groupId eksik' }, { status: 400 });
        }

        // Dosya boyut kontrolü (100MB)
        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json({ error: 'Video 100MB den büyük olamaz' }, { status: 400 });
        }

        // Dosya format kontrolü
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Desteklenmeyen video formatı' }, { status: 400 });
        }

        console.log('📤 Server-side video upload başlıyor:', { groupId, fileName: file.name, size: file.size });

        const adminApp = getAdminApp();
        const bucket = getStorage(adminApp).bucket();

        // Unique dosya adı
        const timestamp = Date.now();
        const ext = file.name.split('.').pop();
        const fileName = `kurban-videos/${groupId}_${timestamp}.${ext}`;

        // File → Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Firebase Storage'a yükle
        const fileRef = bucket.file(fileName);
        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        // Public download URL oluştur
        await fileRef.makePublic();
        const firebaseUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // Custom domain URL
        const customUrl = `https://hisse.ankaraetkurban.com/api/video/${groupId}`;

        console.log('✅ Video yüklendi:', { firebaseUrl, customUrl });

        return NextResponse.json({ firebaseUrl, customUrl });
    } catch (error: any) {
        console.error('❌ Video upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Video yüklenemedi' },
            { status: 500 }
        );
    }
}

// Max 200MB request body
export const config = {
    api: {
        bodyParser: false,
    },
};
