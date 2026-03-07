const http = require('http');
const https = require('https');
const { URL } = require('url');

const targets = [
  {
    name: 'fleetbase',
    port: 9080,
    target: 'https://api-delivery.max.kg',
  },
  {
    name: 'matrix',
    port: 9081,
    target: 'https://matrix.max.kg',
  },
];

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

const forwardRequest = (req, res, targetBase) => {
  const targetUrl = new URL(req.url, targetBase);
  const upstream = targetUrl.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };

  Object.keys(headers).forEach((key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      delete headers[key];
    }
  });

  headers.host = targetUrl.host;
  headers.origin = `${targetUrl.protocol}//${targetUrl.host}`;
  headers.referer = `${targetUrl.protocol}//${targetUrl.host}/`;

  const upstreamReq = upstream.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders = { ...upstreamRes.headers };
      Object.keys(responseHeaders).forEach((key) => {
        if (hopByHopHeaders.has(key.toLowerCase())) {
          delete responseHeaders[key];
        }
      });

      res.writeHead(upstreamRes.statusCode || 500, responseHeaders);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        proxy: targetBase,
        message: error.message,
      })
    );
  });

  req.pipe(upstreamReq);
};

targets.forEach(({ name, port, target }) => {
  const server = http.createServer((req, res) => forwardRequest(req, res, target));
  server.listen(port, '127.0.0.1', () => {
    console.log(`[proxy:${name}] listening on http://127.0.0.1:${port} -> ${target}`);
  });
});
