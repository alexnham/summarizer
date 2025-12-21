const { supabase, handleCors } = require('./lib/config');

/**
 * GET /api/getTranscription/[id]
 * Fetch a single transcription by ID
 */
module.exports = async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

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
