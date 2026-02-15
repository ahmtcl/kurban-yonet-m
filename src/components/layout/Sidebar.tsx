'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FiHome,
    FiPlusCircle,
    FiUsers,
    FiList,
    FiBarChart2,
    FiSettings,
    FiTag,
    FiRefreshCw,
} from 'react-icons/fi';
import { GiCow } from 'react-icons/gi';

const navItems = [
    { href: '/', label: 'Ana Sayfa', icon: <FiHome /> },
    { href: '/kayit', label: 'Yeni Kayıt', icon: <FiPlusCircle /> },
    { href: '/gruplar', label: 'Gruplar', icon: <FiUsers /> },
    { href: '/kayitlar', label: 'Kayıtlar', icon: <FiList /> },
    { href: '/hisselendirme', label: 'Hisselendirme', icon: <FiTag /> },
    { href: '/raporlar', label: 'Raporlar', icon: <FiBarChart2 /> },
    { href: '/admin', label: 'Admin Panel', icon: <FiSettings /> },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">
                    <GiCow />
                </div>
                <h1>Kurban Yönetim</h1>
            </div>
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const isActive =
                        item.href === '/'
                            ? pathname === '/'
                            : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div style={{ padding: '12px' }}>
                <button
                    className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => window.location.reload()}
                >
                    <FiRefreshCw /> Yenile (F5)
                </button>
            </div>
        </aside>
    );
}
