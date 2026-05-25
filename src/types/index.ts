export interface ShareType {
    id: string;
    name: string;
    minKg: number;
    maxKg: number;
    price: number;
    isActive: boolean;
    stockQuantity: number;
    kucukbasType?: 'buyukbas' | 'kucukbas-normal' | 'kucukbas-indirimli';
    createdAt: Date;
}

export interface SMSTemplate {
    id: string;
    label: string;
    text: string;
}

export type UserRole = 'admin' | 'employee';

export interface User {
    id: string;
    username: string;
    password?: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
}

export type PaymentType = 'nakit' | 'kredi_karti' | 'havale' | 'online_kredi_karti' | 'teslimatta';

export interface Record {
    id: string;
    ownerName: string;
    phone: string;
    phoneBackup: string;
    shareTypeId: string;
    shareTypeName?: string;
    totalPrice: number;
    depositAmount: number;
    paymentType: PaymentType;
    dueDate: Date | null;
    groupId: string | null;
    daySelection: 1 | 2 | 3;
    notes: string;
    smsVerified: boolean;
    orderNumber?: number;
    status: 'waiting_approval' | 'approved' | 'cancelled' | 'pending_cancellation'; // Added status
    createdAt: Date;
    updatedAt?: Date; // Added updatedAt
    createdBy: string; // Full name of creator
    createdById?: string; // ID of creator
}

export interface Group {
    id: string;
    name: string;
    shareTypeId: string;
    shareTypeName?: string;
    description: string;
    memberIds: string[];
    kesimSiraNo?: number | null;
    videoUrl?: string | null; // Custom domain URL (hisse.ankaraetkurban.com)
    firebaseVideoUrl?: string | null; // Direct Firebase Storage URL
    videoSmsSent?: boolean;
    createdAt: Date;
}

export interface Settings {
    targetCount: number;
    day1Label: string;
    day2Label: string;
    companyName: string;
    companyTitle: string;
    daySelectionDefault: 1 | 2 | 3;
    activeDay: 1 | 2 | 3; // Locked day for new records
    moveButtonEnabled: boolean;
    lastOrderNumber?: number; // Added for auto-increment
    smsTemplates: SMSTemplate[]; // New dynamic templates
    // New Record Admin SMS Notification
    newRecordSmsEnabled: boolean;
    newRecordSmsNumbers: string; // Comma-separated phone numbers
    newRecordSmsTemplate: string; // Template with {SIPARIS_NO}, {HISSE_TIPI}, {AD_SOYAD}
    groupsLockedDay1: boolean;
    groupsLockedDay2: boolean;
}

export interface DashboardStats {
    totalRecords: number;
    totalSharesSold: number;
    totalRevenue: number;
    totalCollected: number;
    totalRemaining: number;
    targetCount: number;
    shareTypeBreakdown: {
        name: string;
        count: number;
        total: number;
    }[];
    overdueRecords: number;
    pendingRecords: number;
}

export interface AppNotification {
    id: string;
    type: 'cancellation_request' | 'system' | 'info';
    title: string;
    message: string;
    recordId?: string;
    orderNumber?: number;
    isRead: boolean;
    createdAt: Date;
}

export interface VekaletSession {
    id: string;
    day: 1 | 2 | 3;
    label: string;          // örn. "1. Gün — 1. Liste" veya "Ek Liste #2"
    recordIds: string[];    // bu PDF'e dahil edilen kayıt id'leri
    count: number;
    createdAt: Date;
    createdBy: string;
}
