import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    Timestamp,
    setDoc,
    runTransaction, // Added runTransaction
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShareType, Record, Group, Settings, PaymentType, User, AppNotification, VekaletSession } from '@/types';

// ===== SHARE TYPES =====
export async function getShareTypes(): Promise<ShareType[]> {
    const q = query(collection(db, 'shareTypes'), orderBy('minKg', 'asc'));
    const snapshot = await getDocs(q);
    const allTypes = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        minKg: d.data().minKg,
        maxKg: d.data().maxKg,
        price: d.data().price,
        isActive: d.data().isActive ?? true,
        stockQuantity: d.data().stockQuantity ?? 0,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
    }));

    // Separate into normal and special (containing %)
    const normalTypes = allTypes.filter(t => !t.name.includes('%'));
    const specialTypes = allTypes.filter(t => t.name.includes('%'));

    return [...normalTypes, ...specialTypes];
}

export async function addShareType(data: Omit<ShareType, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'shareTypes'), {
        ...data,
        createdAt: serverTimestamp(),
    });
}

export async function updateShareType(id: string, data: Partial<ShareType>) {
    const { id: _, createdAt, ...rest } = data as ShareType;
    return updateDoc(doc(db, 'shareTypes', id), rest);
}

export async function deleteShareType(id: string) {
    return deleteDoc(doc(db, 'shareTypes', id));
}

// ===== RECORDS =====
export async function getRecords(): Promise<Record[]> {
    const q = query(collection(db, 'records'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ownerName: d.data().ownerName || '',
        phone: d.data().phone || '',
        phoneBackup: d.data().phoneBackup || '',
        shareTypeId: d.data().shareTypeId || '',
        shareTypeName: d.data().shareTypeName || '',
        totalPrice: d.data().totalPrice || 0,
        depositAmount: d.data().depositAmount || 0,
        paymentType: d.data().paymentType || 'nakit',
        dueDate: d.data().dueDate?.toDate?.() || null,
        groupId: d.data().groupId || null,
        daySelection: d.data().daySelection || 1,
        notes: d.data().notes || '',
        smsVerified: d.data().smsVerified || false,
        orderNumber: d.data().orderNumber,
        status: d.data().status || 'waiting_approval', // Added status
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || null, // Added updatedAt
        createdBy: d.data().createdBy || '',
        createdById: d.data().createdById || '',
    }));
}

export async function addRecord(data: Omit<Record, 'id' | 'createdAt'>) {
    // Check if phone or backup phone exists to prevent duplicates? 
    // For now, focusing on Order Number transaction.

    return runTransaction(db, async (transaction) => {
        // 1. Get Settings for order number
        const settingsRef = doc(db, 'settings', 'general');
        const settingsSnap = await transaction.get(settingsRef);

        let newOrderNumber = 59794; // Default start

        if (settingsSnap.exists()) {
            const currentLast = settingsSnap.data().lastOrderNumber;
            if (typeof currentLast === 'number') {
                newOrderNumber = currentLast + 1;
            }
        } else {
            // Create settings if not exists (shouldn't happen often but safe)
            transaction.set(settingsRef, {
                targetCount: 100,
                companyName: '',
                companyTitle: '',
                activeDay: 1
            }, { merge: true });
        }

        // 2. Create New Record Reference
        const newRecordRef = doc(collection(db, 'records'));
        const { id, ...rest } = data as Record & { id?: string };

        // 3. Set Record Data
        transaction.set(newRecordRef, {
            ...rest,
            orderNumber: newOrderNumber,
            status: rest.status || 'waiting_approval', // Ensure default status
            dueDate: rest.dueDate ? Timestamp.fromDate(new Date(rest.dueDate)) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(), // Set initial update date same as created
        });

        // 4. Update Settings with new lastOrderNumber
        transaction.set(settingsRef, { lastOrderNumber: newOrderNumber }, { merge: true });

        return newRecordRef;
    });
}

export async function updateRecord(id: string, data: Partial<Record>) {
    const cleanData: { [key: string]: unknown } = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue; // Skip manual date setting
        if (key === 'dueDate' && value) {
            cleanData[key] = Timestamp.fromDate(new Date(value as string));
        } else {
            cleanData[key] = value;
        }
    }

    // Always update updatedAt
    cleanData['updatedAt'] = serverTimestamp();

    return updateDoc(doc(db, 'records', id), cleanData);
}

