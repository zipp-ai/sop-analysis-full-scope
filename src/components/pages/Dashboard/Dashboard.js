import React, { useState, useEffect } from 'react';
import Navigation from '../../common/Navigation/Navigation';
import Layout from '../../common/Layout/Layout';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import userService from '../../../services/userService';
import { formatDate } from '../../../utils/dateUtils';
import './Dashboard.css';
import toastService from '../../../services/toastService';

const Dashboard = () => {
  const [loading, setLoading] = useState({
    sops: true,
    regulations: true,
    gaps: true,
    activities: true
  });
  const [recentActivities, setRecentActivities] = useState([]);

  const [stats, setStats] = useState([
    { title: 'Total SOPs', value: '...', color: '#666', loading: true },
    { title: 'Total Regulations', value: '...', color: '#f39c12', loading: true },
    { title: "Identified Gaps", value: '...', color: '#d63031', loading: true },
  ]);

  useEffect(() => {
    const fetchSOPCount = async () => {
      try {
        const data = await userService.getSOPsCount();
        const totalSopCount = data.total_count.toString();

        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[0] = { ...newStats[0], value: totalSopCount, loading: false };
          return newStats;
        });
      } catch (error) {
        console.error('Error fetching SOPs count:', error);
        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[0] = { ...newStats[0], value: 'N/A', loading: false };
          return newStats;
        });
      } finally {
        setLoading(prev => ({ ...prev, sops: false }));
      }
    };

    const fetchRegulationsCount = async () => {
      try {
        const data = await userService.getRegulationsCount();
        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[1] = { ...newStats[1], value: data.count.toString(), loading: false };
          return newStats;
        });
      } catch (error) {
        console.error('Error fetching regulations count:', error);
        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[1] = { ...newStats[1], value: 'N/A', loading: false };
          return newStats;
        });
      } finally {
        setLoading(prev => ({ ...prev, regulations: false }));
      }
    };

    const fetchGapCount = async () => {
      try {
        const data = await userService.getGapCount();
        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[2] = { ...newStats[2], value: data.count.toString(), loading: false };
          return newStats;
        });
      } catch (error) {
        console.error('Error fetching gap count:', error);
        setStats(prevStats => {
          const newStats = [...prevStats];
          newStats[2] = { ...newStats[2], value: 'N/A', loading: false };
          return newStats;
        });
      } finally {
        setLoading(prev => ({ ...prev, gaps: false }));
      }
    };

    const fetchActivitiesData = async () => {
      try {
        const activities = await userService.getRecentActivity();
        setRecentActivities(activities.recent_activities);
      } catch (error) {
        console.error('Error fetching recent activities:', error);
        setRecentActivities([]);
      } finally {
        setLoading(prev => ({ ...prev, activities: false }));
      }
    };

    fetchSOPCount();
    fetchRegulationsCount();
    fetchGapCount();
    fetchActivitiesData();
  }, []);

  return (
    <div className="dashboard">
      <Navigation />
      <main className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome back</h2>
          <p>Here's what's happening in your organization</p>
        </div>

        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <h3>{stat.title}</h3>
              <div className="stat-value-container">
                {stat.loading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <p style={{ color: stat.color }}>{stat.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>




        <div className="recent-updates">
          <h3>Recent Activities</h3>
          <div className="updates-list">
            {loading.activities ? (
              <div className="activity-loading">
                <LoadingSpinner size="small" />
                <span>Loading recent activities...</span>
              </div>
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <div key={index} className="update-item">
                  <span className="update-text" style={{ width: '50%', textAlign: 'left' }}>{activity?.title}</span>
                  <span className="update-time" style={{ width: '50%', textAlign: 'right' }}>{formatDate(activity?.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="no-activities">
                <span className="update-text">No recent activities found</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
