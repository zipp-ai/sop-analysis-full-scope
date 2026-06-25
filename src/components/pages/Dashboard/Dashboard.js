import React, { useState, useEffect } from 'react';
import Navigation from '../../common/Navigation/Navigation';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import supabase from '../../../supabase';
import './Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSOPs: 0,
    readySOPs: 0,
    duplicateClusters: 0,
    analysesRun: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [sopsRes, analysesRes, clustersRes] = await Promise.all([
          supabase.from('sop_documents').select('id, status', { count: 'exact' }),
          supabase.from('duplicate_analyses').select('id', { count: 'exact' }),
          supabase.from('duplicate_clusters').select('id', { count: 'exact' }),
        ]);

        const sops = sopsRes.data || [];
        setStats({
          totalSOPs: sopsRes.count || 0,
          readySOPs: sops.filter(s => s.status === 'ready').length,
          duplicateClusters: clustersRes.count || 0,
          analysesRun: analysesRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total SOPs', value: stats.totalSOPs, color: '#6c63ff' },
    { title: 'Processed SOPs', value: stats.readySOPs, color: '#22c55e' },
    { title: 'Analyses Run', value: stats.analysesRun, color: '#f59e0b' },
    { title: 'Duplicate Clusters', value: stats.duplicateClusters, color: '#ef4444' },
  ];

  return (
    <div className="dashboard">
      <Navigation />
      <main className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome back</h2>
          <p>SOP Lifecycle Intelligence — Duplicate Detection, Simplification & Regulatory Monitoring</p>
        </div>

        <div className="stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className="stat-card">
              <h3>{stat.title}</h3>
              <div className="stat-value-container">
                {loading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <p style={{ color: stat.color }}>{stat.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="recent-updates">
          <h3>Pipeline Stages</h3>
          <div className="updates-list">
            <div className="update-item">
              <span className="update-text" style={{ width: '50%', textAlign: 'left' }}>
                Stage 1: Duplicate Detection
              </span>
              <span className="update-time" style={{ width: '50%', textAlign: 'right', color: '#22c55e' }}>
                Active
              </span>
            </div>
            <div className="update-item">
              <span className="update-text" style={{ width: '50%', textAlign: 'left' }}>
                Stage 2: Simplification
              </span>
              <span className="update-time" style={{ width: '50%', textAlign: 'right', color: '#94a3b8' }}>
                Coming Soon
              </span>
            </div>
            <div className="update-item">
              <span className="update-text" style={{ width: '50%', textAlign: 'left' }}>
                Stage 3: Regulatory Monitoring
              </span>
              <span className="update-time" style={{ width: '50%', textAlign: 'right', color: '#94a3b8' }}>
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
