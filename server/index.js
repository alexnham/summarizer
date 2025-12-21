/**
 * Local development server
 * 
 * For production, use Vercel serverless functions in /api folder.
 * This file is kept for local development and testing.
 * 
 * To run locally: npm start
 * To deploy to Vercel: vercel --prod (or npm run deploy)
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');

// Import shared utilities from API lib
const {
  supabase,
  deepgram,
  CHUNK_MINUTES,
  CHUNK_SECONDS,
  buildDeepgramOptions,
  secondsToHMS,
  buildChunksFromDeepgram,
  summarizeChunk,
  summarizeSummaries,
  saveTranscriptionResult,
  updateTranscriptionResult,
  markTranscriptionFailed,
} = require('./api/lib/config');

const app = express();

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://summarize.alexnham.com',
  ]
}));

const upload = multer({ dest: 'tmp/' });

/**
 * Endpoint: createPendingSummary
 * - Creates a placeholder summary with null values and status 'processing'
 * - Returns the summary ID to be used for updating later
 */
app.post('/api/createPendingSummary', async (req, res) => {
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

    return res.json({ id: dbData.id, status: 'processing' });
  } catch (err) {
    console.error('Error in /createPendingSummary', err);
    return res.status(500).json({ error: err?.message || 'internal error' });
  }
});

/**
 * Endpoint: transcribe
 * - Accepts file upload via multipart form field `audio` OR JSON { audioUrl: 'https://...' }
 * - If summaryId is provided, updates existing record; otherwise creates new one
 * 
 * Optional parameters:
 * - diarize: boolean - Enable speaker diarization (default: false)
 * - language: string - Language code (default: 'en'). Supported: en, es, fr, de, it, pt, nl, ja, ko, zh, ru, hi, ar
 * - model: string - Deepgram model (default: 'general')
 * - smart_format: boolean - Enable smart formatting (default: true)
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const summaryId = req.body.summaryId || null;
  
  try {
    const audioUrl = req.body.audioUrl || null;
    const userId = req.body.userId || null;
    const title = req.body.title || 'Untitled';
    
    // Build Deepgram options from request parameters
    const deepgramOptions = buildDeepgramOptions({
      diarize: req.body.diarize,
      language: req.body.language,
      model: req.body.model,
      smart_format: req.body.smart_format,
    });
    
    console.log('Transcription options:', deepgramOptions);
    
    let deepgramResponse = null;
    if (audioUrl) {
      // Let Deepgram fetch the file directly from URL (recommended for large files)
      console.log('Requesting Deepgram to fetch audio URL:', audioUrl);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { url: audioUrl },
        deepgramOptions
      );
    } else if (req.file) {
      // File uploaded to local server — stream to Deepgram
      const filePath = req.file.path;
      console.log('Uploading local file to Deepgram:', filePath);
      const fileBuffer = fs.createReadStream(filePath);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { buffer: fileBuffer, mimetype: req.file.mimetype },
        deepgramOptions
      );
      // remove uploaded file to save disk
      fs.unlink(filePath, () => { });
    } else {
      return res.status(400).json({ error: 'Provide audio file or audioUrl' });
    }

    // Deepgram response available in deepgramResponse
    // Build chunks
    const chunks = buildChunksFromDeepgram(deepgramResponse);
    if (!chunks || chunks.length === 0) {
      // fallback: return raw transcript
      return res.json({ transcript: deepgramResponse, message: 'No chunks created' });
    }

    // Summarize each chunk sequentially (for long lists you may parallelize but be careful with rate limits)
    const chunkSummaries = [];
    for (const chunk of chunks) {
      // For safety: trim chunk text length
      const textForModel = chunk.text.length > 20000 ? chunk.text.slice(0, 20000) : chunk.text;
      const sum = await summarizeChunk(textForModel, chunk.index);
      // Add time labels for context
      sum.start = secondsToHMS(chunk.start);
      sum.end = secondsToHMS(chunk.end);
      // Store the original transcript text for this chunk (for readable display)
      sum.transcript_text = chunk.text;
      chunkSummaries.push(sum);
      console.log(`Summarized chunk ${chunk.index} (${sum.start} - ${sum.end})`);
    }

    // Create final executive summary
    const finalSummary = await summarizeSummaries(chunkSummaries);

    const responsePayload = {
      metadata: {
        duration_seconds: Math.ceil(deepgramResponse?.metadata?.duration || 0),
        chunk_minutes: CHUNK_MINUTES,
        chunks_count: chunks.length,
        // Include the options used for this transcription
        transcription_options: {
          diarize: deepgramOptions.diarize,
          language: deepgramOptions.language,
          model: deepgramOptions.model,
          smart_format: deepgramOptions.smart_format
        }
      },
      chunks: chunkSummaries,
      final_summary: finalSummary,
      raw_deepgram_response: deepgramResponse
    };


    //INTEGRATE DB HERE WITH USERID
    let savedData = null;
    if (summaryId) {
      // Update existing pending summary
      savedData = await updateTranscriptionResult(summaryId, responsePayload);
    } else if (userId) {
      // Create new summary (legacy flow)
      savedData = await saveTranscriptionResult(title, userId, responsePayload);
    }
    
    console.log("responsePayload", responsePayload);
    return res.json({ ...responsePayload, id: savedData?.id || summaryId });
  } catch (err) {
    // If we have a summaryId, mark it as failed
    if (summaryId) {
      await markTranscriptionFailed(summaryId, err?.message || 'Unknown error');
    }
    console.error('Error in /transcribe', err?.response?.data || err);
    return res.status(500).json({ error: err?.message || 'internal error', details: err?.response?.data || null });
  }
});

app.get('/api/getTranscription/:id', async (req, res) => {
  const transcriptionId = req.params.id;

  // Fetch transcription from database
  const { data: dbData, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', transcriptionId)
    .single();

  if (error) {
    console.error('Error fetching transcription:', error);
    res.status(500).json({ error: 'Error fetching transcription' });
  } else {
    res.json(dbData);
  }
});

app.get('/api/getTranscriptionsTitle/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Fetch transcription titles for user from database
  const { data: dbData, error } = await supabase
    .from('summaries')
    .select('id, title, created_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching transcription titles:', error);
    res.status(500).json({ error: 'Error fetching transcription titles' });
  } else {
    res.json(dbData);
  }
});

app.get('/api/getTranscriptions/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Fetch transcriptions for user from database
  const { data: dbData, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching transcriptions:', error);
    res.status(500).json({ error: 'Error fetching transcriptions' });
  } else {
    res.json(dbData);
  }
});

app.delete('/api/deleteTranscription/:id', async (req, res) => {
  const transcriptionId = req.params.id;
  console.log('Deleting transcription with ID:', transcriptionId);
  // Delete transcription from database
  const { data: dbData, error } = await supabase
    .from('summaries')
    .delete()
    .eq('id', transcriptionId);

  if (error) {
    console.error('Error deleting transcription:', error);
    res.status(500).json({ error: 'Error deleting transcription' });
  } else {
    res.json({ message: 'Transcription deleted successfully' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