export async function deleteRecord(id: string) {
    return deleteDoc(doc(db, 'records', id));
}

export async function getRecordById(id: string): Promise<Record | null> {
    const snap = await getDoc(doc(db, 'records', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
        id: snap.id,
        ownerName: d.ownerName || '',
        phone: d.phone || '',
        phoneBackup: d.phoneBackup || '',
        shareTypeId: d.shareTypeId || '',
        shareTypeName: d.shareTypeName || '',
        totalPrice: d.totalPrice || 0,
        depositAmount: d.depositAmount || 0,
        paymentType: d.paymentType || 'nakit',
        dueDate: d.dueDate?.toDate?.() || null,
        groupId: d.groupId || null,
        daySelection: d.daySelection || 1,
        notes: d.notes || '',
        smsVerified: d.smsVerified || false,
        orderNumber: d.orderNumber,
        status: d.status || 'waiting_approval', // Added status
        createdAt: d.createdAt?.toDate?.() || new Date(),
        updatedAt: d.updatedAt?.toDate?.() || null,
        createdBy: d.createdBy || '',
    };
}

// ===== GROUPS =====
export async function getGroups(): Promise<Group[]> {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        shareTypeId: d.data().shareTypeId || '',
        shareTypeName: d.data().shareTypeName || '',
        description: d.data().description || '',
        memberIds: d.data().memberIds || [],
        kesimSiraNo: d.data().kesimSiraNo ?? null,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
    }));
}

export async function addGroup(data: Omit<Group, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'groups'), {
        ...data,
        createdAt: serverTimestamp(),
    });
}

export async function updateGroup(id: string, data: Partial<Group>) {
    const { id: _, createdAt, ...rest } = data as Group;
    return updateDoc(doc(db, 'groups', id), rest);
}

export async function deleteGroup(id: string) {
    return deleteDoc(doc(db, 'groups', id));
}

export async function addMemberToGroup(groupId: string, recordId: string) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;
    const members = groupSnap.data().memberIds || [];
    if (members.length >= 7) {
        throw new Error('Bu gruba en fazla 7 üye eklenebilir.');
    }
    await updateDoc(groupRef, { memberIds: arrayUnion(recordId) });
}

export async function removeMemberFromGroup(groupId: string, recordId: string) {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, { memberIds: arrayRemove(recordId) });
}

export async function getGroupMembers(groupId: string): Promise<Record[]> {
    const q = query(collection(db, 'records'), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ownerName: d.data().ownerName || '',
        phone: d.data().phone || '',
        phoneBackup: d.data().phoneBackup || '',
        shareTypeId: d.data().shareTypeId || '',
        shareTypeName: d.data().shareTypeName || '',
        totalPrice: d.data().totalPrice || 0,
        depositAmount: d.data().depositAmount || 0,
        paymentType: d.data().paymentType || 'nakit',
        dueDate: d.data().dueDate?.toDate?.() || null,
        groupId: d.data().groupId || null,
        daySelection: d.data().daySelection || 1,
        notes: d.data().notes || '',
        smsVerified: d.data().smsVerified || false,
        orderNumber: d.data().orderNumber,
        status: d.data().status || 'waiting_approval', // Added status
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || null,
        createdBy: d.data().createdBy || '',
        createdById: d.data().createdById || '',
    }));
}

// ===== SETTINGS =====
export async function getSettings(): Promise<Settings> {
    const snap = await getDoc(doc(db, 'settings', 'general'));
        const d = snap.data() || {};
        // Varsayılan şablonlar
        const defaultTemplates: import('@/types').SMSTemplate[] = [
            {
                id: 'verification',
                label: 'Doğrulama Kodu',
                text: 'Sayın {AD_SOYAD}, doğrulama kodunuz: {KOD}'
            },
            {
                id: 'record_info',
                label: 'Kayıt Bilgilendirme',
                text: 'Sayın {AD_SOYAD}, kaydınız başarıyla oluşturuldu. Sipariş No: {SIPARIS_NO}, Kesim Günü: {KESIM_GUNU}'
            }
        ];
        let smsTemplates: import('@/types').SMSTemplate[] = Array.isArray(d.smsTemplates) ? d.smsTemplates : [];
        // Eksikse varsayılanları ekle (id ile kontrol)
        defaultTemplates.forEach((def) => {
            if (!smsTemplates.some((t: import('@/types').SMSTemplate) => t.id === def.id)) smsTemplates.push(def);
        });
        return {
            targetCount: d.targetCount || 100,
            day1Label: d.day1Label || '1. Gün',
            day2Label: d.day2Label || '2. Gün',
            companyName: d.companyName || '',
            companyTitle: d.companyTitle || '',
            daySelectionDefault: d.daySelectionDefault || 1,
            activeDay: d.activeDay || 1,
            moveButtonEnabled: d.moveButtonEnabled ?? true,
            lastOrderNumber: d.lastOrderNumber,
            smsTemplates,
            newRecordSmsEnabled: d.newRecordSmsEnabled ?? false,
            newRecordSmsNumbers: d.newRecordSmsNumbers || '',
            newRecordSmsTemplate: d.newRecordSmsTemplate || '',
            groupsLockedDay1: d.groupsLockedDay1 ?? false,
            groupsLockedDay2: d.groupsLockedDay2 ?? false,
        };
}

