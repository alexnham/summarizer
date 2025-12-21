const { uploadPart } = require('@vercel/blob');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

// Disable body parsing to handle raw file data
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

/**
 * POST /api/upload-part
 * Upload a single part of a multipart upload
 * 
 * Query params:
 * - uploadId: The multipart upload ID
 * - key: The blob key
 * - partNumber: The part number (1-indexed)
 * 
 * Body: Raw file chunk data
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uploadId, key, partNumber } = req.query;

    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({ error: 'uploadId, key, and partNumber are required' });
    }

    const partNum = parseInt(partNumber, 10);
    console.log(`Uploading part ${partNum} for upload ${uploadId}`);

    // Collect the request body into a buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    console.log(`Part ${partNum} size: ${buffer.length} bytes`);

    // Upload the part
    const part = await uploadPart(key, uploadId, partNum, buffer);

    console.log(`Part ${partNum} uploaded, etag: ${part.etag}`);

    return res.status(200).json({
      partNumber: partNum,
      etag: part.etag,
    });

  } catch (err) {
    console.error('Error uploading part:', err);
    return res.status(500).json({ error: err?.message || 'Part upload failed' });
  }
};
