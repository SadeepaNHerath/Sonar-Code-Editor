import * as fs from 'fs';
import * as path from 'path';
import { IpcMain, Dialog, webContents, BrowserView, BrowserWindow } from 'electron';
import { FileNode } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';
import { startStaticServer, stopStaticServer, getServerUrl } from './staticServer';

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function readDirectoryRecursive(dirPath: string, deep = false): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          type: 'directory' as const,
          path: fullPath,
          children: deep ? readDirectoryRecursive(fullPath) : [],
        };
      } else {
        return {
          name: entry.name,
          type: 'file' as const,
          path: fullPath,
          extension: getExtension(entry.name),
        };
      }
    })
    .sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
}

export function registerFsHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, async (_event, dirPath: string) => {
    try {
      return readDirectoryRecursive(dirPath);
    } catch (err) {
      throw new Error(`Failed to read directory: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE_BASE64, async (_event, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
        webp: 'image/webp', ico: 'image/x-icon',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      throw new Error(`Failed to read file as base64: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, async (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to write file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FILE, async (_event, filePath: string) => {
    try {
      fs.writeFileSync(filePath, '', 'utf-8');
    } catch (err) {
      throw new Error(`Failed to create file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FOLDER, async (_event, folderPath: string) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create folder: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_DELETE_ITEM, async (_event, itemPath: string) => {
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    } catch (err) {
      throw new Error(`Failed to delete item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_RENAME_ITEM, async (_event, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath);
    } catch (err) {
      throw new Error(`Failed to rename item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FOLDER_DIALOG, async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Open Folder',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return { path: result.filePaths[0], isDirectory: true };
    } catch (err) {
      throw new Error(`Failed to open folder dialog: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FILE_DIALOG, async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        title: 'Open File',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const selectedPath = result.filePaths[0];
      return { path: selectedPath, isDirectory: false, parentPath: path.dirname(selectedPath), name: path.basename(selectedPath) };
    } catch (err) {
      throw new Error(`Failed to open file dialog: ${(err as Error).message}`);
    }
  });

  // Static server handlers
  ipcMain.handle(IPC_CHANNELS.SERVER_START, async (_event, rootDir: string) => {
    const port = await startStaticServer(rootDir);
    return port;
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_STOP, async () => {
    await stopStaticServer();
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_GET_URL, async () => {
    return getServerUrl();
  });

  // DevTools docking handlers using BrowserView
  let devtoolsView: BrowserView | null = null;

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_OPEN, async (event, previewId: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const previewContents = webContents.fromId(previewId);
    if (!previewContents) return;

    // Clean up existing
    if (devtoolsView) {
      try {
        win.removeBrowserView(devtoolsView);
        devtoolsView.webContents.close();
      } catch {}
      devtoolsView = null;
    }

    devtoolsView = new BrowserView();
    win.addBrowserView(devtoolsView);
    devtoolsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    previewContents.setDevToolsWebContents(devtoolsView.webContents);
    previewContents.openDevTools();
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_CLOSE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !devtoolsView) return;
    try {
      win.removeBrowserView(devtoolsView);
      devtoolsView.webContents.close();
    } catch {}
    devtoolsView = null;
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_RESIZE, async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (!devtoolsView) return;
    devtoolsView.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
  });
}
