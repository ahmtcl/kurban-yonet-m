import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
        const logoResponse = await fetch('/logo.png');
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

// ===== KESİM LİSTESİ PDF (A5 DİKEY) =====
export const generateKesimListesiPDF = async (
    type: 'kucukbas' | 'buyukbas',
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    kucukbasShareTypeId: string,
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

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
        const res = await fetch('/logo.png');
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
    const W = 148;
    const margin = 8;
    const cW = W - margin * 2;
    const year = new Date().getFullYear();

    // ---- Ortak header çizici ----
    const drawHeader = (shareTypeName?: string): number => {
        let y = margin;

        if (logoBase64) {
            const lw = 22;
            const lh = Math.min(lw * logoRatio, 16);
            doc.addImage(logoBase64, 'PNG', (W - lw) / 2, y, lw, lh);
            y += lh + 3;
        }

        if (companyName) {
            doc.setFont(font, 'bold');
            doc.setFontSize(13);
            doc.setTextColor(0);
            doc.text(companyName, W / 2, y, { align: 'center' });
            y += 6;
        }

        doc.setFont(font, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`${year} KURBAN BAYRAMI`, W / 2, y, { align: 'center' });
        y += 5;

        if (shareTypeName) {
            doc.setFont(font, 'bold');
            doc.setFontSize(10);
            doc.text(shareTypeName.toUpperCase(), W / 2, y, { align: 'center' });
            y += 5;
        }

        doc.setDrawColor(0);
        doc.setLineWidth(0.6);
        doc.line(margin, y, W - margin, y);
        y += 5;

        return y;
    };

    // ---- KÜÇÜKBAŞ ----
    if (type === 'kucukbas') {
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
            if (idx > 0) doc.addPage([148, 210], 'portrait');

            let y = drawHeader();

            doc.setFont(font, 'bold');
            doc.setFontSize(16);
            doc.setTextColor(0);
            doc.text('KÜÇÜKBAŞ KURBAN', W / 2, y + 4, { align: 'center' });
            y += 16;

            // Büyük numara
            doc.setFont(font, 'bold');
            doc.setFontSize(72);
            doc.text(String(idx + 1), W / 2, y + 30, { align: 'center' });
            y += 46;

            // İsim
            doc.setFont(font, 'bold');
            doc.setFontSize(18);
            doc.setTextColor(0);
            const nameLines = doc.splitTextToSize(record.ownerName.toUpperCase(), cW);
            doc.text(nameLines, W / 2, y + 6, { align: 'center' });
        });

    // ---- BÜYÜKBAŞ ----
    } else {
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

        filteredGroups.forEach((group, idx) => {
            if (idx > 0) doc.addPage([148, 210], 'portrait');

            const shareType = shareTypes.find(st => st.id === group.shareTypeId);
            const stName = shareType?.name || group.shareTypeName || '';
            const members = group.memberIds
                .map(mid => allRecords.find(r => r.id === mid))
                .filter(Boolean) as Record[];

            let y = drawHeader(stName);

            // KESİM SIRASI etiketi
            doc.setFont(font, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text('KESİM SIRASI', W / 2, y, { align: 'center' });
            y += 3;

            // Kutu + numara
            const boxW = 30;
            const boxH = 22;
            const boxX = (W - boxW) / 2;
            doc.setDrawColor(0);
            doc.setLineWidth(1.2);
            doc.setFillColor(255, 255, 255);
            doc.rect(boxX, y, boxW, boxH, 'FD');
            doc.setFont(font, 'bold');
            doc.setFontSize(22);
            doc.setTextColor(0);
            doc.text(String(group.kesimSiraNo ?? '-'), W / 2, y + boxH * 0.68, { align: 'center' });
            y += boxH + 6;

            // Üye listesi (7 satır)
            for (let i = 0; i < 7; i++) {
                const member = members[i];
                if (i % 2 === 0) {
                    doc.setFillColor(246, 246, 246);
                    doc.rect(margin, y - 3.8, cW, 8.2, 'F');
                }
                doc.setFont(font, 'bold');
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(String(i + 1), margin + 1.5, y);

                if (member) {
                    doc.setFont(font, 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(0);
                    doc.text(member.ownerName, margin + 9, y);
                }
                y += 8.5;
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
    // 10×10 cm = 100×100 mm
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

    targetGroups.forEach((group, idx) => {
        if (idx > 0) doc.addPage([W, H]);

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
        doc.setDrawColor(0);
        doc.setLineWidth(0.8);
        doc.rect(margin, margin, innerW, H - margin * 2);

        // ── ÜST BÖLÜM: Hisse adı + Kesim sıra no kutusu ──
        const topH = 22;
        doc.setLineWidth(0.5);
        doc.line(margin, margin + topH, margin + innerW, margin + topH);

        // Kesim sıra no kutusu (sağ) — önce çiz, sol sınırı belli olsun
        const boxW = 22;
        const boxH = topH - 4;
        const boxX = margin + innerW - boxW - 2;
        const boxY = margin + 2;
        doc.setLineWidth(1.2);
        doc.rect(boxX, boxY, boxW, boxH);
        doc.setFont(font, 'bold');
        doc.setFontSize(16);
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
        doc.setTextColor(0);
        doc.text(stName, margin + 3, margin + topH / 2 + nameFontSize * 0.18, { maxWidth: maxNameW });

        // ── ORTA: Gün + "HİSSE ORTAKLARI" ──
        let y = margin + topH + 5;
        doc.setFont(font, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(`${dayLabel(groupDay)} TESLİM`, W / 2, y, { align: 'center' });
        y += 4.5;
        doc.setFontSize(8);
        doc.text('HİSSE ORTAKLARI', W / 2, y, { align: 'center' });
        y += 4;

        // ── ÜYELER TABLOSU ──
        const rowH    = 7.5;
        const noColW  = 8;
        const nameColW = innerW - noColW - 2; // QR için sağda yer bırak
        const qrColW  = 18;
        const tableW  = noColW + (nameColW - qrColW);
        const tableX  = margin + 1;

        // Tablo dış çerçevesi
        doc.setLineWidth(0.4);
        doc.rect(tableX, y, tableW, rowH * 7);

        for (let i = 0; i < 7; i++) {
            const member  = members[i] ?? null;
            const rowY    = y + i * rowH;

            // Satır alt çizgisi (son satır hariç)
            if (i < 6) {
                doc.setLineWidth(0.2);
                doc.line(tableX, rowY + rowH, tableX + tableW, rowY + rowH);
            }

            // Sıra no dikey ayırıcı
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
                doc.setFontSize(8.5);
                doc.setTextColor(0);
                const nameText = doc.splitTextToSize(member.ownerName, tableW - noColW - 2);
                doc.text(nameText[0], tableX + noColW + 2, rowY + rowH * 0.68);
            }
        }

        // ── QR PLACEHOLDER (sağ alt) ──
        const qrX = margin + innerW - qrColW - 1;
        const qrY = y;
        const qrSize = rowH * 7;
        doc.setLineWidth(0.5);
        doc.setDrawColor(180, 180, 180);
        doc.rect(qrX, qrY, qrColW, qrSize);

        // Placeholder yazısı
        doc.setFont(font, 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(160, 160, 160);
        doc.text('QR', qrX + qrColW / 2, qrY + qrSize / 2, { align: 'center' });
        doc.text('KOD', qrX + qrColW / 2, qrY + qrSize / 2 + 4, { align: 'center' });

        doc.setDrawColor(0); // reset
    });

    const dayStr  = singleGroupId ? 'tek' : `gun${day}`;
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    doc.save(`etiket-${dayStr}-${dateStr}.pdf`);
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


