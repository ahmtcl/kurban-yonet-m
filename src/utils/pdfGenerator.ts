import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Record, Settings, Group, ShareType, VekaletSession } from '@/types';

// Ozet: Roboto-Regular base64 font data for Turkish support
// We use a simplified base64 string for Roboto-Regular that supports Turkish.
// In a real production app, this string is very long. 
// For this environment, I will use a known trick: using the standard font but mapping chars manually OR
// since I cannot paste a 500kb string here, I will use "courier" or "times" which sometimes handles it better,
// OR I will attempt to add the font via a CDN link in the HTML (but jsPDF runs client side).
// BEST APPROACH FOR THIS CHATBOT CONTEXT:
// Use "latin-ext" validation. Actually jsPDF default font (helvetica) DOES NOT support Utf-8 well without custom font.
// I will try to use a "Times" font which often has better support, or I will replace Turkish chars with their excessive counterparts
// simply because providing a 1MB base64 string in a tool call is bad practice and might fail.
// WAIT: The user specifically wants Turkish chars. 
// I will try to map them to nearest visual if base64 is too heavy, BUT
// I will try to load a font from a URL array buffer if possible.

const robotoRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
const robotoBoldUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf'; // Medium works well for Bold

export const generateReceipt = async (record: Record, settings: Settings | null) => {
    const doc = new jsPDF();

    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const base64data = btoa(
                new Uint8Array(arrayBuffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            doc.addFileToVFS(`${name}-${style}.ttf`, base64data);
            doc.addFont(`${name}-${style}.ttf`, name, style);
            return true;
        } catch (e) {
            console.error(`Font load failed: ${name} ${style}`, e);
            return false;
        }
    };

    // Load fonts
    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl, 'Roboto', 'bold')
    ]);

    // Apply font
    if (doc.getFontList().hasOwnProperty('Roboto')) {
        doc.setFont('Roboto', 'normal');
    }

    await createPdfContent(doc, record, settings);
};

