'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNavbar from '@/components/layout/MobileNavbar';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useAuth();

    return (
        <div className="layout-container">
            {user && (
                <MobileNavbar onMenuClick={() => setSidebarOpen(true)} />
            )}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
