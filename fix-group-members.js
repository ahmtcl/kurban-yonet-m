/**
 * fix-group-members.js
 * Kayıtlarda groupId dolu ama grubun memberIds'inde olmayan kişileri bulup düzeltir.
 * Ayrıca grubun memberIds'inde kayıtlı ama groupId'si olmayan veya farklı olan kişileri temizler.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, arrayUnion } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCCnRWARwEXM1gEtJOMeSnflcoB0OwjRfw",
    authDomain: "kurban-yonetim.firebaseapp.com",
    projectId: "kurban-yonetim",
    storageBucket: "kurban-yonetim.firebasestorage.app",
    messagingSenderId: "343747410843",
    appId: "1:343747410843:web:045a38ffefc5475b2abf3e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
    console.log('🔍 Firestore verisi okunuyor...\n');

    // 1. Tüm kayıtları oku
    const recordsSnap = await getDocs(collection(db, 'records'));
    const records = recordsSnap.docs.map(d => ({
        id: d.id,
        ownerName: d.data().ownerName || '(isim yok)',
        groupId: d.data().groupId || null,
    }));

    // 2. Tüm grupları oku
    const groupsSnap = await getDocs(collection(db, 'groups'));
    const groups = groupsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '(grup adı yok)',
        memberIds: d.data().memberIds || [],
    }));

    console.log(`📋 Toplam ${records.length} kayıt, ${groups.length} grup bulundu.\n`);

    // 3. Tespit: groupId'si olan ama grubun memberIds'inde olmayan kayıtlar
    const missingFromGroup = [];
    for (const record of records) {
        if (!record.groupId) continue;
        const group = groups.find(g => g.id === record.groupId);
        if (!group) {
            console.log(`⚠️  "${record.ownerName}" (${record.id}) — groupId mevcut ama grup bulunamadı: ${record.groupId}`);
            continue;
        }
        if (!group.memberIds.includes(record.id)) {
            missingFromGroup.push({ record, group });
        }
    }

    if (missingFromGroup.length === 0) {
        console.log('✅ Tutarsızlık bulunamadı. Tüm kayıtlar doğru gruplarında görünüyor.');
        process.exit(0);
    }

    console.log(`\n🚨 ${missingFromGroup.length} adet eksik üye tespit edildi:\n`);
    for (const { record, group } of missingFromGroup) {
        console.log(`   • "${record.ownerName}" → "${group.name}" grubuna eklenecek (grup şu an ${group.memberIds.length} üyeli)`);
    }

    // 4. Gruba göre grupla (7 kişi limiti kontrolü için)
    const byGroup = {};
    for (const { record, group } of missingFromGroup) {
        if (!byGroup[group.id]) byGroup[group.id] = { group, records: [] };
        byGroup[group.id].records.push(record);
    }

    console.log('\n🔧 Düzeltme işlemi başlıyor...\n');

    let fixedCount = 0;
    let skippedCount = 0;

    for (const groupId of Object.keys(byGroup)) {
        const { group, records: toAdd } = byGroup[groupId];
        const currentCount = group.memberIds.length;
        const slotsAvailable = 7 - currentCount;

        if (slotsAvailable <= 0) {
            console.log(`⚠️  "${group.name}" grubu zaten doldu (${currentCount}/7). ${toAdd.length} kişi eklenemedi.`);
            for (const r of toAdd) {
                console.log(`      - "${r.ownerName}" eklenemiyor`);
            }
            skippedCount += toAdd.length;
            continue;
        }

        const canAdd = toAdd.slice(0, slotsAvailable);
        const cannotAdd = toAdd.slice(slotsAvailable);

        for (const record of canAdd) {
            await updateDoc(doc(db, 'groups', groupId), {
                memberIds: arrayUnion(record.id)
            });
            console.log(`   ✅ "${record.ownerName}" → "${group.name}" eklendi`);
            fixedCount++;
        }

        for (const record of cannotAdd) {
            console.log(`   ⚠️  "${record.ownerName}" — "${group.name}" doldu (7/7), eklenemiyor`);
            skippedCount++;
        }
    }

    console.log(`\n🎉 Tamamlandı! ${fixedCount} kişi gruplara eklendi, ${skippedCount} kişi limit nedeniyle eklenemedi.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
