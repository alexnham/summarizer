const { supabase, handleCors } = require('./lib/config');

/**
 * DELETE /api/deleteTranscription/[id]
 * Delete a transcription by ID
 */
module.exports = async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

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
