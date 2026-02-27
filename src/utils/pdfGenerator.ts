import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Record, Settings } from '@/types';

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
