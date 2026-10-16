'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const OUTPUT_DIR = path.join(ROOT, 'output');
const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_GB || 5) * 1024 ** 3;
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) fs.mkdirSync(dir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
function safeName(name) { return path.basename(String(name || 'video').replace(/[\x00-\x1f<>:"/\\|?*]/g, '_')).slice(0, 160) || 'video'; }
function serveStatic(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, 'public', requested);
  if (!file.startsWith(path.resolve(ROOT, 'public') + path.sep) && file !== path.resolve(ROOT, 'public', 'index.html')) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.end(data);
  });
}
function compress(input, output, mode) {
  return new Promise((resolve, reject) => {
    const crf = mode === 'smaller' ? '25' : mode === 'balanced' ? '22' : '18';
    const args = ['-hide_banner', '-nostdin', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', mode === 'smaller' ? '128k' : '192k', '-movflags', '+faststart', output];
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-12000); });
    child.on('error', err => reject(new Error(\`Could not start FFmpeg. Install FFmpeg or set FFMPEG_PATH. \${err.message}\`)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(\`FFmpeg exited with code \${code}. \${stderr.slice(-2500)}\`)));
  });
}
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && !req.url.startsWith('/api/')) return serveStatic(req, res);
  if (req.method === 'GET' && req.url === '/api/health') return json(res, 200, { ok: true, maxUploadBytes: MAX_UPLOAD_BYTES, ffmpeg: FFMPEG });
  if (req.method === 'POST' && req.url === '/api/compress') {
    const length = Number(req.headers['content-length'] || 0);
    if (length > MAX_UPLOAD_BYTES) { req.resume(); return json(res, 413, { error: \`File exceeds the \${process.env.MAX_UPLOAD_GB || 5} GB upload limit.\` }); }
    const originalName = safeName(decodeURIComponent(req.headers['x-file-name'] || 'video.mp4'));
    const ext = path.extname(originalName).toLowerCase();
    if (!['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mpeg', '.mpg'].includes(ext)) { req.resume(); return json(res, 415, { error: 'Unsupported video extension.' }); }
    const mode = ['quality', 'balanced', 'smaller'].includes(req.headers['x-compression-mode']) ? req.headers['x-compression-mode'] : 'quality';
    const id = crypto.randomUUID();
    const input = path.join(UPLOAD_DIR, \`\${id}\${ext}\`);
    const output = path.join(OUTPUT_DIR, \`\${id}.mp4\`);
    let bytes = 0;
    const out = fs.createWriteStream(input, { flags: 'wx' });
    req.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_UPLOAD_BYTES) { req.destroy(new Error('Upload limit exceeded')); out.destroy(); } });
    req.pipe(out);
    out.on('error', err => { fs.rm(input, { force: true }, () => {}); if (!res.headersSent) json(res, 500, { error: \`Upload failed: \${err.message}\` }); });
    out.on('finish', async () => {
      try {
        if (!bytes) throw new Error('The uploaded file is empty.');
        await compress(input, output, mode);
        const originalBytes = fs.statSync(input).size;
        const compressedBytes = fs.statSync(output).size;
        const downloadName = \`\${path.parse(originalName).name}-compressed.mp4\`;
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': compressedBytes, 'Content-Disposition': \`attachment; filename="\${downloadName.replace(/"/g, '')}"\`, 'X-Original-Bytes': String(originalBytes), 'X-Compressed-Bytes': String(compressedBytes), 'X-Compression-Percent': String(Math.round((1 - compressedBytes / originalBytes) * 100)) });
        fs.createReadStream(output).pipe(res).on('finish', () => { fs.rm(input, { force: true }, () => {}); fs.rm(output, { force: true }, () => {}); });
      } catch (err) {
        fs.rm(input, { force: true }, () => {}); fs.rm(output, { force: true }, () => {});
        if (!res.headersSent) json(res, 500, { error: err.message || 'Compression failed.' }); else res.destroy(err);
      }
    });
    return;
  }
  json(res, 404, { error: 'Not found' });
});
server.requestTimeout = 0;
server.timeout = 0;
server.headersTimeout = 60000;
server.listen(PORT, '0.0.0.0', () => console.log(\`Video Compressor listening on http://localhost:\${PORT}; upload cap \${MAX_UPLOAD_BYTES} bytes\`));