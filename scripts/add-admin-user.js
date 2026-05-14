// Admin user ekle - Firebase Client SDK ile
// Kullanım: node scripts/add-admin-user.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs } = require('firebase/firestore');

// Firebase config - environment variables veya default
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBNGwX9aOo3kW4VoW4bYj5E5aJ7_xWgL0Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kurban-yonetim.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kurban-yonetim",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kurban-yonetim.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abc123def456",
};

console.log('🔥 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addAdminUser() {
  try {
    console.log('📡 Checking existing admin user...');
    
    // Admin var mı kontrol et
    const q = query(collection(db, 'users'), where('username', '==', 'admin'));
    const existing = await getDocs(q);
    
    if (!existing.empty) {
      console.log('\n✅ Admin user zaten mevcut:');
      existing.forEach(doc => {
        const data = doc.data();
        console.log('   📋 ID:', doc.id);
        console.log('   👤 Username:', data.username);
        console.log('   🔑 Password:', data.password);
        console.log('   👑 Role:', data.role);
        console.log('   ✔️  Active:', data.isActive);
      });
      console.log('\n💡 Bu bilgilerle giriş yapabilirsiniz.');
      process.exit(0);
    }

    console.log('📝 Creating new admin user...');
    
    // Yeni admin user oluştur
    const adminUser = {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'users'), adminUser);
    
    console.log('\n✅ Admin user başarıyla oluşturuldu!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Document ID:', docRef.id);
    console.log('👤 Username:    admin');
    console.log('🔑 Password:    admin123');
    console.log('👑 Role:        admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 Artık giriş yapabilirsiniz!');
    console.log('⚠️  ÖNEMLİ: Production ortamında şifreyi değiştirin!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    console.error('\n🔍 Detaylar:', {
      code: error.code,
      message: error.message,
    });
    console.error('\n💡 Firestore Rules kontrol edin:');
    console.error('   Firebase Console → Firestore → Rules');
    console.error('   allow write: if true; olmalı (geçici)\n');
    process.exit(1);
  }
}

addAdminUser();
