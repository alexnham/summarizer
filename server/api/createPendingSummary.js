const { supabase, handleCors } = require('./lib/config');

/**
 * POST /api/createPendingSummary
 * Create a placeholder summary with status 'processing'
 */
module.exports = async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

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
