# Video Custom Domain Kurulumu

## 🎬 Video URL Yapısı

Video yüklendiğinde iki URL oluşturulur:
1. **Custom Domain URL**: `https://hisse.ankaraetkurban.com/api/video/{groupId}`
2. **Firebase Storage URL**: Direct Firebase Storage URL (backup)

Custom URL, Firebase Storage'a redirect eder.

---

## 🔥 Firebase Storage CORS Ayarı

Video dosyalarının web'den oynatılabilmesi için CORS ayarı gerekir:

### 1. Google Cloud Console → Activate Cloud Shell

### 2. `cors.json` dosyası oluştur:

```json
[
  {
    "origin": [
      "http://localhost:3000",
      "https://crm.ankaraetkurban.com",
      "https://hisse.ankaraetkurban.com"
    ],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
```

### 3. CORS ayarlarını uygula:

```bash
gsutil cors set cors.json gs://kurban-yonetim.appspot.com
```

---

## 🌐 Domain DNS Ayarları

### hisse.ankaraetkurban.com

**CNAME Record ekleyin:**
- Host: `hisse`
- Value: `cname.vercel-dns.com` (veya hosting sağlayıcınızın değeri)

**Vercel Dashboard:**
1. Project Settings → Domains
2. Add `hisse.ankaraetkurban.com`
3. Verify ve SSL bekleyin

---

## 📱 SMS Template

Video yüklendikten sonra SMS şablonu:

```
SAYIN {İSİM} KURBANINIZ KESILMISTIR. ALLAH KABUL ETSIN. 
KURBAN KESIM VIDEONUZU LINK UZERINDEN IZLEYEBILIRSINIZ. 
https://hisse.ankaraetkurban.com/api/video/{groupId}
```

---

## 🔧 Test

Video yüklendikten sonra:

```
https://hisse.ankaraetkurban.com/api/video/GROUP_ID_BURAYA
```

Bu URL Firebase Storage'a redirect edip videoyu göstermelidir.

---

## ⚠️ Notlar

- `hisse.ankaraetkurban.com` sertifikası aktif olduktan sonra URL'ler otomatik çalışacak
- Localhost'ta `http://localhost:3000/api/video/{groupId}` kullanılır
- Firebase Storage Rules: `allow read: if true;` olmalı
