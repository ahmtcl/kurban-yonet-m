'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FiHome,
    FiPlusCircle,
    FiUsers,
    FiList,
    FiBarChart2,
    FiSettings,
    FiTag,
    FiRefreshCw,
    FiLogOut,
    FiX,
    FiBell
} from 'react-icons/fi';
import { GiCow } from 'react-icons/gi';
import { useAuth } from '@/context/AuthContext';
import { getNotifications, markNotificationAsRead } from '@/lib/firestore';
import type { AppNotification } from '@/types';
import { useState, useEffect } from 'react';

const navItems = [
    { href: '/', label: 'Ana Sayfa', icon: <FiHome /> },
    { href: '/kayit', label: 'Yeni Kayıt', icon: <FiPlusCircle /> },
    { href: '/gruplar', label: 'Gruplar', icon: <FiUsers /> },
    { href: '/kayitlar', label: 'Kayıtlar', icon: <FiList /> },
    { href: '/hisselendirme', label: 'Dökümanlar', icon: <FiTag /> },
    { href: '/raporlar', label: 'Raporlar', icon: <FiBarChart2 /> },
    { href: '/admin', label: 'Admin Panel', icon: <FiSettings />, adminOnly: true },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin, user, logout } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            loadNotifications();
            // Refresh every 1 minute
            const interval = setInterval(loadNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [isAdmin]);

    async function loadNotifications() {
        try {
            const all = await getNotifications();
            setNotifications(all);
        } catch (err) {
            console.error('Notifications error:', err);
        }
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    async function handleMarkRead(id: string) {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    }

    async function handleNotificationClick(n: AppNotification) {
        await handleMarkRead(n.id);
        setShowNotifications(false);
        if (n.orderNumber) {
            router.push(`/kayitlar?search=${n.orderNumber}`);
        } else {
            router.push('/kayitlar');
        }
        if (onClose) onClose();
    }

    if (!user) return null;

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div className="sidebar-backdrop" onClick={onClose} />
            )}

            <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-icon">
                        <GiCow />
                    </div>
                    <h1 style={{ flex: 1 }}>Kurban Yönetim</h1>

                    {isAdmin && (
                        <div style={{ position: 'relative', marginRight: 10 }}>
                            <button
                                className="btn btn-icon btn-ghost"
                                onClick={() => setShowNotifications(!showNotifications)}
                                style={{ color: unreadCount > 0 ? 'var(--accent-warning)' : 'inherit' }}
                            >
                                <FiBell />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        background: 'var(--accent-danger)',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: 16,
                                        height: 16,
                                        fontSize: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    width: 250,
                                    maxHeight: 400,
                                    overflowY: 'auto',
                                    zIndex: 100,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    padding: 0
                                }}>
                                    <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                                        Bildirimler
                                        <button className="btn btn-ghost btn-xs" onClick={() => setShowNotifications(false)}>Kapat</button>
                                    </div>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>Bildirim yok.</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                className="notification-item"
                                                style={{
                                                    padding: '10px 15px',
                                                    borderBottom: '1px solid #f5f5f5',
                                                    backgroundColor: n.isRead ? 'transparent' : '#fff9eb',
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onClick={() => handleNotificationClick(n)}
                                            >
                                                <div style={{ fontWeight: n.isRead ? 500 : 700, color: '#333' }}>{n.title}</div>
                                                <div style={{ color: '#666', marginTop: 2 }}>{n.message}</div>
                                                <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                                                    {new Date(n.createdAt).toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Close button only visible on mobile */}
                    <button className="sidebar-close-btn" onClick={onClose} aria-label="Menüyü Kapat">
                        <FiX />
                    </button>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        if (item.adminOnly && !isAdmin) return null;

                        const isActive =
                            item.href === '/'
                                ? pathname === '/'
                                : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => window.location.reload()}
                    >
                        <FiRefreshCw /> Yenile (F5)
                    </button>
                    {user && (
                        <button
                            className="btn btn-outline-danger"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => logout()}
                        >
                            <FiLogOut /> Çıkış Yap
                        </button>
                    )}
                </div>
            </aside >
        </>
    );
}
