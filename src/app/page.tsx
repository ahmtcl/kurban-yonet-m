'use client';

import { useState, useEffect } from 'react';
import { FiPlusCircle, FiUsers, FiDollarSign, FiTarget, FiAlertTriangle, FiClock, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import { GiCow } from 'react-icons/gi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import type { Record as RecordType, ShareType, Settings } from '@/types';
import RecordEditModal from '@/components/modals/RecordEditModal';
import DueRecordsModal from '@/components/modals/DueRecordsModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'];

export default function Dashboard() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Modals
  const [showDueModal, setShowDueModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(showFeedback = false) {
    setLoading(true);
    try {
      const [recs, types, sett] = await Promise.all([
        getRecords(),
        getShareTypes(),
        getSettings(),
      ]);
      setRecords(recs);
      setShareTypes(types);
      setSettings(sett);
      if (showFeedback) alert('Veriler yenilendi.');
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculations (Excluding cancelled records)
  const activeRecords = records.filter(r => r.status !== 'cancelled');
  const totalRevenue = activeRecords.reduce((s, r) => s + (r.totalPrice || 0), 0);
  const totalCollected = activeRecords.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalRemaining = totalRevenue - totalCollected;
  const now = new Date();

  // Due Records Logic (Excluding cancelled records)

  const overdueRecords = activeRecords.filter(
    (r) =>
      r.dueDate &&
      new Date(r.dueDate) < now &&
      r.depositAmount < (r.totalPrice || 0) &&
      r.depositAmount < 1000 // Only count as "debtor" if paid less than 1000 TL
  );

  // Share type breakdown (Excluding cancelled records)
  const shareBreakdown = shareTypes.map((st) => {
    const typeRecords = activeRecords.filter((r) => r.shareTypeId === st.id);
    const total = typeRecords.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const collected = typeRecords.reduce((s, r) => s + (r.depositAmount || 0), 0);
    const soldCount = typeRecords.length;
    const stockQuantity = st.stockQuantity || 0;
    const remainingStock = stockQuantity - soldCount;
    return {
      name: st.name,
      count: typeRecords.length,
      total,
      collected,
      remaining: total - collected,
      stockQuantity,
      soldCount,
      remainingStock
    };
  });

  const pieData = shareBreakdown.filter((s) => s.count > 0);

  // Custom logic for "Büyükbaş" target tracking (Excluding cancelled records)
  const buyukbasRecords = activeRecords.filter(r => r.shareTypeName?.toLowerCase().includes('büyükbaş'));
  const buyukbasCount = buyukbasRecords.length;

  const targetCount = settings?.targetCount || 100;
  const targetPercentage = Math.min(100, (buyukbasCount / targetCount) * 100);

  const today = new Date();
  
  // 1) Kalan Gün (26 Mayıs Arefe dahil sonuna kadar)
  const arefeDate = new Date('2026-05-27'); // gece 00:00:00 (Yani 26 Mayıs sonu)
  const diffTimeArefe = arefeDate.getTime() - today.getTime();
  const daysLeftForSales = Math.max(0, Math.ceil(diffTimeArefe / (1000 * 60 * 60 * 24))); // Arefe dahil toplam kalan gün

  // 2) Günlük Satış Hedefi için hesaplanacak olan günler (25 Mayıs dahil sonuna kadar)
  const targetEndDate = new Date('2026-05-26'); // gece 00:00:00 (Yani 25 Mayıs sonu)
  const diffTimeTarget = targetEndDate.getTime() - today.getTime();
  const targetDaysLeft = Math.max(0, Math.ceil(diffTimeTarget / (1000 * 60 * 60 * 24)));

  const remainingCount = Math.max(0, targetCount - buyukbasCount);
  
  // Eğer satış yapılabilecek günler bittiyse (veya 0 kaldıysa), kalan tutarın tamamı bugünün hedefi olarak gösterilir.
  const dailyTarget = targetDaysLeft > 0 ? (remainingCount / targetDaysLeft).toFixed(1) : remainingCount;

  // New: Today's sales calculation
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const buyukbasToday = buyukbasRecords.filter(r => {
    if (!r.createdAt) return false;
    // Handle both Firestore Timestamp and JS Date
    const recordDate = (r.createdAt as any).toDate ? (r.createdAt as any).toDate() : new Date(r.createdAt);
    return recordDate >= todayStart;
  }).length;

  if (loading || authLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="top-bar">
        <h2>📊 Ana Sayfa</h2>
        <div className="top-bar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => loadData(true)} title="Sayfayı Yenile">
            <FiRefreshCw /> Yenile
          </button>
          <Link href="/kayit" className="btn btn-primary">
            <FiPlusCircle /> Yeni Kayıt
          </Link>
        </div>
      </div>

      <div className="page-content">

        {/* Row 1: Summary Statistics */}
        <div className="stats-grid">
          {/* Total Shares & Target Progress */}
          <div className="stat-card primary" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ffffff 100%)', textAlign: 'left', position: 'relative' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              BÜYÜKBAŞ HİSSELERİN SATIŞ TOPLAMI: <span style={{ color: '#4338ca' }}>{buyukbasCount}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>
              TOPLAM SATIŞ HEDEFİ: <span style={{ color: '#4338ca' }}>{targetCount}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                  BUGÜN HEDEF: {dailyTarget}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                  BUGÜN SATILAN: {buyukbasToday}
                </div>
              </div>

              {/* Kalan Gün Badge */}
              <div style={{ 
                background: '#e2e8f0', 
                borderRadius: '8px', 
                padding: '6px 16px', 
                textAlign: 'center', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #cbd5e1'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>KALAN</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>GÜN</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>{daysLeftForSales}</div>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: '#64748b' }}>
                <span>Hedef İlerleme</span>
                <span style={{ fontWeight: 700 }}>%{targetPercentage.toFixed(1)}</span>
              </div>
              <div style={{ width: '100%', height: 8, background: '#cbd5e1', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${targetPercentage}%`,
                  height: '100%',
                  background: targetPercentage >= 100 ? '#10b981' : '#6366f1',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon"><FiDollarSign /></div>
            <div className="stat-value">{totalCollected.toLocaleString('tr-TR')} ₺</div>
            <div className="stat-label">Toplanan Tutar</div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon"><FiClock /></div>
            <div className="stat-value">{totalRemaining.toLocaleString('tr-TR')} ₺</div>
            <div className="stat-label">Kalan Tutar</div>
          </div>


          {/* Vadesi Gelenler Widget - Clickable */}
          <div
            className="stat-card danger"
            style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid #fca5a5', background: '#fef2f2' }}
            onClick={() => setShowDueModal(true)}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div className="stat-icon"><FiAlertTriangle /></div>
            <div className="stat-value" style={{ color: '#dc2626' }}>{overdueRecords.length}</div>
            <div className="stat-label" style={{ color: '#b91c1c', fontWeight: 600 }}>Vadesi Gelen / Geçen</div>
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Detaylar için tıklayın →</div>
          </div>
        </div>

        {/* Row 2: Share Type Breakdowns (Cards) */}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 16, display: 'flex', alignItems: 'center' }}>
          <FiUsers style={{ marginRight: 8 }} /> Hisse Durum Özeti
        </h3>
        <div className="groups-grid" style={{ marginBottom: 28 }}>
          {shareBreakdown.map((sb) => (
            <div key={sb.name} className="card" style={{ padding: 16, borderTop: '4px solid #6366f1' }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 8 }}>{sb.name}</h4>
              {sb.stockQuantity > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#666', fontSize: 13 }}>HİSSE STOK ADEDİ:</span>
                    <span style={{ fontWeight: 600 }}>{sb.stockQuantity}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#666', fontSize: 13 }}>SATILAN HİSSE ADEDİ:</span>
                    <span style={{ fontWeight: 600, color: '#6366f1' }}>{sb.soldCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#666', fontSize: 13 }}>KALAN STOK ADEDİ:</span>
                    <span style={{ fontWeight: 700, color: sb.remainingStock > 0 ? '#10b981' : sb.remainingStock === 0 ? '#f59e0b' : '#ef4444' }}>{sb.remainingStock}</span>
                  </div>
                  <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                      <div style={{
                        width: `${sb.stockQuantity > 0 ? Math.min(100, (sb.soldCount / sb.stockQuantity) * 100) : 0}%`,
                        height: '100%',
                        background: sb.remainingStock > 0 ? '#6366f1' : '#ef4444',
                        borderRadius: 2
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4, textAlign: 'right' }}>
                      %{sb.stockQuantity > 0 ? ((sb.soldCount / sb.stockQuantity) * 100).toFixed(0) : 0} Satıldı
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666', fontSize: 13 }}>TOPLAM SATIŞ TUTARI:</span>
                <span style={{ fontWeight: 600 }}>{sb.total.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666', fontSize: 13 }}>KALAN BAKİYE:</span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>{sb.remaining.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
                <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                  <div style={{
                    width: `${sb.total > 0 ? (sb.collected / sb.total) * 100 : 0}%`,
                    height: '100%',
                    background: '#10b981',
                    borderRadius: 2
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, textAlign: 'right' }}>
                  %{sb.total > 0 ? ((sb.collected / sb.total) * 100).toFixed(0) : 0} Tahsilat
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Row 3: Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Bar Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><FiTrendingUp style={{ marginRight: 8 }} /> Hisse Tipi Dağılımı</h3>
            </div>
            {shareBreakdown.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer>
                  <BarChart data={shareBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        color: '#333',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="count" name="Hissedar Sayısı" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <p>Henüz veri yok</p>
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><FiTarget style={{ marginRight: 8 }} /> Gelir Dağılımı</h3>
            </div>
            {pieData.length > 0 ? (
              <div className="chart-container" style={{ display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={5}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => `${(value || 0).toLocaleString('tr-TR')} ₺`}
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        color: '#333',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <p>Henüz veri yok</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Due Records Modal */}
      {showDueModal && (
        <DueRecordsModal
          records={overdueRecords}
          onClose={() => setShowDueModal(false)}
          onSelectRecord={(r) => {
            setSelectedRecord(r);
            // Keep Due Modal open? Or close it? 
            // Let's keep it open so they can go back easily, 
            // BUT current modal backdrop logic might overlap.
            // For simplicity, let's close Due Modal or just stack them.
            // Stacking works if z-index is handled or if we just switch logic.
            // Better UX: Close due list, open edit. When edit closes, maybe re-open due list?
            // For now, let's just open the edit modal on top (if z-index allows) or close this one.
            // Let's close this one to avoid complex state management for now.
            setShowDueModal(false);
          }}
        />
      )}

      {/* Edit Record Modal */}
      {selectedRecord && (
        <RecordEditModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          isAdminView={false}
          onSave={() => {
            loadData();
          }}
        />
      )}
    </>
  );
}
