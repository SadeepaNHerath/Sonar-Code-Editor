import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllSessions, subscribeToActivityLogs, subscribeToSessions, getActivityLogsForTeam } from '../services/appwrite';
import { Session, ActivityLog, Team } from '../../shared/types';
import ReportModal from '../components/AdminPanel/ReportModal';
import './AdminDashboard.css';

interface TeamStatus extends Session {
  currentWindow?: string;
  currentFile?: string;
  lastActivity?: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [teams, setTeams] = useState<TeamStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamStatus | null>(null);
  const [showReport, setShowReport] = useState(false);
  const unsubRefs = useRef<Array<() => void>>([]);

  const loadSessions = useCallback(async () => {
    const sessions = await getAllSessions();
    // Mark stale sessions (lastSeen > 90s ago) as offline
    const now = Date.now();
    const updated = sessions.map((s) => {
      const lastSeenMs = new Date(s.lastSeen).getTime();
      const stale = now - lastSeenMs > 90000;
      return { ...s, status: stale ? 'offline' : s.status } as TeamStatus;
    });
    setTeams(updated);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();

    // Subscribe to real-time updates
    const unsubActivity = subscribeToActivityLogs((log: ActivityLog) => {
      setTeams((prev) => {
        const idx = prev.findIndex((t) => t.teamId === log.teamId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          currentWindow: log.currentWindow,
          currentFile: log.currentFile,
          status: 'online',
          lastSeen: log.timestamp,
          lastActivity: log.timestamp,
        };
        return updated;
      });
      setLastUpdated(new Date());
    });

    const unsubSessions = subscribeToSessions((session: Session) => {
      setTeams((prev) => {
        const idx = prev.findIndex((t) => t.teamId === session.teamId);
        if (idx === -1) {
          return [...prev, session as TeamStatus];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...session };
        return updated;
      });
      setLastUpdated(new Date());
    });

    unsubRefs.current = [unsubActivity, unsubSessions];

    // Poll every 30s as fallback
    const pollInterval = setInterval(loadSessions, 30000);

    return () => {
      unsubRefs.current.forEach((fn) => fn());
      clearInterval(pollInterval);
    };
  }, [loadSessions]);

  const filteredTeams = teams.filter((t) =>
    !search || t.teamName.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = teams.filter((t) => t.status === 'online').length;
  const offlineCount = teams.filter((t) => t.status === 'offline').length;

  const formatTime = (iso: string) => {
    if (!iso) return 'â€”';
    const d = new Date(iso);
    return d.toLocaleTimeString();
  };

  const timeSince = (iso: string) => {
    if (!iso) return 'â€”';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">ðŸ‘ DevWatch Admin</span>
        </div>
        <div className="admin-header-right">
          {lastUpdated && (
            <span className="last-updated">Updated {formatTime(lastUpdated.toISOString())}</span>
          )}
          <button className="admin-btn" onClick={loadSessions}>â†» Refresh</button>
          <span className="admin-user">{user?.teamName}</span>
          <button className="admin-btn danger" onClick={logout}>Sign Out</button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-value">{teams.length}</span>
          <span className="stat-label">Total Teams</span>
        </div>
        <div className="stat-card online">
          <span className="stat-value">{onlineCount}</span>
          <span className="stat-label">Online</span>
        </div>
        <div className="stat-card offline">
          <span className="stat-value">{offlineCount}</span>
          <span className="stat-label">Offline</span>
        </div>
      </div>

      {/* Search */}
      <div className="admin-search-bar">
        <input
          type="text"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search-input"
        />
      </div>

      {/* Teams Table */}
      <div className="admin-table-container">
        {loading ? (
          <div className="admin-loading">Loading teams...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="admin-empty">No teams found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Team Name</th>
                <th>Current Window</th>
                <th>Current File</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => (
                <tr key={team.teamId} className={team.status === 'online' ? 'row-online' : 'row-offline'}>
                  <td>
                    <span className={`badge ${team.status}`}>
                      <span className={`dot ${team.status}`} />
                      {team.status}
                    </span>
                  </td>
                  <td className="td-name">{team.teamName}</td>
                  <td className="td-window">{team.currentWindow || 'â€”'}</td>
                  <td className="td-file">
                    {team.currentFile ? (
                      <code className="file-path">{team.currentFile.split('/').pop()}</code>
                    ) : 'â€”'}
                  </td>
                  <td className="td-time">{timeSince(team.lastSeen)}</td>
                  <td>
                    <button
                      className="admin-btn small"
                      onClick={() => { setSelectedTeam(team); setShowReport(true); }}
                    >
                      Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showReport && selectedTeam && (
        <ReportModal
          team={selectedTeam as unknown as Team & { teamId: string }}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
