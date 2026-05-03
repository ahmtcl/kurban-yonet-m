import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Group, Record, ShareType, Settings } from '@/types';

const ROWS_PER_PAGE = 44; // A4 yatay, ~11pt font için yaklaşık satır sayısı

export const generateTahsilatListesiExcel = async (
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
) => {
    // Seçilen güne ait grupları filtrele ve kesim sırasına göre sırala
    const filteredGroups = groups
        .filter(g => {
            if (g.memberIds.length === 0) return false;
            const firstMember = allRecords.find(r => r.id === g.memberIds[0]);
            return firstMember?.daySelection === day;
        })
        .sort((a, b) => (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings?.companyName || 'Kurban Yönetim';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tahsilat Listesi', {
        pageSetup: {
            paperSize: 9,           // A4
            orientation: 'landscape',
            fitToPage: false,
            horizontalCentered: true,
            margins: {
                left: 0.5, right: 0.5,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3,
            },
        },
        views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
    });

    // Kolon genişlikleri ve başlıklar
    sheet.columns = [
        { key: 'kesimSirasi', width: 13 },
        { key: 'hisseNo',     width: 10 },
        { key: 'urun',        width: 18 },
        { key: 'isim',        width: 28 },
        { key: 'fiyat',       width: 13 },
        { key: 'kapora',      width: 11 },
        { key: 'bakiye',      width: 13 },
        { key: 'iletisim',    width: 15 },
        { key: 'yedek',       width: 15 },
        { key: 'id',          width: 8  },
        { key: 'gun',         width: 10 },
        { key: 'not',         width: 22 },
    ];

    // --- Başlık satırı ---
    const headers = [
        'KESİM SIRASI', 'HİSSE NO', 'ÜRÜN', 'VEKALET İSMİ',
        'ÜRÜN FİYAT', 'KAPORA', 'BAKİYE',
        'İLETİŞİM', 'YEDEK TELEFON', 'ID', 'GÜN', 'ADMİN NOTU',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell(cell => {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
        cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        cell.border = {
            top:    { style: 'medium', color: { argb: 'FF1A252F' } },
            bottom: { style: 'medium', color: { argb: 'FF1A252F' } },
            left:   { style: 'thin',   color: { argb: 'FF1A252F' } },
            right:  { style: 'thin',   color: { argb: 'FF1A252F' } },
        };
    });

    // Otomatik filtre
    sheet.autoFilter = { from: 'A1', to: 'L1' };

    let currentDataRow = 2; // başlık sonrası

    for (const group of filteredGroups) {
        const shareType  = shareTypes.find(st => st.id === group.shareTypeId);
        const stName     = shareType?.name || group.shareTypeName || '';
        const members    = group.memberIds
            .map(mid => allRecords.find(r => r.id === mid))
            .filter((r): r is Record => !!r);

        const SLOTS = 7;

        // Sığdırma kontrolü: mevcut sayfada kalan satır < 7 ise boş satır ekle
        const posOnPage = (currentDataRow - 2) % ROWS_PER_PAGE;
        const remaining = ROWS_PER_PAGE - posOnPage;
        if (posOnPage > 0 && remaining < SLOTS) {
            for (let p = 0; p < remaining; p++) {
                const emptyRow = sheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '']);
                emptyRow.height = 18;
                currentDataRow++;
            }
        }

        // Grubu yaz (7 slot)
        for (let slot = 0; slot < SLOTS; slot++) {
            const m = members[slot] ?? null;

            const kapora = m
                ? (m.depositAmount > 0 ? m.depositAmount : 'YOK')
                : '';
            const bakiye = m ? (m.totalPrice - m.depositAmount) : '';

            const rowValues = [
                group.kesimSiraNo ?? '',
                slot + 1,
                m ? stName : '',
                m?.ownerName ?? '',
                m?.totalPrice ?? '',
                kapora,
                bakiye,
                m?.phone ?? '',
                m?.phoneBackup ?? '',
                m?.orderNumber ?? '',
                m ? `${m.daySelection}. GÜN` : '',
                m?.notes ?? '',
            ];

            const row = sheet.addRow(rowValues);
            row.height = 18;

            // Zemin rengi
            let bgArgb = slot % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
            if (!m) {
                bgArgb = 'FFF0F0F0'; // boş slot
            } else if (m.status === 'cancelled') {
                bgArgb = 'FFFFD5D5'; // iptal - kırmızı
            } else if (m.status === 'pending_cancellation') {
                bgArgb = 'FFFFF0CC'; // iptale alınmış - turuncu
            } else if (m.depositAmount > 0) {
                bgArgb = 'FFFFFF99'; // kapora ödenmiş - sarı
            }

            row.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.font = { size: 10, name: 'Calibri' };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: col <= 2 ? 'center' : 'left',
                };
                cell.border = {
                    top:    { style: 'hair', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } },
                    left:   { style: 'hair', color: { argb: 'FFD0D0D0' } },
                    right:  { style: 'hair', color: { argb: 'FFD0D0D0' } },
                };
            });

            // Sayısal hücre formatı
            if (m) {
                row.getCell(5).numFmt = '#,##0.00'; // Ürün Fiyat
                if (typeof kapora === 'number') row.getCell(6).numFmt = '#,##0.00';
                if (typeof bakiye === 'number') row.getCell(7).numFmt = '#,##0.00';
            }

            currentDataRow++;
        }

        // Grup sonu kalın alt çizgi
        const lastGroupRow = sheet.getRow(currentDataRow - 1);
        lastGroupRow.eachCell({ includeEmpty: true }, cell => {
            cell.border = {
                ...cell.border,
                bottom: { style: 'medium', color: { argb: 'FF999999' } },
            };
        });
    }

    // Dosyayı indir
    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dayStr = `${day}gun`;
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    saveAs(blob, `tahsilat-listesi-${dayStr}-${dateStr}.xlsx`);
};

