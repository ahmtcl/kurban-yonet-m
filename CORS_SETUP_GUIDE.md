# 🚀 KURBAN YÖNETİM - VİDEO SİSTEMİ AKTİVASYON

## ⚡ TEK ADIMDA CORS KURULUMU

### 1️⃣ Google Cloud Console Açın
👉 [console.cloud.google.com](https://console.cloud.google.com/storage/browser?project=kurban-yonetim)

### 2️⃣ Cloud Shell'i Açın (Sağ üstte terminal ikonu)

### 3️⃣ Bu komutu kopyalayıp Cloud Shell'e yapıştırın:

```bash
cat > cors.json << 'EOF'
[{"origin":["http://localhost:3000","https://crm.ankaraetkurban.com","https://hisse.ankaraetkurban.com"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length","Content-Range"],"maxAgeSeconds":3600}]
EOF
gsutil cors set cors.json gs://kurban-yonetim.appspot.com
echo "✅ CORS ayarları tamamlandı!"
```

**Enter'a basın** → Tamamdır!

---

## 🔒 Firebase Storage Rules (Opsiyonel)

**Firebase Console** → **Storage** → **Rules** sekmesi:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Kurban videoları - herkes okuyabilir
    match /kurban-videos/{videoFile} {
      allow read: if true;
      allow write: if request.auth != null; // Sadece login olmuş kullanıcılar
    }
    
    // Diğer dosyalar
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Publish** butonuna tıklayın.

---

## ✅ Kontrol

Cloud Shell'de:
```bash
gsutil cors get gs://kurban-yonetim.appspot.com
```

Çıktıda `hisse.ankaraetkurban.com` görünmeli.

---

## 🎬 Test

1. **https://crm.ankaraetkurban.com** → Login
2. **Gruplar** → Bir gruba video yükle
3. Video URL'i: `https://hisse.ankaraetkurban.com/api/video/{groupId}`
4. Bu URL'i tarayıcıda aç → Video oynatılmalı!

---

## 🆘 Sorun Çözümleri

### ❌ CORS hatası
- Cloud Shell komutunu tekrar çalıştırın
- Bucket adını kontrol edin: `kurban-yonetim.appspot.com`

### ❌ 403 Forbidden
- Firebase Storage Rules'ı kontrol edin
- `allow read: if true;` olmalı

### ❌ Redirect çalışmıyor
- Firestore'da grup videoUrl alanını kontrol edin
- API route çalışıyor mu: `/api/video/[videoId]`

---

**Sadece yukarıdaki tek komutu çalıştırın, sistem hazır! 🚀**
