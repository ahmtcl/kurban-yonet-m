'use client';

import { FiList, FiTag, FiScissors, FiGrid, FiXCircle } from 'react-icons/fi';

const documents = [
    { label: 'Tahsilat Listesi', icon: <FiList size={36} />, color: '#3b82f6' },
    { label: 'Etiket',           icon: <FiTag size={36} />,  color: '#10b981' },
    { label: 'Kesim Listesi',    icon: <FiScissors size={36} />, color: '#f59e0b' },
    { label: 'Padok Listesi',    icon: <FiGrid size={36} />, color: '#8b5cf6' },
    { label: 'İptal Edilenler',  icon: <FiXCircle size={36} />, color: '#ef4444' },
];

export default function DokumanlarPage() {
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
                    {documents.map(({ label, icon, color }) => (
                        <button
                            key={label}
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
        </>
    );
}
