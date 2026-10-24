// ATLANT: Arena Brawl — static dev server
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const publicDir = path.join(root, 'public');
const port = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function send(p, res) {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(p).pipe(res);
}

http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '') url = '/index.html';
  const candidates = [
    path.normalize(path.join(root, url)),
    path.normalize(path.join(publicDir, url)),
  ];
  fs.stat(candidates[0], (e0, st0) => {
    if (!e0 && st0.isFile()) {
      send(candidates[0], res);
      return;
    }
    fs.stat(candidates[1], (e1, st1) => {
      if (e1 || !st1.isFile()) {
        res.writeHead(404);
        res.end('404 Not Found: ' + url);
        return;
      }
      send(candidates[1], res);
    });
  });
}).listen(port, '0.0.0.0', () => {
  console.log('ATLANT Arena Brawl ready at http://0.0.0.0:' + port);
});
