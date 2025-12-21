const {
  deepgram,
  buildDeepgramOptions,
  secondsToHMS,
  buildChunksFromDeepgram,
  summarizeChunk,
  summarizeSummaries,
  saveTranscriptionResult,
  updateTranscriptionResult,
  markTranscriptionFailed,
  CHUNK_MINUTES,
} = require('./lib/config');
const busboy = require('busboy');

// CORS headers
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com';

// Vercel serverless config (CommonJS export)
module.exports.config = {
  api: {
    bodyParser: false, // Disable default body parser for multipart
  },
};

/**
 * Parse multipart form data for Vercel
 * Returns { fields, file } where file is { buffer, mimetype, filename }
 */
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let fileBuffer = null;
    let fileMimetype = null;
    let fileName = null;

    const bb = busboy({ headers: req.headers });

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      fileName = filename;
      fileMimetype = mimeType;
      
      const chunks = [];
      file.on('data', (data) => {
        chunks.push(data);
      });
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('finish', () => {
      resolve({
        fields,
        file: fileBuffer ? { buffer: fileBuffer, mimetype: fileMimetype, filename: fileName } : null,
      });
    });

    bb.on('error', reject);

    req.pipe(bb);
  });
}

/**
 * POST /api/transcribe
 * Accepts file upload via multipart form field `audio` OR JSON { audioUrl: 'https://...' }
 * 
 * Optional parameters:
 * - diarize: boolean - Enable speaker diarization (default: false)
 * - language: string - Language code (default: 'en')
 * - model: string - Deepgram model (default: 'general')
 * - smart_format: boolean - Enable smart formatting (default: true)
 * - summaryId: string - ID of existing pending summary to update
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let summaryId = null;

  try {
    let audioUrl = null;
    let userId = null;
    let title = 'Untitled';
    let diarize, language, model, smart_format;
    let fileData = null;

    // Check content type to determine how to parse the request
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const { fields, file } = await parseMultipartForm(req);
      
      summaryId = fields.summaryId || null;
      audioUrl = fields.audioUrl || null;
      userId = fields.userId || null;
      title = fields.title || 'Untitled';
      diarize = fields.diarize;
      language = fields.language;
      model = fields.model;
      smart_format = fields.smart_format;
      fileData = file;
    } else {
      // Parse JSON body
      const body = req.body || {};
      summaryId = body.summaryId || null;
      audioUrl = body.audioUrl || null;
      userId = body.userId || null;
      title = body.title || 'Untitled';
      diarize = body.diarize;
      language = body.language;
      model = body.model;
      smart_format = body.smart_format;
    }

    // Build Deepgram options from request parameters
    const deepgramOptions = buildDeepgramOptions({
      diarize,
      language,
      model,
      smart_format,
    });

    console.log('Transcription options:', deepgramOptions);

    let deepgramResponse = null;

    if (audioUrl) {
      // Let Deepgram fetch the file directly from URL
      console.log('Requesting Deepgram to fetch audio URL:', audioUrl);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { url: audioUrl },
        deepgramOptions
      );
    } else if (fileData) {
      // Send buffer directly to Deepgram
      console.log('Uploading file buffer to Deepgram:', fileData.filename);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { buffer: fileData.buffer, mimetype: fileData.mimetype },
        deepgramOptions
      );
    } else {
      return res.status(400).json({ error: 'Provide audio file or audioUrl' });
    }

    // Build chunks from Deepgram response
    const chunks = buildChunksFromDeepgram(deepgramResponse);
    if (!chunks || chunks.length === 0) {
      return res.status(200).json({ transcript: deepgramResponse, message: 'No chunks created' });
    }

    // Summarize each chunk
    const chunkSummaries = [];
    for (const chunk of chunks) {
      const textForModel = chunk.text.length > 20000 ? chunk.text.slice(0, 20000) : chunk.text;
      const sum = await summarizeChunk(textForModel, chunk.index);
      sum.start = secondsToHMS(chunk.start);
      sum.end = secondsToHMS(chunk.end);
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

    // Save to database
    let savedData = null;
    if (summaryId) {
      savedData = await updateTranscriptionResult(summaryId, responsePayload);
    } else if (userId) {
      savedData = await saveTranscriptionResult(title, userId, responsePayload);
    }

    console.log('responsePayload created successfully');
    return res.status(200).json({ ...responsePayload, id: savedData?.id || summaryId });

  } catch (err) {
    // Mark as failed if we have a summaryId
    if (summaryId) {
      await markTranscriptionFailed(summaryId, err?.message || 'Unknown error');
    }
    console.error('Error in /transcribe', err?.response?.data || err);
    return res.status(500).json({ error: err?.message || 'Internal error', details: err?.response?.data || null });
  }
};
