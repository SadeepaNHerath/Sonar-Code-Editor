import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.map': 'application/json',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

let server: http.Server | null = null;
let currentRoot: string | null = null;
let currentPort: number | null = null;

function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(startPort, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', () => {
      // Port in use, try next
      if (startPort < 65535) {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(new Error('No free port found'));
      }
    });
  });
}

export async function startStaticServer(rootDir: string): Promise<number> {
  // If already serving the same directory, return existing port
  if (server && currentRoot === rootDir && currentPort) {
    return currentPort;
  }

  // Stop existing server if any
  await stopStaticServer();

  const port = await findFreePort(3500);

  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Only allow GET/HEAD
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      let urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');

      // Prevent path traversal
      const normalizedPath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(rootDir, normalizedPath);

      // Ensure the resolved path is within rootDir
      const resolvedPath = path.resolve(filePath);
      const resolvedRoot = path.resolve(rootDir);
      if (!resolvedPath.startsWith(resolvedRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          // Try index.html, index.htm, home.html
          const indexFiles = ['index.html', 'index.htm', 'home.html'];
          let found = false;
          for (const indexFile of indexFiles) {
            const indexPath = path.join(filePath, indexFile);
            if (fs.existsSync(indexPath)) {
              filePath = indexPath;
              found = true;
              break;
            }
          }
          if (!found) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No index file found');
            return;
          }
        }
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const mimeType = getMimeType(filePath);
      const isText = mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json' || mimeType === 'application/xml';

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': isText ? `${mimeType}; charset=utf-8` : mimeType,
          'Content-Length': content.length,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(content);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      currentRoot = rootDir;
      currentPort = port;
      resolve(port);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

export async function stopStaticServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        currentRoot = null;
        currentPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getServerUrl(): string | null {
  if (currentPort) {
    return `http://127.0.0.1:${currentPort}`;
  }
  return null;
}
