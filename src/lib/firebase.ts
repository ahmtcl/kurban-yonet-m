import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBNGwX9aOo3kW4VoW4bYj5E5aJ7_xWgL0Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kurban-yonetim.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kurban-yonetim",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kurban-yonetim.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abc123def456",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Domain ve Firestore logging
if (typeof window !== 'undefined') {
  console.log('🔥 Firebase initialized');
  console.log('🌐 Current domain:', window.location.hostname);
  console.log('📋 Project ID:', firebaseConfig.projectId);
  console.log('📦 Firestore ready:', db ? 'YES' : 'NO');
  console.log('⚠️ Note: Using Firestore ONLY (not Firebase Auth)');
  console.log('⚠️ Ensure Firestore Rules allow read/write from this domain');
}

export { app, db, auth, storage };
