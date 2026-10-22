// Serves the production build for the end-to-end tests, falling back to
// index.html for client-side routes like the Vercel rewrite does.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist', 'finance-dashboard', 'browser');
const port = Number(process.env.PORT ?? 4300);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  const file = join(root, path);
  try {
    if (!file.startsWith(root) || !extname(file)) throw new Error('route');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(200, { 'Content-Type': types['.html'] });
    res.end(await readFile(join(root, 'index.html')));
  }
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