// ===== PADOK LİSTESİ EXCEL (A4 DİKEY, çift sütun) =====
export const generatePadokListesiExcel = async (
    groups: Group[],
    allRecords: Record[],
    shareTypes: ShareType[],
    settings: Settings | null,
    day: 1 | 2 | 3,
    kucukbasShareTypeId: string,
) => {
    // Filtrele & sırala
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
    const typeFirstSiraExcel = new Map<string, number>();
    rawGroups.forEach(g => {
        const cur = typeFirstSiraExcel.get(g.shareTypeId) ?? 999999;
        if ((g.kesimSiraNo ?? 999999) < cur) typeFirstSiraExcel.set(g.shareTypeId, g.kesimSiraNo ?? 999999);
    });

    // Önce tip grubuna göre sırala, sonra aynı tiptekiler kendi içinde kesimSiraNo'ya göre
    const filteredGroups = [...rawGroups].sort((a, b) => {
        const tA = typeFirstSiraExcel.get(a.shareTypeId) ?? 999999;
        const tB = typeFirstSiraExcel.get(b.shareTypeId) ?? 999999;
        if (tA !== tB) return tA - tB;
        return (a.kesimSiraNo ?? 999999) - (b.kesimSiraNo ?? 999999);
    });

    // Entry metinleri
    const entries = filteredGroups.map(g => {
        const st = shareTypes.find(s => s.id === g.shareTypeId);
        const typeName = st?.name || g.shareTypeName || '';
        return `${g.kesimSiraNo ?? '-'} NO'LU KESİM (${typeName})`;
    });

    // Özet
    const typeOrder: string[] = [];
    const typeCount: Map<string, number> = new Map();
    filteredGroups.forEach(g => {
        const st = shareTypes.find(s => s.id === g.shareTypeId);
        const label = st?.name || g.shareTypeName || 'Diğer';
        if (!typeCount.has(label)) { typeCount.set(label, 0); typeOrder.push(label); }
        typeCount.set(label, (typeCount.get(label) ?? 0) + 1);
    });

    const companyName = settings?.companyName || 'Kurban Yönetim';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = companyName;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Padok Listesi', {
        pageSetup: {
            paperSize: 9,           // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: {
                left: 0.4, right: 0.4,
                top: 0.6, bottom: 0.6,
                header: 0.2, footer: 0.2,
            },
        },
    });

    // Sütunlar: A(sıra sol) | B(entry sol) | C(boşluk) | D(sıra sağ) | E(entry sağ)
    sheet.columns = [
        { key: 'leftNo',    width: 4  },
        { key: 'leftEntry', width: 38 },
        { key: 'gap',       width: 3  },
        { key: 'rightNo',   width: 4  },
        { key: 'rightEntry', width: 38 },
    ];

    const styleHeader = (cell: ExcelJS.Cell, text: string) => {
        cell.value = text;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    };

    // Başlık satırı (A-E birleştir)
    const titleRow = sheet.addRow(['', '', '', '', '']);
    titleRow.height = 26;
    sheet.mergeCells(`A1:E1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${companyName} — PADOK LİSTESİ ${day}. GÜN`;
    titleCell.font = { bold: true, size: 13, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
        bottom: { style: 'medium', color: { argb: 'FF0A1F30' } },
    };

    // İki sütun layoutu: half = sol sütun satır sayısı
    const ROWS_PER_PAGE_PORTRAIT = 48; // A4 dikey ~48 satır
    const half = Math.ceil(entries.length / 2);

    const borderThin: Partial<ExcelJS.Borders> = {
        top:    { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left:   { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right:  { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };

    for (let i = 0; i < half; i++) {
        const leftEntry = entries[i] ?? '';
        const rightEntry = entries[i + half] ?? '';
        const leftNo = leftEntry ? String(i + 1) : '';
        const rightNo = rightEntry ? String(i + half + 1) : '';

        const row = sheet.addRow([leftNo, leftEntry, '', rightNo, rightEntry]);
        row.height = 17;

        const isEven = i % 2 === 0;
        const bgArgb = isEven ? 'FFF5F5F5' : 'FFFFFFFF';

        [1, 2, 4, 5].forEach(colIdx => {
            const cell = row.getCell(colIdx);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
            cell.font = { size: 10, name: 'Calibri' };
            cell.border = borderThin;
            cell.alignment = {
                vertical: 'middle',
                horizontal: colIdx === 1 || colIdx === 4 ? 'center' : 'left',
            };
            // Boş slot: gri
            if ((colIdx <= 2 && !leftEntry) || (colIdx >= 4 && !rightEntry)) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
            }
        });
        // Boşluk sütunu (C) - kenarlıksız
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    }

    // Özet satırları
    const addSummaryRow = (text: string, bold = false) => {
        const r = sheet.addRow(['', '', '', '', '']);
        r.height = 17;
        sheet.mergeCells(`A${r.number}:E${r.number}`);
        const c = sheet.getCell(`A${r.number}`);
        c.value = text;
        c.font = { bold, size: bold ? 11 : 10, name: 'Calibri' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bold ? 'FFD6E4F0' : 'FFF0F0F0' } };
        c.border = {
            top:    { style: bold ? 'medium' : 'thin', color: { argb: 'FF999999' } },
            bottom: { style: bold ? 'medium' : 'thin', color: { argb: 'FF999999' } },
        };
    };

    // Boşluk satırı özet öncesi
    const gapRow = sheet.addRow(['', '', '', '', '']);
    gapRow.height = 8;
    sheet.mergeCells(`A${gapRow.number}:E${gapRow.number}`);

    typeOrder.forEach(label => {
        const cnt = typeCount.get(label) ?? 0;
        addSummaryRow(`${cnt} AD: ${label}`);
    });
    addSummaryRow(`TOPLAM ${entries.length} ADET`, true);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dayStr = `${day}gun`;
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    saveAs(blob, `padok-listesi-${dayStr}-${dateStr}.xlsx`);
};
