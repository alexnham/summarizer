const { del } = require('@vercel/blob');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * DELETE /api/deleteBlob
 * Delete a blob from Vercel Blob storage after transcription is complete
 * 
 * Body: { url: 'blob-url-to-delete' }
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Blob URL is required' });
    }

    console.log('Deleting blob:', url);

    await del(url);

    console.log('Blob deleted successfully');

    return res.status(200).json({ message: 'Blob deleted successfully' });
  } catch (err) {
    console.error('Error deleting blob:', err);
    return res.status(500).json({ error: err?.message || 'Delete failed' });
  }
};