const createPdfContent = async (doc: jsPDF, record: Record, settings: Settings | null) => {
    const fontToUse = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';
    doc.setFont(fontToUse, 'normal');

    // Logo or Company Title
    let logoHeight = 0;
    try {
        const logoResponse = await fetch('/yenılogo.png');
        if (logoResponse.ok) {
            const blob = await logoResponse.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });

            // Get image dimensions to maintain aspect ratio
            const img = await new Promise<HTMLImageElement>((resolve) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.src = base64;
            });

            const targetWidth = 70; // mm (increased from 50)
            const ratio = img.height / img.width;
            logoHeight = targetWidth * ratio;

            // Limit height if it's too tall
            if (logoHeight > 45) {
                const scale = 45 / logoHeight;
                logoHeight = 45;
                const newWidth = targetWidth * scale;
                doc.addImage(base64, 'PNG', 105 - (newWidth / 2), 10, newWidth, logoHeight);
            } else {
                doc.addImage(base64, 'PNG', 105 - (targetWidth / 2), 10, targetWidth, logoHeight);
            }
        } else {
            throw new Error('Logo not found');
        }
    } catch (e) {
        doc.setFont(fontToUse, 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0);
        const title = settings?.companyTitle || 'KURBAN HİSSE YÖNETİM';
        doc.text(title, 105, 25, { align: 'center' });
        logoHeight = 15; // fallback height for text
    }

    doc.setFontSize(14);
    doc.setTextColor(0);
    const isZeroDeposit = (record.depositAmount || 0) === 0;
    // Positioned dynamically below logo
    doc.text(isZeroDeposit ? 'Kurban Hissesi Sipariş Makbuzu' : 'Kurban Hissesi Ödeme Makbuzu', 105, 15 + logoHeight + 10, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setTextColor(0); // Black
    const dateStr = new Date().toLocaleDateString('tr-TR');
    doc.text(`Tarih: ${dateStr}`, 190, 68, { align: 'right' });

    // Order Number (New)
    if (record.orderNumber) {
        doc.setFontSize(10);
        doc.setTextColor(0); // Black
        doc.text(`Sipariş No: #${record.orderNumber}`, 190, 74, { align: 'right' });
    }

    // Customer Info
    doc.setFont(fontToUse, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Müşteri Bilgileri:', 14, 85);

    doc.setFont(fontToUse, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0); // Black
    doc.text(`Ad Soyad: ${record.ownerName}`, 14, 93);
    doc.text(`Telefon: ${record.phone}`, 14, 99);

    // Share Info
    doc.setFont(fontToUse, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Hisse Bilgileri:', 14, 110);

    doc.setFont(fontToUse, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0); // Black
    doc.text(`Hisse Tipi: ${record.shareTypeName}`, 14, 118);

    // Financial Table
    const tableData = [
        ['Açıklama', 'Tutar'],
        ['Toplam Hisse Bedeli', `${record.totalPrice.toLocaleString('tr-TR')} ₺`],
        [isZeroDeposit ? 'Kapora Bekleniyor' : 'Alınan Kapora', `${record.depositAmount.toLocaleString('tr-TR')} ₺`],
        ...(isZeroDeposit ? [] : [['Ödeme Yöntemi', record.paymentType.toUpperCase()]]),
        ['Kalan Tutar', `${(record.totalPrice - record.depositAmount).toLocaleString('tr-TR')} ₺`],
        ['Teslim Günü', `${record.daySelection || 1}. Gün`]
    ];

    autoTable(doc, {
        startY: 125,
        head: [['Detay', 'Bilgi']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: {
            font: fontToUse,
            textColor: [0, 0, 0],
            overflow: 'linebreak'
        },
        margin: { top: 100 },
    });

    // Footer / Delivery Info
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont(fontToUse, 'bold');
    doc.setTextColor(0);

    let deliveryMsg = '';
    const day = record.daySelection || 1;
    if (day === 1) {
        deliveryMsg = "KURBANINIZI KURBAN BAYRAMININ 1. GÜNÜ OLAN 27.05.2026 TARİHİNDE SAAT 18:00 İLE 23:00 ARASINDA İSTANBUL YOLU MAĞAZAMIZDAN TESLİM ALABİLİRSİNİZ.";
    } else if (day === 2) {
        deliveryMsg = "KURBANINIZI KURBAN BAYRAMININ 2. GÜNÜ OLAN 28.05.2026 TARİHİNDE SAAT 08:00 İLE 18:00 ARASINDA İSTANBUL YOLU MAĞAZAMIZDAN TESLİM ALABİLİRSİNİZ.";
    } else if (day === 3) {
        deliveryMsg = "KURBANINIZI KURBAN BAYRAMININ 3. GÜNÜ OLAN 29.05.2026 TARİHİNDE SAAT 08:00 İLE 18:00 ARASINDA İSTANBUL YOLU MAĞAZAMIZDAN TESLİM ALABİLİRSİNİZ.";
    }

    if (deliveryMsg) {
        const splitMsg = doc.splitTextToSize(deliveryMsg, 180);
        doc.text(splitMsg, 105, finalY, { align: 'center' });
    }

    doc.setFont(fontToUse, 'normal');
    doc.setFontSize(9);
    doc.text('Bu makbuz elektronik ortamda düzenlenmiştir.', 105, finalY + (deliveryMsg ? 18 : 5), { align: 'center' });

    doc.save(`Makbuz_${record.orderNumber || record.ownerName.replace(/\s+/g, '_')}.pdf`);
}

// ===== KESİM LİSTESİ PDF =====
export const generateKesimListesiPDF = async (
    type: 'kucukbas' | 'buyukbas',
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    kucukbasShareTypeId: string,
) => {
    // BÜYÜKBAŞ: A5 Yatay (3 sütun yan yana)
    // KÜÇÜKBAŞ: A5 Dikey (tek kayıt/sayfa)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
    });

    // Font loader
    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            doc.addFileToVFS(`${name}-${style}.ttf`, b64);
            doc.addFont(`${name}-${style}.ttf`, name, style);
            return true;
        } catch { return false; }
    };

    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl, 'Roboto', 'bold'),
    ]);

    const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';

    // Logo
    let logoBase64: string | null = null;
    let logoRatio = 0.4;
    try {
        const res = await fetch('/yenılogo.png');
        if (res.ok) {
            const blob = await res.blob();
            logoBase64 = await new Promise<string>(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            const img = await new Promise<HTMLImageElement>(resolve => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.src = logoBase64!;
            });
            logoRatio = img.height / img.width;
        }
    } catch { /* logo yüklenemedi, devam et */ }

    const companyName = settings?.companyName || '';
    const year = new Date().getFullYear();

    // ---- KÜÇÜKBAŞ ----
    if (type === 'kucukbas') {
        const W = 148; // A5 genişlik
        const H = 210; // A5 yükseklik
        const margin = 8; // Margin azaltıldı (10 → 8mm)

        const recs = allRecords
            .filter(r =>
                r.shareTypeId === kucukbasShareTypeId &&
                r.daySelection === day &&
                r.status !== 'cancelled' &&
                r.status !== 'pending_cancellation',
            )
            .sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0));

        if (recs.length === 0) {
            alert(`Seçilen güne ait küçükbaş kaydı bulunamadı.`);
            return;
        }

        recs.forEach((record, idx) => {
            if (idx > 0) doc.addPage([W, H], 'portrait');

            let y = margin + 5;

            // Logo ortalı (maksimum büyüklük - yeni siyah logo)
            if (logoBase64) {
                const lw = 60; // Logo genişliği maksimum (35 → 60mm)
                const lh = Math.min(lw * logoRatio, 50); // Max yükseklik (30 → 50mm)
                doc.addImage(logoBase64, 'PNG', (W - lw) / 2, y, lw, lh);
                y += lh + 10;
            } else {
                y += 10;
            }

            // 2026 KURBAN BAYRAMI (büyük, altında çizgi)
            doc.setFont(font, 'bold');
            doc.setFontSize(18); // Font artırıldı (14 → 18pt)
            doc.setTextColor(0, 0, 0);
            doc.text(`${year} KURBAN BAYRAMI`, W / 2, y, { align: 'center' });
            y += 8;

            // Altına yatay çizgi
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(margin + 5, y, W - margin - 5, y);
            y += 12;

            // KÜÇÜKBAŞ KURBAN (büyük)
            doc.setFont(font, 'bold');
            doc.setFontSize(20); // Font artırıldı (14 → 20pt)
            doc.setTextColor(0, 0, 0);
            doc.text('KÜÇÜKBAŞ KURBAN', W / 2, y, { align: 'center' });
            y += 10;

            // İndirimli hisse tipi etiketi (hisse adı % ile başlıyorsa)
            const selectedShareType = shareTypes.find(st => st.id === kucukbasShareTypeId);
            if (selectedShareType?.name?.startsWith('%')) {
                doc.setFont(font, 'bold');
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0);
                doc.text(selectedShareType.name.toUpperCase(), W / 2, y, { align: 'center' });
                y += 10;
            } else {
                y += 20;
            }

            // Büyük numara (maksimum boyut)
            doc.setFont(font, 'bold');
            doc.setFontSize(120); // Font artırıldı (70 → 120pt)
            doc.setTextColor(0, 0, 0);
            doc.text(String(idx + 1), W / 2, y + 40, { align: 'center' });
            y += 70;

            // İsim (maksimum büyüklük, bold)
            doc.setFont(font, 'bold');
            doc.setFontSize(22); // Font artırıldı (16 → 22pt)
            doc.setTextColor(0, 0, 0);
            const nameLines = doc.splitTextToSize(record.ownerName.toUpperCase(), W - margin * 2);
            doc.text(nameLines, W / 2, y, { align: 'center' });
        });

    // ---- BÜYÜKBAŞ ----
    } else {
        const W = 148; // A5 portrait genişlik
        const H = 210; // A5 portrait yükseklik
        const margin = 8;
        const innerW = W - margin * 2; // 132mm kullanılabilir genişlik

        const nonKucukbasIds = shareTypes
            .filter(st => st.id !== kucukbasShareTypeId)
            .map(st => st.id);

        const filteredGroups = groups
            .filter(g => {
                if (!nonKucukbasIds.includes(g.shareTypeId)) return false;
                if (g.memberIds.length === 0) return false;
                const firstMember = allRecords.find(r => r.id === g.memberIds[0]);
                return firstMember?.daySelection === day;
            })
            .sort((a, b) => (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999));

        if (filteredGroups.length === 0) {
            alert(`Seçilen güne ait büyükbaş grubu bulunamadı.`);
            return;
        }

        // Her grup ayrı sayfada - A5'i tamamen doldur
        filteredGroups.forEach((group, idx) => {
            if (idx > 0) doc.addPage([W, H], 'portrait');

            const shareType = shareTypes.find(st => st.id === group.shareTypeId);
            const shareTypeName = shareType?.name || group.shareTypeName || '';

            const members = group.memberIds
                .map(mid => allRecords.find(r => r.id === mid))
                .filter(Boolean) as Record[];

            let y = margin;

            // ─── Logo (genişliğe göre orantılı, max yükseklik 50mm) ───
            if (logoBase64) {
                const lw = innerW; // Tam genişliği kullan (132mm)
                const lh = Math.min(lw * logoRatio, 50); // Max 50mm yükseklik
                const actualLw = lh < lw * logoRatio ? lh / logoRatio : lw;
                doc.addImage(logoBase64, 'PNG', (W - actualLw) / 2, y, actualLw, lh);
                y += lh + 4;
            } else {
                y += 4;
            }

            // ─── Başlıklar ───
            doc.setFont(font, 'bold');
            doc.setFontSize(15);
            doc.setTextColor(0, 0, 0);
            doc.text(`${year} KURBAN BAYRAMI`, W / 2, y, { align: 'center' });
            y += 7;

            doc.setFont(font, 'bold');
            doc.setFontSize(15);
            doc.text(shareTypeName.toUpperCase(), W / 2, y, { align: 'center' });
            y += 6;

            // ─── Yatay çizgi ───
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(1);
            doc.line(margin, y, W - margin, y);
            y += 5;

            // ─── KESİM SIRASI + Numara kutusu ───
            const headerH = 18;
            const leftCellW = innerW * 0.58;
            const rightCellW = innerW * 0.42;

            // Sol hücre — "KESİM SIRASI"
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.8);
            doc.rect(margin, y, leftCellW, headerH);
            doc.setFont(font, 'bold');
            doc.setFontSize(13);
            doc.setTextColor(0, 0, 0);
            doc.text('KESİM SIRASI', margin + leftCellW / 2, y + headerH * 0.63, { align: 'center' });

            // Sağ hücre — Numara
            doc.rect(margin + leftCellW, y, rightCellW, headerH);
            doc.setFont(font, 'bold');
            doc.setFontSize(26);
            doc.text(String(group.kesimSiraNo ?? '-'), margin + leftCellW + rightCellW / 2, y + headerH * 0.7, { align: 'center' });
            y += headerH;

            // ─── Üye listesi — kalan alanı 7 eşit satıra böl ───
            const bottomMargin = margin;
            const remainingH = H - bottomMargin - y;
            const rowH = remainingH / 7; // tam doldur
            const numW = 14;

            for (let i = 0; i < 7; i++) {
                const member = members[i];
                const rowY = y + i * rowH;

                // Satır kenarlıkları
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.5);
                doc.rect(margin, rowY, innerW, rowH);

                // Numara ayırıcı dikey çizgi
                doc.line(margin + numW, rowY, margin + numW, rowY + rowH);

                // Sıra numarası
                doc.setFont(font, 'bold');
                doc.setFontSize(13);
                doc.setTextColor(0, 0, 0);
                doc.text(String(i + 1), margin + numW / 2, rowY + rowH * 0.63, { align: 'center' });

                // İsim
                if (member) {
                    doc.setFont(font, 'bold');
                    doc.setFontSize(13);
                    doc.setTextColor(0, 0, 0);
                    const nameText = doc.splitTextToSize(
                        member.ownerName.toUpperCase(),
                        innerW - numW - 5
                    )[0];
                    doc.text(nameText, margin + numW + 4, rowY + rowH * 0.63);
                }
            }
        });
    }

    const dayStr = `gun${day}`;
    doc.save(`kesim-listesi-${type}-${dayStr}.pdf`);
};

