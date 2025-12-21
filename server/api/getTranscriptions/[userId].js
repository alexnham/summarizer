const { supabase, handleCors } = require('./lib/config');

/**
 * GET /api/getTranscriptions/[userId]
 * Fetch all transcriptions for a user
 */
module.exports = async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

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
