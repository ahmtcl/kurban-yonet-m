## 🎬 VİDEO SİSTEMİ - HIZLI BAŞLANGIÇ

Video sistemi hazır! Sadece **1 adım** kaldı:

---

### ⚡ YAPILACAK TEK ŞEY: CORS KURULUMU (30 saniye)

1. **Google Cloud Console'a girin**: https://console.cloud.google.com
2. Sağ üstte **Cloud Shell** ikonuna tıklayın (terminal simgesi)
3. Şu komutu kopyala-yapıştır + Enter:

```bash
cat > cors.json << 'EOF'
[{"origin":["http://localhost:3000","https://crm.ankaraetkurban.com","https://hisse.ankaraetkurban.com"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length","Content-Range"],"maxAgeSeconds":3600}]
EOF
gsutil cors set cors.json gs://kurban-yonetim.appspot.com
```

✅ "Setting CORS..." mesajı görünce tamamdır!

---

### 🧪 TEST

1. https://crm.ankaraetkurban.com → Login
2. **Gruplar** → Video yükle
3. Aldığınız link: `https://hisse.ankaraetkurban.com/api/video/{id}`
4. Link'i tarayıcıda aç → Video oynatılmalı!

---

### 📋 Hazır Dosyalar:

- ✅ `cors.json` - CORS ayar dosyası
- ✅ `storage.rules` - Firebase Storage kuralları
- ✅ `setup-cors.sh` - Otomatik kurulum scripti
- ✅ `/api/video/[videoId]` - Redirect API route

**Sistem hazır, sadece CORS komutunu çalıştırın!** 🚀
