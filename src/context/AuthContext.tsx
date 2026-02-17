'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserByUsername } from '@/lib/firestore';
import type { User } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('kurban_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Auth restore failed', e);
            }
        }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const cleanUsername = username.trim();
            const cleanPassword = password.trim();
            const dbUser = await getUserByUsername(cleanUsername);

            // Note: In a production app, use proper hashing. 
            // For now, simple check as requested "id ve psw gereksin".
            if (dbUser && dbUser.password === cleanPassword) {
                const { password: _, ...safeUser } = dbUser;
                setUser(safeUser as User);
                localStorage.setItem('kurban_user', JSON.stringify(safeUser));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error', error);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('kurban_user');
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAdmin: user?.role?.toLowerCase() === 'admin',
            login,
            logout,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
