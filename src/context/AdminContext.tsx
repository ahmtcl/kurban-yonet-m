'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminContextType {
    isAdmin: boolean;
    login: (password: string) => boolean;
    logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const storedAuth = localStorage.getItem('kurban_admin_auth');
        if (storedAuth === 'true') {
            setIsAdmin(true);
        }
    }, []);

    const login = (password: string) => {
        // Hardcoded password for simplicity as requested "id ve psw gereksin"
        // In a real app, strict auth is needed.
        if (password === 'admin123') {
            setIsAdmin(true);
            localStorage.setItem('kurban_admin_auth', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAdmin(false);
        localStorage.removeItem('kurban_admin_auth');
    };

    return (
        <AdminContext.Provider value={{ isAdmin, login, logout }}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
}
