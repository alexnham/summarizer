const { supabase } = require('../lib/config');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * GET /api/getTranscriptions/[userId]
 * Fetch all transcriptions for a user
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

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const { data: dbData, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching transcriptions:', error);
      return res.status(500).json({ error: 'Error fetching transcriptions' });
    }

    return res.status(200).json(dbData);
  } catch (err) {
    console.error('Error in getTranscriptions:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
};
