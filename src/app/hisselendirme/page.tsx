'use client';

import { FiTag } from 'react-icons/fi';

export default function HisselendirmePage() {
    return (
        <>
            <div className="top-bar">
                <h2>🏷️ Hisselendirme & Etiket</h2>
            </div>
            <div className="page-content">
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">🏷️</div>
                        <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Hisselendirme & Etiket Oluşturma</h3>
                        <p style={{ maxWidth: 500, margin: '0 auto' }}>
                            Bu modül müşterinin detaylı açıklaması sonrasında geliştirilecektir.
                            Kurban dağıtımı ve etiket oluşturma işlemleri bu sayfadan yapılacaktır.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
