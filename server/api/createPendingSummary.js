const { supabase } = require('./lib/config');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * POST /api/createPendingSummary
 * Create a placeholder summary with status 'processing'
 */
module.exports = async function handler(req, res) {
  // Set CORS headers for ALL responses
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { data: dbData, error } = await supabase
      .from('summaries')
      .insert([
        {
          user_id: userId,
          title: title || 'Untitled',
          content: null,
          final_summary: null,
          transcript: null,
          status: 'processing',
          created_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating pending summary:', error);
      return res.status(500).json({ error: 'Failed to create pending summary' });
    }

    return res.status(200).json({ id: dbData.id, status: 'processing' });
  } catch (err) {
    console.error('Error in createPendingSummary:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
};
