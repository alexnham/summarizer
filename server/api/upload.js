const { handleUpload } = require('@vercel/blob');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * POST /api/upload
 * Handle client-side upload to Vercel Blob
 * This generates a secure upload URL for the client to upload directly to Blob storage
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

  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate and authorize the upload here if needed
        // You can check user session, validate file type, etc.
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/ogg',
            'audio/webm',
            'audio/mp4',
            'audio/m4a',
            'audio/x-m4a',
            'video/mp4',
            'video/webm',
            'video/quicktime',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB max
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // This runs after upload is complete
        console.log('Blob upload completed:', blob.url);
      },
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error in upload handler:', err);
    return res.status(400).json({ error: err?.message || 'Upload failed' });
  }
};
