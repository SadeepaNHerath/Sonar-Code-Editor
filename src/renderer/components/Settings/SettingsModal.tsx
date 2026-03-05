import React from 'react';
import { X, Save, RefreshCw, Palette } from 'lucide-react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoSave: boolean;
  onAutoSaveChange: (val: boolean) => void;
  hotReload: boolean;
  onHotReloadChange: (val: boolean) => void;
  theme: string;
  onThemeChange: (val: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  autoSave,
  onAutoSaveChange,
  hotReload,
  onHotReloadChange,
  theme,
  onThemeChange
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-container" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>IDE Settings</h2>
          <button className="settings-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="settings-modal-body">
          <div className="setting-group">
            <div className="setting-icon">
              <Save size={20} className="icon-save" />
            </div>
            <div className="setting-content">
              <h3>Auto Save</h3>
              <p>Automatically save files after making changes</p>
            </div>
            <div className="setting-action">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={autoSave} 
                  onChange={(e) => onAutoSaveChange(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-group">
            <div className="setting-icon">
              <RefreshCw size={20} className="icon-refresh" />
            </div>
            <div className="setting-content">
              <h3>Hot Reload</h3>
              <p>Automatically refresh the preview when files are saved</p>
            </div>
            <div className="setting-action">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={hotReload} 
                  onChange={(e) => onHotReloadChange(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-group">
            <div className="setting-icon">
              <Palette size={20} className="icon-palette" />
            </div>
            <div className="setting-content">
              <h3>Theme</h3>
              <p>Choose your preferred interface theme</p>
            </div>
            <div className="setting-action">
              <select 
                title="Theme"
                className="theme-select" 
                value={theme} 
                onChange={(e) => onThemeChange(e.target.value)}
              >
                <option value="system">System Default</option>
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
