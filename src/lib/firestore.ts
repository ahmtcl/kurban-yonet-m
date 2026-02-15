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
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShareType, Record, Group, Settings, PaymentType } from '@/types';

// ===== SHARE TYPES =====
export async function getShareTypes(): Promise<ShareType[]> {
    const q = query(collection(db, 'shareTypes'), orderBy('minKg', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        minKg: d.data().minKg,
        maxKg: d.data().maxKg,
        price: d.data().price,
        isActive: d.data().isActive ?? true,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
    }));
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
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        createdBy: d.data().createdBy || '',
    }));
}

export async function addRecord(data: Omit<Record, 'id' | 'createdAt'>) {
    const { id, ...rest } = data as Record & { id?: string };
    return addDoc(collection(db, 'records'), {
        ...rest,
        dueDate: rest.dueDate ? Timestamp.fromDate(new Date(rest.dueDate)) : null,
        createdAt: serverTimestamp(),
    });
}

export async function updateRecord(id: string, data: Partial<Record>) {
    const cleanData: { [key: string]: unknown } = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === 'id' || key === 'createdAt') continue;
        if (key === 'dueDate' && value) {
            cleanData[key] = Timestamp.fromDate(new Date(value as string));
        } else {
            cleanData[key] = value;
        }
    }
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
        createdAt: d.createdAt?.toDate?.() || new Date(),
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
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        createdBy: d.data().createdBy || '',
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
        };
        await setDoc(doc(db, 'settings', 'general'), defaults);
        return defaults;
    }
    return snap.data() as Settings;
}

export async function updateSettings(data: Partial<Settings>) {
    return setDoc(doc(db, 'settings', 'general'), data, { merge: true });
}
