#!/bin/bash
# Firebase Storage CORS Kurulum Scripti
# Google Cloud Shell'de çalıştırın

echo "🔥 Firebase Storage CORS kurulumu başlıyor..."
echo ""

# CORS dosyası oluştur
cat > cors.json << 'EOF'
[
  {
    "origin": [
      "http://localhost:3000",
      "https://crm.ankaraetkurban.com",
      "https://hisse.ankaraetkurban.com"
    ],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
EOF

echo "✅ cors.json dosyası oluşturuldu"
echo ""

# CORS'u Firebase Storage'a uygula
echo "📤 CORS ayarları Firebase Storage'a uygulanıyor..."
gsutil cors set cors.json gs://kurban-yonetim.appspot.com

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CORS ayarları başarıyla uygulandı!"
    echo ""
    echo "📋 Ayarları kontrol etmek için:"
    echo "gsutil cors get gs://kurban-yonetim.appspot.com"
else
    echo ""
    echo "❌ Hata oluştu!"
    echo "💡 Projenizin seçili olduğundan emin olun:"
    echo "gcloud config set project kurban-yonetim"
fi
