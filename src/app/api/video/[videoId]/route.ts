// Video Redirect API Route
// /api/video/[videoId] → Firebase Storage URL'ine redirect eder
// hisse.ankaraetkurban.com/api/video/abc123 şeklinde kullanılır

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
    request: NextRequest,
    { params }: { params: { videoId: string } }
) {
    try {
        const { videoId } = params;

        console.log('🎬 Video redirect request:', videoId);

        // Firestore'dan grubu bul
        const groupDoc = await getDoc(doc(db, 'groups', videoId));

        if (!groupDoc.exists()) {
            console.error('❌ Group not found:', videoId);
            return NextResponse.json(
                { error: 'Video bulunamadı' },
                { status: 404 }
            );
        }

        const groupData = groupDoc.data();
        
        // Önce firebaseVideoUrl'i kontrol et, yoksa eski videoUrl'i kullan
        const videoUrl = groupData.firebaseVideoUrl || groupData.videoUrl;

        if (!videoUrl) {
            console.error('❌ Video URL not found for group:', videoId);
            return NextResponse.json(
                { error: 'Video henüz yüklenmemiş' },
                { status: 404 }
            );
        }

        console.log('✅ Redirecting to:', videoUrl);

        // Video URL'ine redirect et
        return NextResponse.redirect(videoUrl);
    } catch (error) {
        console.error('❌ Video redirect error:', error);
        return NextResponse.json(
            { error: 'Sunucu hatası' },
            { status: 500 }
        );
    }
}
