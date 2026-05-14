// Admin user oluşturma scripti
// Kullanım: node scripts/create-admin.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs } = require('firebase/firestore');

// .env.local dosyasından oku
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createAdmin() {
  try {
    // Önce admin var mı kontrol et
    const q = query(collection(db, 'users'), where('username', '==', 'admin'));
    const existing = await getDocs(q);
    
    if (!existing.empty) {
      console.log('✅ Admin user zaten var:');
      existing.forEach(doc => {
        console.log('   ID:', doc.id);
        console.log('   Data:', doc.data());
      });
      return;
    }

    // Admin user oluştur
    const adminUser = {
      username: 'admin',
      password: 'admin123', // ÖNEMLİ: Production'da değiştirin!
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'users'), adminUser);
    
    console.log('✅ Admin user oluşturuldu!');
    console.log('   ID:', docRef.id);
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  ÖNEMLİ: Production ortamında şifreyi değiştirin!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

createAdmin();
