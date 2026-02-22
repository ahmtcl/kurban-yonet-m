'use client';

import { GiCow } from 'react-icons/gi';
import { FiMenu, FiLogOut } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

interface MobileNavbarProps {
    onMenuClick: () => void;
}

export default function MobileNavbar({ onMenuClick }: MobileNavbarProps) {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <header className="mobile-navbar">
            <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Menüyü Aç">
                <FiMenu />
            </button>
            <div className="mobile-navbar-logo">
                <div className="logo-icon">
                    <GiCow />
                </div>
                <span>Kurban Yönetim</span>
            </div>
            <button className="mobile-logout-btn" onClick={() => logout()} aria-label="Çıkış Yap">
                <FiLogOut />
            </button>
        </header>
    );
}