// ===== ETİKET PDF (10×10 cm, termal yazıcı) =====
export const generateEtiketPDF = async (
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    singleGroupId?: string, // tanımlıysa sadece o grup basılır
) => {
    // 10×10 cm = 100×100 mm (her etiket boyutu)
    const W = 100;
    const H = 100;

    // Her etiket kendi sayfasında (100×100 mm)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [W, H],
    });

    // Font yükle
    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            doc.addFileToVFS(`${name}-${style}.ttf`, b64);
            doc.addFont(`${name}-${style}.ttf`, name, style);
            return true;
        } catch { return false; }
    };

    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl,    'Roboto', 'bold'),
    ]);

    const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';

    // Hangi gruplar basılacak
    const targetGroups = groups
        .filter(g => {
            if (singleGroupId) return g.id === singleGroupId;
            if (g.memberIds.length === 0) return false;
            const first = allRecords.find(r => r.id === g.memberIds[0]);
            return first?.daySelection === day;
        })
        .sort((a, b) => (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999));

    if (targetGroups.length === 0) {
        alert('Seçilen güne ait grup bulunamadı.');
        return;
    }

    const dayLabel = (d: number) => {
        if (d === 1) return settings?.day1Label || '1. GÜN';
        if (d === 2) return settings?.day2Label || '2. GÜN';
        return '3. GÜN';
    };

    // İlk sayfayı kaldır (döngü içinde eklenecek)
    doc.deletePage(1);

    // forEach yerine for...of kullan (async/await için)
    for (let idx = 0; idx < targetGroups.length; idx++) {
        const group = targetGroups[idx];

        // HER GRUP İÇİN 14 KOPYA OLUŞTUR (7 koli × 2 yüz = 14 etiket)
        for (let copyIndex = 0; copyIndex < 14; copyIndex++) {
            // Her etiket için yeni sayfa ekle (100×100 mm)
            doc.addPage([W, H], 'portrait');
            
            // Renk ve çizgi ayarlarını sıfırla (her etiket için tutarlı olması için)
            doc.setDrawColor(0, 0, 0);
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(255, 255, 255);

        const shareType  = shareTypes.find(st => st.id === group.shareTypeId);
        const stName     = shareType?.name || group.shareTypeName || '';
        const members    = group.memberIds
            .map(mid => allRecords.find(r => r.id === mid))
            .filter((r): r is Record => !!r);

        // Grubun kesim günü ilk üyeden alınır
        const groupDay   = members[0]?.daySelection ?? day;

        const margin     = 3;
        const innerW     = W - margin * 2;

        // ── Dış kenarlık ──
        doc.setDrawColor(0, 0, 0); // Siyah çizgi
        doc.setLineWidth(0.8);
        doc.rect(margin, margin, innerW, H - margin * 2);

        // ── ÜST BÖLÜM: Hisse adı + Kesim sıra no kutusu ──
        const topH = 22;
        doc.setDrawColor(0, 0, 0); // Siyah çizgi
        doc.setLineWidth(0.5);
        doc.line(margin, margin + topH, margin + innerW, margin + topH);

        // Kesim sıra no kutusu (sağ) — önce çiz, sol sınırı belli olsun
        const boxW = 22;
        const boxH = topH - 4;
        const boxX = margin + innerW - boxW - 2;
        const boxY = margin + 2;
        doc.setDrawColor(0, 0, 0); // Siyah çerçeve
        doc.setLineWidth(1.2);
        doc.rect(boxX, boxY, boxW, boxH);
        doc.setFont(font, 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0); // Siyah renk garanti et
        const siraStr = String(group.kesimSiraNo ?? '-');
        doc.text(siraStr, boxX + boxW / 2, boxY + boxH * 0.68, { align: 'center' });

        // Hisse adı (sol) — kutuyla çakışmamak için maxWidth ile sınırla, auto font sizing
        const maxNameW = boxX - margin - 5; // kutu soluna kadar
        let nameFontSize = 16;
        doc.setFont(font, 'bold');
        doc.setFontSize(nameFontSize);
        // Yazı sığmıyorsa font küçült
        while (nameFontSize > 8 && doc.getTextWidth(stName) > maxNameW) {
            nameFontSize -= 1;
            doc.setFontSize(nameFontSize);
        }
        doc.setTextColor(0, 0, 0); // Siyah renk
        doc.text(stName, margin + 3, margin + topH / 2 + nameFontSize * 0.18, { maxWidth: maxNameW });

        // ── ORTA: Gün + "HİSSE ORTAKLARI" ──
        let y = margin + topH + 5;
        doc.setFont(font, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0); // Siyah renk
        doc.text(`${dayLabel(groupDay)} TESLİM`, W / 2, y, { align: 'center' });
        y += 4.5;
        doc.setFontSize(8);
        doc.text('HİSSE ORTAKLARI', W / 2, y, { align: 'center' });
        y += 4;

        // ── ÜYELER TABLOSU ──
        const rowH    = 7.5;
        const noColW  = 8;
        const qrSize  = 26; // QR kodu KARE formatında (26×26 mm)
        const qrColW  = qrSize;
        const nameColW = innerW - noColW - qrColW - 3; // İsim sütunu daraltıldı
        const tableW  = noColW + nameColW;
        const tableX  = margin + 1;

        // Tablo dış çerçevesi
        doc.setDrawColor(0, 0, 0); // Siyah çerçeve
        doc.setLineWidth(0.4);
        doc.rect(tableX, y, tableW, rowH * 7);

        for (let i = 0; i < 7; i++) {
            const member  = members[i] ?? null;
            const rowY    = y + i * rowH;

            // Satır alt çizgisi (son satır hariç)
            if (i < 6) {
                doc.setDrawColor(0, 0, 0); // Siyah çizgi
                doc.setLineWidth(0.2);
                doc.line(tableX, rowY + rowH, tableX + tableW, rowY + rowH);
            }

            // Sıra no dikey ayırıcı
            doc.setDrawColor(0, 0, 0); // Siyah çizgi
            doc.setLineWidth(0.3);
            doc.line(tableX + noColW, rowY, tableX + noColW, rowY + rowH);

            // Sıra no
            doc.setFont(font, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(String(i + 1), tableX + noColW / 2, rowY + rowH * 0.68, { align: 'center' });

            // İsim
            if (member) {
                doc.setFont(font, 'normal');
                doc.setFontSize(7.5); // Font biraz küçültüldü (8.5 → 7.5)
                doc.setTextColor(0, 0, 0); // Siyah renk
                const nameText = doc.splitTextToSize(member.ownerName, nameColW - 3);
                doc.text(nameText[0], tableX + noColW + 2, rowY + rowH * 0.68);
            }
        }

        // ── QR KOD (sağ alt) ──
        const qrX = margin + innerW - qrSize - 1;
        const qrY = y + (rowH * 7 - qrSize) / 2; // Dikey ortala

        // Video URL varsa QR kod üret
        if (group.videoUrl) {
            try {
                // QR kod'u base64 image olarak üret (KARE ve YÜKSEK KALİTE)
                const qrDataUrl = await QRCode.toDataURL(group.videoUrl, {
                    width: 400,  // Yüksek çözünürlük
                    margin: 0,   // Kenardan boşluk yok
                    errorCorrectionLevel: 'H',  // Yüksek seviye hata düzeltme
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });

                // QR kod'u PDF'e KARE olarak ekle (26×26 mm)
                doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
                
                // QR etrafına ince çerçeve
                doc.setLineWidth(0.3);
                doc.setDrawColor(0, 0, 0); // Siyah çerçeve
                doc.rect(qrX, qrY, qrSize, qrSize);

                // QR altına açıklama metni
                doc.setFont(font, 'bold');
                doc.setFontSize(4.5);
                doc.setTextColor(0, 0, 0);
                doc.text('VİDEO İÇİN', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
                doc.text('QR OKUTUNUZ', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
            } catch (error) {
                console.error('QR kod üretilemedi:', error);
                // Hata durumunda placeholder göster
                doc.setLineWidth(0.3);
                doc.setDrawColor(0, 0, 0); // Siyah çerçeve
                doc.rect(qrX, qrY, qrSize, qrSize);
                doc.setFont(font, 'normal');
                doc.setFontSize(5.5);
                doc.setTextColor(160, 160, 160);
                doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
                doc.text('HATA', qrX + qrSize / 2, qrY + qrSize / 2 + 4, { align: 'center' });
            }
        } else {
            // Video yoksa placeholder göster
            doc.setLineWidth(0.3);
            doc.setDrawColor(0, 0, 0); // Siyah çerçeve
            doc.rect(qrX, qrY, qrSize, qrSize);
            doc.setFont(font, 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(160, 160, 160);
            doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
            doc.text('KOD', qrX + qrSize / 2, qrY + qrSize / 2 + 4, { align: 'center' });
        }

        // Renk ve çizgi ayarlarını sıfırla (sonraki etiket için)
        doc.setDrawColor(0, 0, 0);
        doc.setTextColor(0, 0, 0);
        } // copyIndex döngüsü sonu (14 kopya)
    } // targetGroups döngüsü sonu

    const dayStr  = singleGroupId ? 'tek' : `gun${day}`;
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    doc.save(`etiket-${dayStr}-${dateStr}.pdf`);
};

// ────────────────────────────────────────────────────────────────
//  KÜÇÜKBAŞ ETİKET  (normal veya indirimli)
//  Her kayıt için 100×100 mm sayfada 2 kopya (çantanın 2 yüzü)
// ────────────────────────────────────────────────────────────────
export const generateKucukbasEtiketPDF = async (
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    type: 'normal' | 'indirimli',
    singleRecordId?: string,
) => {
    const W = 100;
    const H = 100;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [W, H],
    });

    // Font yükle
    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            doc.addFileToVFS(`${name}-${style}.ttf`, b64);
            doc.addFont(`${name}-${style}.ttf`, name, style);
            return true;
        } catch { return false; }
    };

    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl, 'Roboto', 'bold'),
    ]);

    const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';

    // Hangi kayıtlar basılacak (iptal edilenler ve gruba ait büyükbaş kayıtları hariç)
    const targetRecords = allRecords
        .filter(r => {
            if (singleRecordId) return r.id === singleRecordId;
            if (r.daySelection !== day || r.status === 'cancelled' || r.groupId) return false;
            const st = shareTypes.find(s => s.id === r.shareTypeId);
            const kt = st?.kucukbasType || 'buyukbas';
            return type === 'indirimli' ? kt === 'kucukbas-indirimli' : kt === 'kucukbas-normal';
        })
        .sort((a, b) => (a.orderNumber ?? 999999) - (b.orderNumber ?? 999999));

    if (targetRecords.length === 0) {
        alert('Seçilen güne ait kayıt bulunamadı.');
        return;
    }

    const dayLabel = (d: number) => {
        if (d === 1) return settings?.day1Label || '1. GÜN';
        if (d === 2) return settings?.day2Label || '2. GÜN';
        return '3. GÜN';
    };

    const typeLabel = type === 'indirimli' ? 'İNDİRİMLİ KÜÇÜKBAŞ' : 'KÜÇÜKBAŞ';
    const isIndirimli = type === 'indirimli';

    doc.deletePage(1);

    for (const record of targetRecords) {
        const shareType = shareTypes.find(st => st.id === record.shareTypeId);
        const stName    = shareType?.name || record.shareTypeName || '';

        // Her kayıt için 2 kopya (çantanın ön ve arka yüzü)
        for (let copy = 0; copy < 2; copy++) {
            doc.addPage([W, H], 'portrait');

            doc.setDrawColor(0, 0, 0);
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(255, 255, 255);

            const margin = 3;
            const innerW = W - margin * 2;

            // Dış kenarlık
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.8);
            doc.rect(margin, margin, innerW, H - margin * 2);

            // ── ÜST BÖLÜM: Tür etiketi + Sıra no ──
            const topH = 22;

            // İndirimli için açık yeşil arka plan
            if (isIndirimli) {
                doc.setFillColor(236, 253, 245);
                doc.rect(margin, margin, innerW, topH, 'F');
            }

            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.line(margin, margin + topH, margin + innerW, margin + topH);

            // Sıra no kutusu (sağ)
            const boxW = 22;
            const boxH = topH - 4;
            const boxX = margin + innerW - boxW - 2;
            const boxY = margin + 2;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(1.2);
            doc.rect(boxX, boxY, boxW, boxH);
            doc.setFont(font, 'bold');
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            const siraStr = record.orderNumber ? String(record.orderNumber) : '-';
            doc.text(siraStr, boxX + boxW / 2, boxY + boxH * 0.68, { align: 'center' });

            // Tür etiketi (sol)
            const maxLabelW = boxX - margin - 5;
            let labelFontSize = 13;
            doc.setFont(font, 'bold');
            doc.setFontSize(labelFontSize);
            while (labelFontSize > 7 && doc.getTextWidth(typeLabel) > maxLabelW) {
                labelFontSize -= 1;
                doc.setFontSize(labelFontSize);
            }
            doc.setTextColor(isIndirimli ? 6 : 0, isIndirimli ? 95 : 0, isIndirimli ? 70 : 0);
            doc.text(typeLabel, margin + 3, margin + topH / 2 + labelFontSize * 0.18, { maxWidth: maxLabelW });

            // ── ORTA BÖLÜM: Gün + Ad Soyad + Hisse tipi + Sipariş no ──
            let y = margin + topH + 7;

            // Kesim günü
            doc.setFont(font, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`${dayLabel(record.daySelection)} TESLİM`, W / 2, y, { align: 'center' });
            y += 7;

            // Ad Soyad (büyük)
            doc.setFont(font, 'bold');
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            const nameLines = doc.splitTextToSize(record.ownerName.toUpperCase(), innerW - 6);
            doc.text(nameLines[0], W / 2, y, { align: 'center' });
            y += 7;
            if (nameLines.length > 1) {
                doc.text(nameLines[1], W / 2, y, { align: 'center' });
                y += 6;
            }

            // Hisse tipi adı
            if (stName) {
                doc.setFont(font, 'normal');
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                doc.text(stName, W / 2, y, { align: 'center' });
                y += 5;
            }

            // Sipariş no
            if (record.orderNumber) {
                doc.setFont(font, 'normal');
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                doc.text(`Sipariş No: #${String(record.orderNumber).padStart(4, '0')}`, W / 2, y, { align: 'center' });
                y += 5;
            }

            // ── QR / Placeholder (merkeze hizalı, altta) ──
            const qrSize = 22;
            const qrX    = (W - qrSize) / 2;
            const remaining = (H - margin) - y - 3;
            const qrY    = y + Math.max(2, (remaining - qrSize - 6) / 2);

            doc.setLineWidth(0.3);
            doc.setDrawColor(0, 0, 0);
            doc.rect(qrX, qrY, qrSize, qrSize);
            doc.setFont(font, 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(160, 160, 160);
            doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2 - 2,  { align: 'center' });
            doc.text('KOD', qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: 'center' });
        }
    }

    const typeStr = isIndirimli ? 'indirimli' : 'normal';
    const dayStr  = singleRecordId ? 'tek' : `gun${day}`;
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    doc.save(`kucukbas-${typeStr}-${dayStr}-${dateStr}.pdf`);
};

