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

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'];

export default function Dashboard() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showDueModal, setShowDueModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

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

  // Calculations
  const totalRevenue = records.reduce((s, r) => s + (r.totalPrice || 0), 0);
  const totalCollected = records.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalRemaining = totalRevenue - totalCollected;
  const now = new Date();

  // Due Records Logic
  const overdueRecords = records.filter(
    (r) => r.dueDate && new Date(r.dueDate) < now && r.depositAmount < (r.totalPrice || 0)
  );

  // Share type breakdown
  const shareBreakdown = shareTypes.map((st) => {
    const typeRecords = records.filter((r) => r.shareTypeId === st.id);
    const total = typeRecords.reduce((s, r) => s + (r.totalPrice || 0), 0);
    const collected = typeRecords.reduce((s, r) => s + (r.depositAmount || 0), 0);
    return {
      name: st.name,
      count: typeRecords.length,
      total,
      collected,
      remaining: total - collected
    };
  });

  const pieData = shareBreakdown.filter((s) => s.count > 0);
  const targetCount = settings?.targetCount || 100;
  const currentCount = records.length;
  const targetPercentage = Math.min(100, (currentCount / targetCount) * 100);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

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
          <div className="stat-card primary" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ffffff 100%)' }}>
            <div className="stat-icon"><GiCow /></div>
            <div className="stat-value" style={{ color: '#4338ca' }}>{currentCount}</div>
            <div className="stat-label">Toplam Hissedar</div>

            {/* Target Progress Bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2, color: '#666' }}>
                <span>Hedef: {targetCount}</span>
                <span>%{targetPercentage.toFixed(1)}</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#cbd5e1', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${targetPercentage}%`,
                  height: '100%',
                  background: targetPercentage >= 100 ? '#10b981' : '#6366f1',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4, textAlign: 'right' }}>
                {Math.max(0, targetCount - currentCount)} kişi kaldı
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666', fontSize: 13 }}>Adet:</span>
                <span style={{ fontWeight: 600 }}>{sb.count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666', fontSize: 13 }}>Toplam:</span>
                <span style={{ fontWeight: 600 }}>{sb.total.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666', fontSize: 13 }}>Kalan:</span>
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
                      formatter={(value: number) => `${value.toLocaleString('tr-TR')} ₺`}
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
          onSave={() => {
            loadData();
          }}
        />
      )}
    </>
  );
}
