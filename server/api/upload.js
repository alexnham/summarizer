const blob = require('@vercel/blob');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * GET /api/upload
 * Returns the Blob store token for client-side uploads
 * Client will upload directly to Vercel Blob using @vercel/blob/client
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Just return the token - client will use it directly with @vercel/blob
  return res.status(200).json({
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
};
