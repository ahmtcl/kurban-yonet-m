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
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShareType, Record, Group, Settings, PaymentType, User } from '@/types';

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
    if (!members.includes(recordId)) {
        await updateDoc(groupRef, { memberIds: [...members, recordId] });
    }
}

export async function removeMemberFromGroup(groupId: string, recordId: string) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;
    const members = (groupSnap.data().memberIds || []).filter((m: string) => m !== recordId);
    await updateDoc(groupRef, { memberIds: members });
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
    if (!snap.exists()) {
        const defaults: Settings = {
            targetCount: 100,
            day1Label: '1. Gün',
            day2Label: '2. Gün',
            companyName: '',
            companyTitle: '',
            daySelectionDefault: 1,
            activeDay: 1,
            moveButtonEnabled: true,
            lastOrderNumber: 59793, // Initialize with 59793 so next is 59794
            smsTemplates: [
                { id: '1', label: 'Ödeme Hatırlatma', text: 'SAYIN {AD_SOYAD}, KURBAN KAYDINIZ ICIN ODEME BEKLENMEKTEDIR. BILGINIZE.' },
                { id: '2', label: 'Grup Bilgisi', text: 'SAYIN {AD_SOYAD}, KURBAN GRUBUNUZ OLUSTURULMUSTUR. SIPARIS NO: {SIPARIS_NO}.' },
                { id: '3', label: 'Kesim Günü', text: 'SAYIN {AD_SOYAD}, KURBANINIZ {KESIM_GUNU}. GUN KESILECEKTIR.' },
            ],
        };
        await setDoc(doc(db, 'settings', 'general'), defaults);
        return defaults;
    }
    return snap.data() as Settings;
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
