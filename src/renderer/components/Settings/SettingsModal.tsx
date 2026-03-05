import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('Text Editor');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchesSearch = (text: string) => 
    searchQuery === '' || text.toLowerCase().includes(searchQuery.toLowerCase());

  const isSearching = searchQuery.trim().length > 0;

  const showTextEditor = !isSearching 
    ? activeTab === 'Text Editor' 
    : (matchesSearch('Text Editor') || matchesSearch('Auto Save') || matchesSearch('Hot Reload') || matchesSearch('Controls auto save') || matchesSearch('Instantly refresh'));

  const showAppearance = !isSearching 
    ? activeTab === 'Appearance' 
    : (matchesSearch('Appearance') || matchesSearch('Color Theme') || matchesSearch('interface theme'));

  const shortcuts = [
    { action: 'Save File', keys: ['Ctrl', 'S'] },
    { action: 'Close Tab', keys: ['Ctrl', 'W'] },
    { action: 'New File', keys: ['Ctrl', 'N'] },
    { action: 'Toggle Explorer', keys: ['Ctrl', 'B'] },
    { action: 'Toggle Preview Panel', keys: ['Ctrl', 'Shift', 'V'] },
    { action: 'Toggle Preview Tab', keys: ['Ctrl', 'Shift', 'B'] },
  ];

  const filteredShortcuts = shortcuts.filter(s => 
    matchesSearch(s.action) || s.keys.some(k => matchesSearch(k)) || matchesSearch('Keyboard Shortcuts')
  );

  const showKeyboardShortcuts = !isSearching 
    ? activeTab === 'Keyboard Shortcuts' 
    : filteredShortcuts.length > 0;

  const isWindows = navigator.userAgent.toLowerCase().includes('win');

  return (
    <div className="vscode-settings-overlay">
      <div 
        className="vscode-settings-header-tabs"
        style={{ paddingLeft: isWindows ? '0px' : '75px' }}
      >
        <div className="vscode-settings-tab active">User</div>
        <button className="vscode-settings-close" onClick={onClose}><X size={16}/></button>
      </div>

      <div className="vscode-settings-searchbar-container">
        <div className="vscode-search-input-wrapper">
          <Search size={16} className="vscode-search-icon" />
          <input 
            type="text" 
            placeholder="Search settings" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="vscode-search-input"
          />
        </div>
      </div>

      <div className="vscode-settings-body">
        <div className="vscode-settings-sidebar">
           <ul className="vscode-settings-tree">
             <li className={(isSearching ? showTextEditor : activeTab === 'Text Editor') ? 'active' : ''} onClick={() => setActiveTab('Text Editor')}>Text Editor</li>
             <li className={(isSearching ? showAppearance : activeTab === 'Appearance') ? 'active' : ''} onClick={() => setActiveTab('Appearance')}>Appearance</li>
             <li className={(isSearching ? showKeyboardShortcuts : activeTab === 'Keyboard Shortcuts') ? 'active' : ''} onClick={() => setActiveTab('Keyboard Shortcuts')}>Keyboard Shortcuts</li>
           </ul>
        </div>
        <div className="vscode-settings-content">
          {showTextEditor && (
            <div className="vscode-settings-section">
              <h2 className="vscode-settings-section-title">Text Editor</h2>
              
              {(isSearching ? (matchesSearch('Auto Save') || matchesSearch('Controls auto save') || matchesSearch('Text Editor')) : true) && (
                <div className="vscode-setting-item">
                  <div className="vscode-setting-header">
                    <span className="vscode-setting-title">Editor: <span className="highlight">Auto Save</span></span>
                    <div className="vscode-setting-description">Controls auto save of dirty editors.</div>
                  </div>
                  <div className="vscode-setting-control">
                    <select 
                      className="vscode-select" 
                      value={autoSave ? 'on' : 'off'} 
                      onChange={(e) => onAutoSaveChange(e.target.value === 'on')}
                    >
                      <option value="off">off</option>
                      <option value="on">afterDelay (on)</option>
                    </select>
                  </div>
                </div>
              )}

              {(isSearching ? (matchesSearch('Hot Reload') || matchesSearch('Instantly refresh') || matchesSearch('Text Editor')) : true) && (
                <div className="vscode-setting-item">
                  <div className="vscode-setting-header">
                    <span className="vscode-setting-title">Preview: <span className="highlight">Hot Reload</span></span>
                    <div className="vscode-setting-description">Instantly refresh the preview panel when files are saved.</div>
                  </div>
                  <div className="vscode-setting-control">
                    <label className="vscode-checkbox-label">
                      <input 
                        type="checkbox" 
                        className="vscode-checkbox" 
                        checked={hotReload} 
                        onChange={(e) => onHotReloadChange(e.target.checked)} 
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {showAppearance && (
            <div className="vscode-settings-section">
              <h2 className="vscode-settings-section-title">Appearance</h2>
              
              {(isSearching ? (matchesSearch('Color Theme') || matchesSearch('interface theme') || matchesSearch('Appearance')) : true) && (
                <div className="vscode-setting-item">
                  <div className="vscode-setting-header">
                    <span className="vscode-setting-title">Workbench: <span className="highlight">Color Theme</span></span>
                    <div className="vscode-setting-description">Select your interface theme or let it match your system.</div>
                  </div>
                  <div className="vscode-setting-control">
                     <select 
                      className="vscode-select" 
                      value={theme} 
                      onChange={(e) => onThemeChange(e.target.value)}
                    >
                      <option value="system">System Default</option>
                      <option value="light">Light Theme</option>
                      <option value="dark">Dark Theme</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {showKeyboardShortcuts && (
            <div className="vscode-settings-section">
              <h2 className="vscode-settings-section-title">Keyboard Shortcuts</h2>
              <div className="shortcuts-table">
                <div className="shortcuts-header">
                  <span>Action</span>
                  <span>Shortcut</span>
                </div>
                {filteredShortcuts.map((s) => (
                  <div className="shortcuts-row" key={s.action}>
                    <span className="shortcuts-action">{s.action}</span>
                    <div className="kbd-wrap">
                      {s.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && <span className="kbd-sep">+</span>}
                          <kbd>{k}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
