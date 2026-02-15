'use client';

import { useState, useEffect } from 'react';
import { FiPlusCircle, FiUsers, FiDollarSign, FiTarget, FiAlertTriangle, FiClock, FiTrendingUp } from 'react-icons/fi';
import { GiCow } from 'react-icons/gi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { getRecords, getShareTypes, getSettings } from '@/lib/firestore';
import type { Record as RecordType, ShareType, Settings } from '@/types';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff'];

export default function Dashboard() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [recs, types, sett] = await Promise.all([
        getRecords(),
        getShareTypes(),
        getSettings(),
      ]);
      setRecords(recs);
      setShareTypes(types);
      setSettings(sett);
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

  const overdueRecords = records.filter(
    (r) => r.dueDate && new Date(r.dueDate) < now && r.depositAmount < (r.totalPrice || 0)
  );
  const pendingRecords = records.filter(
    (r) => r.depositAmount < (r.totalPrice || 0)
  );

  // Share type breakdown
  const shareBreakdown = shareTypes.map((st) => {
    const typeRecords = records.filter((r) => r.shareTypeId === st.id);
    return {
      name: st.name,
      count: typeRecords.length,
      total: typeRecords.reduce((s, r) => s + (r.totalPrice || 0), 0),
      collected: typeRecords.reduce((s, r) => s + (r.depositAmount || 0), 0),
    };
  });

  const pieData = shareBreakdown.filter((s) => s.count > 0);

  // Recent overdue records for quick view
  const recentOverdue = overdueRecords.slice(0, 5);

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
          <Link href="/kayit" className="btn btn-primary">
            <FiPlusCircle /> Yeni Kayıt
          </Link>
        </div>
      </div>

      <div className="page-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon"><GiCow /></div>
            <div className="stat-value">{records.length}</div>
            <div className="stat-label">Toplam Hissedar</div>
            {settings && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Hedef: {settings.targetCount} | Kalan: {Math.max(0, settings.targetCount - records.length)}
              </div>
            )}
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

          <div className="stat-card danger">
            <div className="stat-icon"><FiAlertTriangle /></div>
            <div className="stat-value">{overdueRecords.length}</div>
            <div className="stat-label">Vadesi Geçen</div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Bar Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><FiTrendingUp style={{ marginRight: 8 }} /> Hisse Tipi Dağılımı</h3>
            </div>
            {shareBreakdown.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer>
                  <BarChart data={shareBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#1e2235',
                        border: '1px solid #2a2f45',
                        borderRadius: 8,
                        color: '#f1f5f9',
                      }}
                    />
                    <Bar dataKey="count" name="Hissedar Sayısı" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <p>Henüz hisse tipi tanımlanmamış</p>
                <Link href="/admin" className="btn btn-primary btn-sm">Hisse Tipi Ekle</Link>
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
                      outerRadius={100}
                      innerRadius={50}
                      paddingAngle={3}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1e2235',
                        border: '1px solid #2a2f45',
                        borderRadius: 8,
                        color: '#f1f5f9',
                      }}
                      formatter={(value?: number) => `${(value || 0).toLocaleString('tr-TR')} ₺`}
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

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Overdue Records */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ color: 'var(--accent-danger)' }}>
                <FiAlertTriangle style={{ marginRight: 8 }} /> Vadesi Geçenler
              </h3>
              <Link href="/kayitlar" className="btn btn-ghost btn-sm">Tümünü Gör</Link>
            </div>
            {recentOverdue.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Kalan</th>
                      <th>Vade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOverdue.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.ownerName}</td>
                        <td>
                          <span className="badge badge-danger">
                            {((r.totalPrice || 0) - r.depositAmount).toLocaleString('tr-TR')} ₺
                          </span>
                        </td>
                        <td style={{ color: 'var(--accent-danger)' }}>
                          {r.dueDate ? new Date(r.dueDate).toLocaleDateString('tr-TR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <p>🎉 Vadesi geçen kayıt yok</p>
              </div>
            )}
          </div>

          {/* Quick Stats per Share Type */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FiUsers style={{ marginRight: 8 }} /> Hisse Tipi Detayları
              </h3>
            </div>
            {shareBreakdown.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Hisse Tipi</th>
                      <th>Adet</th>
                      <th>Toplam</th>
                      <th>Toplanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareBreakdown.map((sb) => (
                      <tr key={sb.name}>
                        <td style={{ fontWeight: 500 }}>{sb.name}</td>
                        <td>{sb.count}</td>
                        <td>{sb.total.toLocaleString('tr-TR')} ₺</td>
                        <td>
                          <span className="badge badge-success">
                            {sb.collected.toLocaleString('tr-TR')} ₺
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700 }}>
                      <td>TOPLAM</td>
                      <td>{records.length}</td>
                      <td>{totalRevenue.toLocaleString('tr-TR')} ₺</td>
                      <td>
                        <span className="badge badge-success">
                          {totalCollected.toLocaleString('tr-TR')} ₺
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <p>Henüz hisse tipi tanımlanmamış</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
