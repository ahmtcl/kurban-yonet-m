import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000:web:000",
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
