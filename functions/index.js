const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.videoRedirect = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    // URL'den videoId'yi çıkar: /api/video/abc123 -> abc123
    const pathParts = req.path.split('/');
    const videoId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID eksik' });
    }

    console.log('🎬 Video redirect:', videoId);

    // Firestore'dan grubu bul
    const groupDoc = await admin.firestore().collection('groups').doc(videoId).get();

    if (!groupDoc.exists) {
      console.error('❌ Group not found:', videoId);
      return res.status(404).json({ error: 'Video bulunamadı' });
    }

    const groupData = groupDoc.data();
    
    // Önce firebaseVideoUrl'i kontrol et, yoksa eski videoUrl'i kullan
    const videoUrl = groupData.firebaseVideoUrl || groupData.videoUrl;

    if (!videoUrl) {
      console.error('❌ Video URL not found for group:', videoId);
      return res.status(404).json({ error: 'Video henüz yüklenmemiş' });
    }

    console.log('✅ Redirecting to:', videoUrl);

    // Firebase Storage URL'ine redirect
    res.redirect(302, videoUrl);

  } catch (error) {
    console.error('❌ Video redirect error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});
