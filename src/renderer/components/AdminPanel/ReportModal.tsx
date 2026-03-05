import React, { useState, useEffect } from 'react';
import { Team, ActivityLog, StatusEntry, AppUsageEntry, ReportData } from '../../../shared/types';
import { getActivityLogsForTeam, saveReport } from '../../services/appwrite';
import { generatePDFReport } from '../../services/reportGenerator';
import './ReportModal.css';

interface ReportModalProps {
  team: Team & { teamId: string };
  onClose: () => void;
}

function buildReportData(team: Team & { teamId: string }, logs: ActivityLog[]): ReportData {
  if (logs.length === 0) {
    return {
      team,
      sessionStart: '',
      sessionEnd: '',
      statusTimeline: [],
      appUsage: [],
      summary: { totalDuration: 0, totalOnlineTime: 0, totalOfflineTime: 0, disconnections: 0, longestOnlineStretch: 0, percentOnline: 0, percentInIDE: 0, appSwitches: 0 }
    };
  }

  // Sort logs by timestamp ascending
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const sessionStart = sorted[0].timestamp;
  const sessionEnd = sorted[sorted.length - 1].timestamp;
  const totalDuration = (new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 1000;

  // Build status timeline
  const statusTimeline: StatusEntry[] = [];
  let currentStatus = sorted[0].status;
  let currentFrom = sorted[0].timestamp;
  let totalOnline = 0, totalOffline = 0, disconnections = 0, longestOnline = 0, currentOnlineStretch = 0;

  for (let i = 1; i < sorted.length; i++) {
    const log = sorted[i];
    if (log.status !== currentStatus) {
      const duration = (new Date(log.timestamp).getTime() - new Date(currentFrom).getTime()) / 1000;
      statusTimeline.push({ status: currentStatus, from: currentFrom, to: log.timestamp, duration });
      if (currentStatus === 'online') { totalOnline += duration; if (duration > longestOnline) longestOnline = duration; currentOnlineStretch = 0; }
      else { totalOffline += duration; disconnections++; }
      currentStatus = log.status;
      currentFrom = log.timestamp;
    }
  }
  // Push final entry
  const finalDuration = (new Date(sessionEnd).getTime() - new Date(currentFrom).getTime()) / 1000;
  statusTimeline.push({ status: currentStatus, from: currentFrom, to: sessionEnd, duration: finalDuration });
  if (currentStatus === 'online') totalOnline += finalDuration;
  else totalOffline += finalDuration;

  // Build app usage
  const appMap = new Map<string, AppUsageEntry>();
  const HEARTBEAT_INTERVAL = 30;

  for (const log of sorted) {
    const key = `${log.appName || log.currentWindow}`;
    if (!key) continue;
    const existing = appMap.get(key);
    if (existing) {
      existing.lastSeen = log.timestamp;
      existing.totalTime += HEARTBEAT_INTERVAL;
      if (log.currentWindow) existing.windowTitle = log.currentWindow;
    } else {
      appMap.set(key, {
        appName: log.appName || log.currentWindow || 'Unknown',
        windowTitle: log.currentWindow || '',
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
        totalTime: HEARTBEAT_INTERVAL,
      });
    }
  }

  const appUsage = Array.from(appMap.values()).sort((a, b) => b.totalTime - a.totalTime);

  const ideTime = appUsage.filter((a) => a.appName === 'DevWatch IDE').reduce((acc, a) => acc + a.totalTime, 0);
  const appSwitches = sorted.reduce((count, log, i) => {
    if (i === 0) return 0;
    const prev = sorted[i - 1];
    const prevApp = prev.appName || prev.currentWindow;
    const currApp = log.appName || log.currentWindow;
    return prevApp !== currApp ? count + 1 : count;
  }, 0);

  return {
    team,
    sessionStart,
    sessionEnd,
    statusTimeline,
    appUsage,
    summary: {
      totalDuration,
      totalOnlineTime: totalOnline,
      totalOfflineTime: totalOffline,
      disconnections,
      longestOnlineStretch: longestOnline,
      percentOnline: totalDuration > 0 ? Math.round((totalOnline / totalDuration) * 100) : 0,
      percentInIDE: totalOnline > 0 ? Math.round((ideTime / totalOnline) * 100) : 0,
      appSwitches,
    }
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleTimeString();
}

export default function ReportModal({ team, onClose }: ReportModalProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'apps' | 'summary'>('summary');

  useEffect(() => {
    getActivityLogsForTeam(team.teamId || team.$id!).then((fetchedLogs) => {
      setLogs(fetchedLogs);
      setReportData(buildReportData(team, fetchedLogs));
      setLoading(false);
    });
  }, [team]);

  const handleExportPDF = async () => {
    if (!reportData) return;
    await generatePDFReport(reportData);
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${team.teamName}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToAppwrite = async () => {
    if (!reportData) return;
    await saveReport({
      teamId: team.teamId || team.$id!,
      teamName: team.teamName,
      sessionStart: reportData.sessionStart,
      sessionEnd: reportData.sessionEnd,
      generatedAt: new Date().toISOString(),
      reportData: JSON.stringify(reportData),
    });
    alert('Report saved to Appwrite!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2>Report â€” {team.teamName}</h2>
            {reportData?.sessionStart && (
              <p className="modal-subtitle">
                {new Date(reportData.sessionStart).toLocaleDateString()} &nbsp;
                {formatTime(reportData.sessionStart)} â†’ {formatTime(reportData.sessionEnd)}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button className="admin-btn" onClick={handleExportPDF}>Export PDF</button>
            <button className="admin-btn" onClick={handleExportJSON}>Export JSON</button>
            <button className="admin-btn" onClick={handleSaveToAppwrite}>Save</button>
            <button className="modal-close-btn" onClick={onClose}>Ã—</button>
          </div>
        </div>

        {loading ? (
          <div className="modal-loading">Loading activity data...</div>
        ) : !reportData || logs.length === 0 ? (
          <div className="modal-empty">No activity data found for this team.</div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="modal-tabs">
              {(['summary', 'timeline', 'apps'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`modal-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="summary-grid">
                  {[
                    { label: 'Total Session', value: formatDuration(reportData.summary.totalDuration) },
                    { label: 'Online Time', value: formatDuration(reportData.summary.totalOnlineTime), color: 'var(--online)' },
                    { label: 'Offline Time', value: formatDuration(reportData.summary.totalOfflineTime), color: 'var(--offline)' },
                    { label: '% Online', value: `${reportData.summary.percentOnline}%`, color: 'var(--online)' },
                    { label: '% In IDE', value: `${reportData.summary.percentInIDE}%` },
                    { label: 'Disconnections', value: reportData.summary.disconnections },
                    { label: 'App Switches', value: reportData.summary.appSwitches },
                    { label: 'Longest Online', value: formatDuration(reportData.summary.longestOnlineStretch) },
                  ].map((item) => (
                    <div key={item.label} className="summary-card">
                      <span className="summary-value" style={{ color: item.color as string | undefined }}>{item.value}</span>
                      <span className="summary-label">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div>
                  {/* Visual timeline bar */}
                  <div className="timeline-bar-container">
                    {reportData.statusTimeline.map((entry, i) => {
                      const pct = reportData.summary.totalDuration > 0
                        ? (entry.duration / reportData.summary.totalDuration) * 100
                        : 0;
                      return (
                        <div
                          key={i}
                          className={`timeline-segment ${entry.status}`}
                          style={{ flexBasis: `${pct}%` }}
                          title={`${entry.status}: ${formatDuration(entry.duration)}`}
                        />
                      );
                    })}
                  </div>
                  <table className="report-table">
                    <thead>
                      <tr><th>Status</th><th>From</th><th>To</th><th>Duration</th></tr>
                    </thead>
                    <tbody>
                      {reportData.statusTimeline.map((entry, i) => (
                        <tr key={i} className={`status-row-${entry.status}`}>
                          <td><span className={`badge ${entry.status}`}><span className={`dot ${entry.status}`} />{entry.status}</span></td>
                          <td>{formatTime(entry.from)}</td>
                          <td>{formatTime(entry.to)}</td>
                          <td>{formatDuration(entry.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Apps Tab */}
              {activeTab === 'apps' && (
                <table className="report-table">
                  <thead>
                    <tr><th>App</th><th>Window Title</th><th>First Seen</th><th>Last Seen</th><th>Total Time</th><th>Flag</th></tr>
                  </thead>
                  <tbody>
                    {reportData.appUsage.map((entry, i) => {
                      const isNonIDE = entry.appName !== 'DevWatch IDE';
                      return (
                        <tr key={i} className={isNonIDE ? 'flagged-row' : ''}>
                          <td>{entry.appName}</td>
                          <td className="td-window">{entry.windowTitle || 'â€”'}</td>
                          <td>{formatTime(entry.firstSeen)}</td>
                          <td>{formatTime(entry.lastSeen)}</td>
                          <td>{formatDuration(entry.totalTime)}</td>
                          <td>{isNonIDE ? <span className="flag-badge">âš  Non-IDE</span> : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
