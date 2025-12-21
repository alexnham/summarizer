const { supabase } = require('../lib/config');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * GET /api/getTranscription/[id]
 * Fetch a single transcription by ID
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Transcription ID is required' });
  }

  try {
    const { data: dbData, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching transcription:', error);
      return res.status(500).json({ error: 'Error fetching transcription' });
    }

    return res.status(200).json(dbData);
  } catch (err) {
    console.error('Error in getTranscription:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
};
