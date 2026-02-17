export interface ShareType {
    id: string;
    name: string;
    minKg: number;
    maxKg: number;
    price: number;
    isActive: boolean;
    createdAt: Date;
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
    status: 'waiting_approval' | 'approved'; // Added status
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