export async function updateSettings(data: Partial<Settings>) {
    return setDoc(doc(db, 'settings', 'general'), data, { merge: true });
}

// ===== USERS =====
export async function getUsers(): Promise<User[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(widow => ({
        id: widow.id,
        ...widow.data(),
        createdAt: widow.data().createdAt?.toDate?.() || new Date(),
    } as User));
}

export async function addUser(user: Omit<User, 'id' | 'createdAt'>) {
    return addDoc(collection(db, 'users'), {
        ...user,
        createdAt: serverTimestamp(),
    });
}

export async function updateUser(id: string, user: Partial<User>) {
    const { id: _, createdAt, ...rest } = user as User;
    return updateDoc(doc(db, 'users', id), rest);
}

export async function deleteUser(id: string) {
    return deleteDoc(doc(db, 'users', id));
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const q = query(collection(db, 'users'), where('username', '==', username), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.() || new Date() } as User;
}

// ===== NOTIFICATIONS =====
export async function getNotifications(): Promise<AppNotification[]> {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
    } as AppNotification));
}

export async function addNotification(data: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) {
    return addDoc(collection(db, 'notifications'), {
        ...data,
        isRead: false,
        createdAt: serverTimestamp(),
    });
}

export async function markNotificationAsRead(id: string) {
    return updateDoc(doc(db, 'notifications', id), { isRead: true });
}

export async function clearNotifications() {
    const q = query(collection(db, 'notifications'), where('isRead', '==', true));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    return Promise.all(deletePromises);
}

// ===== STOCK CONTROL =====
export async function checkStockAvailability(shareTypeId: string): Promise<{ available: boolean; remaining: number; stockDefined: boolean }> {
    const shareTypeSnap = await getDoc(doc(db, 'shareTypes', shareTypeId));
    if (!shareTypeSnap.exists()) return { available: false, remaining: 0, stockDefined: false };
    
    const data = shareTypeSnap.data();
    const stockQuantity = data.stockQuantity || 0;
    
    // If stock is not defined (0), block sales
    if (stockQuantity === 0) {
        return { available: false, remaining: 0, stockDefined: false };
    }
    
    // Count active records (avoid != query which needs composite index)
    const q = query(collection(db, 'records'), where('shareTypeId', '==', shareTypeId));
    const snapshot = await getDocs(q);
    const soldCount = snapshot.docs.filter(d => d.data().status !== 'cancelled').length;
    
    const remaining = stockQuantity - soldCount;
    return {
        available: remaining > 0,
        remaining: remaining,
        stockDefined: true
    };
}

// ===== VEKALET SESSIONS =====
export async function getVekaletSessions(day?: 1 | 2 | 3): Promise<VekaletSession[]> {
    // Composite index gerektirmemek için client-side filtre + sıralama kullanılıyor
    const q = query(collection(db, 'vekaletSessions'));
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(d => ({
        id: d.id,
        day: d.data().day,
        label: d.data().label || '',
        recordIds: d.data().recordIds || [],
        count: d.data().count || 0,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        createdBy: d.data().createdBy || '',
    })) as VekaletSession[];
    const filtered = day ? all.filter(s => s.day === day) : all;
    return filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function addVekaletSession(data: Omit<VekaletSession, 'id' | 'createdAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'vekaletSessions'), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function deleteVekaletSession(id: string) {
    return deleteDoc(doc(db, 'vekaletSessions', id));
}
