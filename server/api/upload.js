const { put } = require('@vercel/blob');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

// Vercel serverless config
module.exports.config = {
  api: {
    bodyParser: false, // Required for handling file streams
  },
};

/**
 * POST /api/upload
 * Upload audio file to Vercel Blob storage
 * Returns the blob URL to be used with /api/transcribe
 * 
 * Client should send file as raw body with headers:
 * - x-filename: original filename
 * - content-type: audio mime type
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-filename');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = req.headers['x-filename'] || `audio-${Date.now()}`;
    const contentType = req.headers['content-type'] || 'audio/mpeg';

    console.log('Uploading file to Vercel Blob:', filename);

    // Upload the request body stream directly to Vercel Blob
    const blob = await put(filename, req, {
      access: 'public',
      contentType: contentType,
    });

    console.log('File uploaded successfully:', blob.url);

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
    });
  } catch (err) {
    console.error('Error uploading to Vercel Blob:', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
};
