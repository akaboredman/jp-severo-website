// Local preview of the site + /api functions (no Vercel CLI needed).
// Usage: node tools/dev-server.mjs [--port 3100] [--env path/to/.env]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const port = Number(opt('--port', 3100));
const envPath = opt('--env', join(root, '.env'));

try {
  for (const line of (await readFile(envPath, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch { console.warn(`No env file at ${envPath}`); }

const rewrites = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')).rewrites || [];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('/_')) {
    const file = join(root, 'api', `${url.pathname.slice(5)}.js`);
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      req.body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw || undefined;
      const handler = (await import(pathToFileURL(file).href)).default;
      return await handler(req, res);
    } catch (error) {
      console.error(error);
      res.statusCode = 404; return res.end('not found');
    }
  }
  const rewrite = rewrites.find((r) => r.source === url.pathname);
  const path = normalize(join(root, rewrite ? rewrite.destination : url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    if (!(await stat(path)).isFile()) throw new Error();
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}`));
