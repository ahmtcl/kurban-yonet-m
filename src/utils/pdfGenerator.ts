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

// Let's try adding a font from a remote URL at runtime.

const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';

export const generateReceipt = async (record: Record, settings: Settings | null) => {
    const doc = new jsPDF();

    // Add font for Turkish support
    try {
        const response = await fetch(fontUrl);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            doc.addFileToVFS('Roboto-Regular.ttf', base64data);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');
            createPdfContent(doc, record, settings);
        };
        reader.onerror = () => {
            console.error('Font loading failed, falling back');
            createPdfContent(doc, record, settings); // Fallback
        };
    } catch (e) {
        console.error('Font fetch failed', e);
        // Fallback to standard
        createPdfContent(doc, record, settings);
    }
};

const createPdfContent = (doc: jsPDF, record: Record, settings: Settings | null) => {
    // If Roboto is added, this will use it. Otherwise uses default.
    // We can also check if font exists.
    if (doc.getFontList().hasOwnProperty('Roboto')) {
        doc.setFont('Roboto');
    }

    // Company Title (Header)
    doc.setFontSize(22);
    doc.setTextColor(40);
    const title = settings?.companyTitle || 'KURBAN HİSSE YÖNETİM';
    doc.text(title, 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    const isZeroDeposit = (record.depositAmount || 0) === 0;
    doc.text(isZeroDeposit ? 'Kurban Hissesi Sipariş Makbuzu' : 'Kurban Hissesi Ödeme Makbuzu', 105, 30, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString('tr-TR');
    doc.text(`Tarih: ${dateStr}`, 190, 40, { align: 'right' });

    // Order Number (New)
    if (record.orderNumber) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Sipariş No: #${record.orderNumber}`, 190, 46, { align: 'right' });
    }

    // Customer Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Müşteri Bilgileri:', 14, 50);
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`Ad Soyad: ${record.ownerName}`, 14, 58);
    doc.text(`Telefon: ${record.phone}`, 14, 64);

    // Share Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Hisse Bilgileri:', 14, 80);
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`Hisse Tipi: ${record.shareTypeName}`, 14, 88);

    // Financial Table
    const tableData = [
        ['Açıklama', 'Tutar'],
        ['Toplam Hisse Bedeli', `${record.totalPrice.toLocaleString('tr-TR')} ₺`],
        [isZeroDeposit ? 'Kapora Bekleniyor' : 'Alınan Kapora', `${record.depositAmount.toLocaleString('tr-TR')} ₺`],
        ...(isZeroDeposit ? [] : [['Ödeme Yöntemi', record.paymentType.toUpperCase()]]),
        ['Kalan Tutar', `${(record.totalPrice - record.depositAmount).toLocaleString('tr-TR')} ₺`],
        ['Vade Tarihi', record.dueDate ? new Date(record.dueDate).toLocaleDateString('tr-TR') : '-']
    ];

    autoTable(doc, {
        startY: 100,
        head: [['Detay', 'Bilgi']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: {
            font: doc.getFontList().hasOwnProperty('Roboto') ? 'Roboto' : 'helvetica',
            overflow: 'linebreak'
        },
        margin: { top: 100 },
    });

    // Footer / Terms
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('Bu makbuz elektronik ortamda düzenlenmiştir.', 105, finalY, { align: 'center' });

    if (settings?.companyName) {
        doc.text(settings.companyName, 105, finalY + 6, { align: 'center' });
    }

    doc.save(`Makbuz_${record.ownerName.replace(/\s+/g, '_')}.pdf`);
}
