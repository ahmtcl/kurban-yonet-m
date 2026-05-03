'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiList, FiTag, FiScissors, FiGrid, FiXCircle, FiFileText } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import KesimListesiModal from '@/components/modals/KesimListesiModal';
import TahsilatListesiModal from '@/components/modals/TahsilatListesiModal';
import EtiketModal from '@/components/modals/EtiketModal';
import PadokListesiModal from '@/components/modals/PadokListesiModal';
import IptalEdilenlerModal from '@/components/modals/IptalEdilenlerModal';
import VekaletListesiModal from '@/components/modals/VekaletListesiModal';

export default function DokumanlarPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();

    if (!isAdmin) {
        router.replace('/');
        return null;
    }

    const [showKesimListesi, setShowKesimListesi]     = useState(false);
    const [showTahsilatListesi, setShowTahsilatListesi] = useState(false);
    const [showEtiket, setShowEtiket]                   = useState(false);
    const [showPadokListesi, setShowPadokListesi]       = useState(false);
    const [showIptalEdilenler, setShowIptalEdilenler]   = useState(false);
    const [showVekalet, setShowVekalet]                   = useState(false);

    const documents = [
        { label: 'Tahsilat Listesi', icon: <FiList size={36} />,    color: '#3b82f6', onClick: () => setShowTahsilatListesi(true) },
        { label: 'Etiket',           icon: <FiTag size={36} />,     color: '#10b981', onClick: () => setShowEtiket(true) },
        { label: 'Kesim Listesi',    icon: <FiScissors size={36} />, color: '#f59e0b', onClick: () => setShowKesimListesi(true) },
        { label: 'Padok Listesi',    icon: <FiGrid size={36} />,    color: '#8b5cf6', onClick: () => setShowPadokListesi(true) },
        { label: 'İptal Edilenler',  icon: <FiXCircle size={36} />,  color: '#ef4444', onClick: () => setShowIptalEdilenler(true) },
        { label: 'Vekalet Listesi',  icon: <FiFileText size={36} />, color: '#0891b2', onClick: () => setShowVekalet(true) },
    ];

    return (
        <>
            <div className="top-bar">
                <h2>📄 Dökümanlar</h2>
            </div>
            <div className="page-content">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1.5rem',
                    padding: '0.5rem 0',
                }}>
                    {documents.map(({ label, icon, color, onClick }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                padding: '2rem 1rem',
                                background: 'var(--card-bg, #1e293b)',
                                border: `2px solid ${color}33`,
                                borderRadius: '1rem',
                                cursor: 'pointer',
                                color: color,
                                fontSize: '1.05rem',
                                fontWeight: 600,
                                transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 24px ${color}44`;
                                (e.currentTarget as HTMLButtonElement).style.borderColor = color;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.transform = '';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                                (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}33`;
                            }}
                        >
                            {icon}
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {showKesimListesi && (
                <KesimListesiModal onClose={() => setShowKesimListesi(false)} />
            )}

            {showTahsilatListesi && (
                <TahsilatListesiModal onClose={() => setShowTahsilatListesi(false)} />
            )}

            {showEtiket && (
                <EtiketModal onClose={() => setShowEtiket(false)} />
            )}

            {showPadokListesi && (
                <PadokListesiModal onClose={() => setShowPadokListesi(false)} />
            )}

            {showIptalEdilenler && (
                <IptalEdilenlerModal onClose={() => setShowIptalEdilenler(false)} />
            )}

            {showVekalet && (
                <VekaletListesiModal onClose={() => setShowVekalet(false)} />
            )}
        </>
    );
}
