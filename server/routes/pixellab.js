import { Router } from 'express';

const router = Router();
const PIXELLAB_BASE = 'https://api.pixellab.ai/v2';

function getApiKey() {
  return process.env.PIXELLAB_API_KEY;
}

// Extract the endpoint path after /api/pixellab/
function getEndpoint(req) {
  return req.originalUrl.replace('/api/pixellab/', '').split('?')[0];
}

// Catch-all middleware for /api/pixellab/*
router.use('/api/pixellab', async (req, res) => {
  const key = getApiKey();
  if (!key) return res.status(500).json({ error: 'PIXELLAB_API_KEY not configured' });

  const endpoint = getEndpoint(req);
  if (!endpoint) return res.status(400).json({ error: 'No endpoint specified' });

  const url = `${PIXELLAB_BASE}/${endpoint}`;

  try {
    const fetchOpts = {
      method: req.method,
      headers: { 'Authorization': `Bearer ${key}` },
    };

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(req.body);
    }

    const resp = await fetch(url, fetchOpts);

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
    // Binary (images)
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.set('Content-Type', contentType);
    res.status(resp.status).send(buffer);
  } catch (err) {
    res.status(502).json({ error: 'PixelLab API request failed', detail: err.message });
  }
});

export default router;