// ===== PADOK LİSTESİ PDF (A4 DİKEY, çift sütun) =====
export const generatePadokListesiPDF = async (
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    kucukbasShareTypeId: string,
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            doc.addFileToVFS(`${name}-${style}.ttf`, b64);
            doc.addFont(`${name}-${style}.ttf`, name, style);
            return true;
        } catch { return false; }
    };

    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl, 'Roboto', 'bold'),
    ]);
    const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';

    // --- Filtrele & sırala (sadece büyükbaş) ---
    const nonKucukbasIds = shareTypes
        .filter(st => st.id !== kucukbasShareTypeId)
        .map(st => st.id);

    const rawGroups = groups.filter(g => {
        if (!nonKucukbasIds.includes(g.shareTypeId)) return false;
        if (g.memberIds.length === 0) return false;
        const firstMember = allRecords.find(r => r.id === g.memberIds[0]);
        return firstMember?.daySelection === day;
    });

    // Her tipin ilk kesimSiraNo'sunu bul → tip sıralaması buna göre yapılır
    const typeFirstSira = new Map<string, number>();
    rawGroups.forEach(g => {
        const cur = typeFirstSira.get(g.shareTypeId) ?? 999999;
        if ((g.kesimSiraNo ?? 999999) < cur) typeFirstSira.set(g.shareTypeId, g.kesimSiraNo ?? 999999);
    });

    // Önce tip grubuna göre sırala, sonra aynı tiptekiler kendi içinde kesimSiraNo'ya göre
    const filteredGroups = [...rawGroups].sort((a, b) => {
        const tA = typeFirstSira.get(a.shareTypeId) ?? 999999;
        const tB = typeFirstSira.get(b.shareTypeId) ?? 999999;
        if (tA !== tB) return tA - tB;
        return (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999);
    });

    if (filteredGroups.length === 0) {
        alert('Seçilen güne ait büyükbaş grubu bulunamadı.');
        return;
    }

    // --- Entry metinleri ---
    const entries = filteredGroups.map(g => {
        const st = shareTypes.find(s => s.id === g.shareTypeId);
        const typeName = st?.name || g.shareTypeName || '';
        return `${g.kesimSiraNo ?? '-'} NO'LU KESİM (${typeName})`;
    });

    // --- Özet istatistikleri (sıra koruyarak) ---
    const typeOrder: string[] = [];
    const typeCount: Map<string, number> = new Map();
    filteredGroups.forEach(g => {
        const st = shareTypes.find(s => s.id === g.shareTypeId);
        const label = st?.name || g.shareTypeName || 'Diğer';
        if (!typeCount.has(label)) { typeCount.set(label, 0); typeOrder.push(label); }
        typeCount.set(label, (typeCount.get(label) ?? 0) + 1);
    });

    // --- Sayfa boyutları ---
    const W = 210, H = 297;
    const marginX = 14, marginTop = 14, marginBot = 12;
    const headerH = 20; // piksel yüksekliği (logo yok, sadece yazı)
    const contentW = W - marginX * 2;
    const gutter = 6;
    const colW = (contentW - gutter) / 2;
    const leftX = marginX;
    const rightX = marginX + colW + gutter;
    const contentStartY = marginTop + headerH;
    const contentEndY = H - marginBot;
    const rowH = 7;

    // Özet satır sayısı: typeOrder.length + 1 (TOPLAM) + 1 (çizgi boşluğu)
    const summaryH = (typeOrder.length + 1) * 6.5 + 8;
    const rowsPerCol = Math.floor((contentEndY - contentStartY) / rowH);

    let currentPage = 1;

    const drawHeader = () => {
        const companyName = settings?.companyName || '';
        doc.setFont(font, 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(companyName, W / 2, marginTop + 5, { align: 'center' });

        doc.setFont(font, 'bold');
        doc.setFontSize(10);
        doc.text(`PADOK LİSTESİ — ${day}. GÜN`, W / 2, marginTop + 11, { align: 'center' });

        const dateStr = new Date().toLocaleDateString('tr-TR');
        doc.setFont(font, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text(dateStr, W - marginX, marginTop + 5, { align: 'right' });
        doc.text(`Sayfa ${currentPage}`, W - marginX, marginTop + 11, { align: 'right' });
        doc.setTextColor(0);

        doc.setDrawColor(150);
        doc.setLineWidth(0.4);
        doc.line(marginX, contentStartY - 2, W - marginX, contentStartY - 2);

        // Sütun ayırıcı dikey çizgi
        const midX = leftX + colW + gutter / 2;
        doc.setLineWidth(0.2);
        doc.setDrawColor(200);
        doc.line(midX, contentStartY, midX, contentEndY);
    };

    drawHeader();

    // --- Satır render ---
    let col = 0;       // 0=sol, 1=sağ
    let rowInCol = 0;

    const getXY = (c: number, r: number) => ({
        x: c === 0 ? leftX + 2 : rightX + 2,
        y: contentStartY + r * rowH + rowH * 0.78,
    });

    for (let i = 0; i < entries.length; i++) {
        // Sütun/sayfa taşması kontrolü
        if (col === 0 && rowInCol >= rowsPerCol) {
            col = 1;
            rowInCol = 0;
        }
        if (col === 1 && rowInCol >= rowsPerCol) {
            doc.addPage();
            currentPage++;
            drawHeader();
            col = 0;
            rowInCol = 0;
        }

        const { x, y } = getXY(col, rowInCol);

        // Hafif arka plan (satır çizgisi alternatifi)
        if (rowInCol % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(
                col === 0 ? leftX : rightX,
                contentStartY + rowInCol * rowH,
                colW,
                rowH,
                'F',
            );
        }

        doc.setFont(font, 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0);
        doc.text(entries[i], x, y);

        rowInCol++;
    }

    // --- Özet (son sayfanın altı) ---
    // Kalan boş alan:
    const afterLastEntryY = contentStartY + rowInCol * rowH;
    const spaceLeft = contentEndY - afterLastEntryY;

    let sumY: number;
    let sumX: number;

    if (col === 0) {
        // Sol sütundayız — özeti sağ sütuna yerleştir
        sumX = rightX;
        sumY = contentStartY;
    } else {
        // Sağ sütundayız — altına yerleştir, yer yoksa yeni sayfa
        if (spaceLeft < summaryH + 6) {
            doc.addPage();
            currentPage++;
            drawHeader();
            sumX = leftX;
            sumY = contentStartY;
        } else {
            sumX = rightX;
            sumY = afterLastEntryY + 6;
        }
    }

    // Özet çizgisi
    doc.setDrawColor(150);
    doc.setLineWidth(0.4);
    doc.line(sumX, sumY - 2, sumX + colW, sumY - 2);

    let sy = sumY + 4;
    typeOrder.forEach(label => {
        const cnt = typeCount.get(label) ?? 0;
        doc.setFont(font, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(`${cnt} AD: ${label}`, sumX + colW, sy, { align: 'right' });
        sy += 6.5;
    });

    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`TOPLAM ${entries.length} ADET`, sumX + colW, sy, { align: 'right' });

    const dayStr = `gun${day}`;
    const dateStr2 = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    doc.save(`padok-listesi-${dayStr}-${dateStr2}.pdf`);
};

// ===== VEKALET ALMA LİSTESİ PDF (A4 DİKEY) =====
// records: sadece bu session'a dahil edilecek kayıtlar (zaten filtrelenmiş)
// sessionLabel: "1. Gün — Ana Liste" gibi
export const generateVekaletListesiPDF = async (
    sessionRecords: Record[],   // bu session'a dahil kayıtlar, sıralanmış
    groups: Group[],
    settings: Settings | null,
    sessionLabel: string,
    day: 1 | 2 | 3,
): Promise<void> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const loadFont = async (url: string, name: string, style: string) => {
        try {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            doc.addFileToVFS(`${name}-${style}.ttf`, b64);
            doc.addFont(`${name}-${style}.ttf`, name, style);
        } catch { /* ignore */ }
    };

    await Promise.all([
        loadFont(robotoRegularUrl, 'Roboto', 'normal'),
        loadFont(robotoBoldUrl, 'Roboto', 'bold'),
    ]);
    const font = doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica';

    const companyName = settings?.companyName || '';
    const dateStr = new Date().toLocaleDateString('tr-TR');
    const pageW = 210;
    const marginX = 11;

    // Header yüksekliği: 4 satır + çizgi → ~28mm
    // Satır 1 (y=8):  tarih sol | sayfa sağ  (8pt gri)
    // Satır 2 (y=15): şirket adı ortalı      (bold, auto-font)
    // Satır 3 (y=21): liste başlığı ortalı   (10pt)
    // Çizgi  (y=25)
    // Tablo  (y=28)
    const headerHeight = 28;

    // Tablo satırlarını hazırla
    const tableRows = sessionRecords.map((record, idx) => {
        const group = groups.find(g => g.id === record.groupId);
        return [
            String(idx + 1),
            String(group?.kesimSiraNo ?? '-'),
            group?.name ?? '-',
            record.ownerName,
            record.phone,
            '',  // imza alanı boş
        ];
    });

    autoTable(doc, {
        startY: headerHeight,
        head: [['Sıra', 'Kesim No', 'Grup', 'Ad Soyad', 'Telefon', 'İmza']],
        body: tableRows,
        styles: {
            font: font,
            fontSize: 9,
            cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
            overflow: 'linebreak',
            valign: 'middle',
            lineColor: [200, 200, 200],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [30, 58, 92],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center',
        },
        alternateRowStyles: {
            fillColor: [248, 250, 255],
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 42 },
            3: { cellWidth: 52 },
            4: { cellWidth: 28 },
            5: { cellWidth: 38 },
        },
        margin: { left: marginX, right: marginX, top: headerHeight },
        didDrawPage: (data) => {
            const pn = data.pageNumber;
            const availW = pageW - marginX * 2;

            // ── Satır 1: tarih (sol) | sayfa (sağ) ──
            doc.setFont(font, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(130);
            doc.text(dateStr, marginX, 8);
            doc.text(`Sayfa ${pn}  |  Toplam: ${sessionRecords.length} kayıt`, pageW - marginX, 8, { align: 'right' });

            // ── Satır 2: şirket adı (tam genişlik, auto font küçültme) ──
            doc.setFont(font, 'bold');
            doc.setTextColor(0);
            let cfs = 13;
            doc.setFontSize(cfs);
            while (companyName && doc.getTextWidth(companyName) > availW && cfs > 8) {
                cfs -= 0.5;
                doc.setFontSize(cfs);
            }
            if (companyName) {
                doc.text(companyName, pageW / 2, 15, { align: 'center' });
            }

            // ── Satır 3: liste başlığı ──
            doc.setFont(font, 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(`VEKALET ALMA LİSTESİ — ${sessionLabel}`, pageW / 2, 21, { align: 'center' });

            // ── Ayırıcı çizgi ──
            doc.setDrawColor(80);
            doc.setLineWidth(0.6);
            doc.line(marginX, 25, pageW - marginX, 25);

            doc.setTextColor(0);
        },
    });

    const fileDate = dateStr.replace(/\./g, '-');
    doc.save(`vekalet-listesi-gun${day}-${fileDate}.pdf`);
};


