const { supabase } = require('../lib/config');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

/**
 * DELETE /api/deleteTranscription/[id]
 * Delete a transcription by ID
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

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Transcription ID is required' });
  }

  console.log('Deleting transcription with ID:', id);

  try {
    const { error } = await supabase
      .from('summaries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transcription:', error);
      return res.status(500).json({ error: 'Error deleting transcription' });
    }

    return res.status(200).json({ message: 'Transcription deleted successfully' });
  } catch (err) {
    console.error('Error in deleteTranscription:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
};
