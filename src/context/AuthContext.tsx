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
            console.log('🔐 Login attempt:', { username, domain: window.location.hostname });
            const cleanUsername = username.trim();
            const cleanPassword = password.trim();
            
            console.log('📡 Fetching user from Firestore...');
            const dbUser = await getUserByUsername(cleanUsername);
            console.log('✅ User fetched:', dbUser ? 'User found' : '❌ User not found');

            // Note: In a production app, use proper hashing. 
            // For now, simple check as requested "id ve psw gereksin".
            if (dbUser && dbUser.password === cleanPassword) {
                console.log('✅ Password match, logging in...');
                const { password: _, ...safeUser } = dbUser;
                setUser(safeUser as User);
                localStorage.setItem('kurban_user', JSON.stringify(safeUser));
                return true;
            }
            console.warn('❌ Invalid credentials');
            return false;
        } catch (error) {
            console.error('❌ Login error:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                domain: window.location.hostname,
                firebaseConfig: '(check console for Firebase init errors)'
            });
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
