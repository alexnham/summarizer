/**
 * Node.js Express pipeline:
 * - accepts uploaded audio file or audio URL
 * - sends to Deepgram for transcription with diarization/timestamps
 * - splits transcript by time-chunks
 * - summarizes each chunk with OpenAI gpt-3.5-turbo (cheap)
 * - aggregates chunk summaries into a final executive summary
 *
 * Notes:
 * - Set DEEPGRAM_API_KEY and OPENAI_API_KEY in .env
 * - For large audio, use hosted file URL (Deepgram can pull from URL) or stream file.
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { Deepgram } = require('@deepgram/sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for server-side
const supabase = createClient(supabaseUrl, supabaseKey);


app.use(express.json());
app.use(cors());


const upload = multer({ dest: 'uploads/' });

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config
const CHUNK_MINUTES = parseInt(process.env.CHUNK_MINUTES || '7', 10); // chunk length in minutes
const CHUNK_SECONDS = CHUNK_MINUTES * 60;

// Default transcription options
const DEFAULT_TRANSCRIPTION_OPTIONS = {
  punctuate: true,
  diarize: false,        // Speaker diarization (multiple speakers)
  language: 'en',        // Language code (e.g., 'en', 'es', 'fr', 'de', 'ja', 'ko', 'zh')
  model: 'general',      // Deepgram model
  smart_format: true,    // Smart formatting
};

// Supported languages for reference
const SUPPORTED_LANGUAGES = [
  'en', 'en-US', 'en-GB', 'en-AU', 'en-IN',  // English variants
  'es', 'es-ES', 'es-419',                    // Spanish
  'fr', 'fr-FR', 'fr-CA',                     // French
  'de',                                        // German
  'it',                                        // Italian
  'pt', 'pt-BR', 'pt-PT',                     // Portuguese
  'nl',                                        // Dutch
  'ja',                                        // Japanese
  'ko',                                        // Korean
  'zh', 'zh-CN', 'zh-TW',                     // Chinese
  'ru',                                        // Russian
  'hi',                                        // Hindi
  'ar',                                        // Arabic
  'vi',                                        // Vietnamese
];

/**
 * Build Deepgram transcription options from request parameters
 * @param {Object} params - Request parameters
 * @returns {Object} Deepgram options object
 */
function buildDeepgramOptions(params = {}) {
  const options = { ...DEFAULT_TRANSCRIPTION_OPTIONS };
  
  // Enable/disable speaker diarization
  if (params.diarize !== undefined) {
    options.diarize = params.diarize === true || params.diarize === 'true';
  }
  
  // Set language
  if (params.language) {
    const lang = params.language.toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      options.language = lang;
    } else {
      console.warn(`Unsupported language: ${lang}, falling back to 'en'`);
    }
  }
  
  // Set model (optional)
  if (params.language == 'vi') {
    options.model = 'nova-3';
  }
  
  // Enable smart formatting (optional)
  if (params.smart_format !== undefined) {
    options.smart_format = params.smart_format === true || params.smart_format === 'true';
  }
  
  return options;
}

function secondsToHMS(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Group consecutive words by speaker and format with speaker labels.
 * Instead of "[Speaker 0] word [Speaker 0] word", produces "[Speaker 0] word word word"
 */
function formatWithSpeakerLabels(parts) {
  if (!parts || parts.length === 0) return '';

  // Check if any word has speaker info
  const hasSpeakers = parts.some(p => p.speaker !== null && p.speaker !== undefined);

  if (!hasSpeakers) {
    // No speaker info, just join words
    return parts.map(p => p.text).join(' ');
  }

  // Group consecutive words by same speaker
  const groups = [];
  let currentGroup = { speaker: parts[0].speaker, words: [parts[0].text] };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.speaker === currentGroup.speaker) {
      // Same speaker, add to current group
      currentGroup.words.push(part.text);
    } else {
      // Different speaker, start new group
      groups.push(currentGroup);
      currentGroup = { speaker: part.speaker, words: [part.text] };
    }
  }
  // Don't forget the last group
  groups.push(currentGroup);

  // Format each group with speaker label
  return groups.map(g => {
    const speakerLabel = g.speaker !== null && g.speaker !== undefined
      ? `[Speaker ${g.speaker}]: `
      : '';
    return speakerLabel + g.words.join(' ');
  }).join('\n\n');
}

/**
 * Convert Deepgram transcript / utterances into time-ordered segments of text per speaker.
 * Then group segments into time-chunks (CHUNK_SECONDS) and concatenate.
 */
function buildChunksFromDeepgram(result) {
  // Deepgram response structure varies slightly depending on options. We assume `results.channels[0].alternatives[0].words`
  // or `results.utterances` (Deepgram's utterances with speaker labels).
  // We'll handle both. The goal: produce array of words with start, end, speaker (if available), and text.
  const words = [];

  // Handle results.utterances (preferred when diarize true)
  if (result?.results?.utterances && Array.isArray(result.results.utterances)) {
    result.results.utterances.forEach(u => {
      // utterance has { start, end, speaker, transcript }
      words.push({
        start: u.start,
        end: u.end,
        speaker: u.speaker ?? null,
        text: u.transcript.trim()
      });
    });
  } else {
    // fallback: iterate words arrays
    const channels = result?.results?.channels || result?.results?.channel || [];
    // If it's an object rather than array:
    const chArr = Array.isArray(channels) ? channels : [result?.results?.channels]?.flat() ?? [];

    // Some Deepgram responses have results.channels[0].alternatives[0].words
    const wordsList = (chArr[0]?.alternatives?.[0]?.words) || [];
    for (const w of wordsList) {
      words.push({
        start: w.start,
        end: w.end,
        speaker: w.speaker ?? null,
        text: w.word
      });
    }
  }

  // If there are no structured words, fallback to using the full transcript text and a single chunk
  if (words.length === 0) {
    const fallback = (result?.results?.channels?.[0]?.alternatives?.[0]?.transcript)
      || (result?.results?.transcripts?.[0]?.transcript)
      || '';
    return [{
      start: 0,
      end: Math.ceil(result?.metadata?.duration || 0),
      text: fallback,
      speakers: null
    }];
  }

  // Group words into time buckets of CHUNK_SECONDS
  const chunks = [];
  // Determine total duration by last word end
  const totalDuration = Math.ceil(words[words.length - 1].end || (CHUNK_SECONDS));
  const numChunks = Math.ceil(totalDuration / CHUNK_SECONDS);

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = i * CHUNK_SECONDS;
    const chunkEnd = (i + 1) * CHUNK_SECONDS;
    const parts = words.filter(w => w.start >= chunkStart && w.start < chunkEnd);
    if (parts.length > 0) {
      // Group consecutive words by same speaker, then format with speaker labels
      const text = formatWithSpeakerLabels(parts);
      chunks.push({
        index: i,
        start: chunkStart,
        end: Math.min(chunkEnd, totalDuration),
        text
      });
    } else {
      // empty chunk: skip or include empty
    }
  }

  return chunks;
}

/**
 * Summarize a text chunk with OpenAI gpt-3.5-turbo (cheap).
 * We use a short prompt to get action items + summary + key quotes.
 */
async function summarizeChunk(chunkText, chunkIndex) {
  const prompt = `
You are a concise summarization assistant.

Input: transcript text excerpt from a meeting / podcast.

Produce JSON with keys:
- "chunk_index": integer
- "summary": short paragraph (2-4 sentences) summarizing the excerpt.
- "action_items": array of brief action items (if any)
- "key_points": array of 3-6 bullet points summarizing main topics
- "notable_quotes": array of up to 2 memorable short quotes (if present)

Transcript:
---
${chunkText}
---
Return only valid JSON.
  `;

  const res = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.1
  });

  // openai node client shape may vary; account for both `res.choices[0].message.content` or `res.choices[0].text`
  const text = res?.choices?.[0]?.message?.content || res?.choices?.[0]?.text || '';
  try {
    // Sometimes model returns explanation before JSON — try to find a JSON substring
    const firstBrace = text.indexOf('{');
    const jsonText = firstBrace >= 0 ? text.slice(firstBrace) : text;
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (err) {
    // fallback: return a minimal summary
    return {
      chunk_index: chunkIndex,
      summary: text.slice(0, 500),
      action_items: [],
      key_points: [],
      notable_quotes: []
    };
  }
}

/**
 * Summarize array of chunk summaries into an executive summary.
 */
async function summarizeSummaries(chunkSummaries) {
  const combined = chunkSummaries.map(c => `Chunk ${c.chunk_index}: ${c.summary}`).join('\n\n');
  const prompt = `
You are an assistant that consolidates summaries.

Input: multiple short chunk summaries. Produce a final executive summary (3-6 sentences), a short "Chapters" array that lists main topics and approximate time ranges (if inferable), and a consolidated "Action Items" list (deduplicated).

Input:
---
${combined}
---

Return JSON with keys:
- "executive_summary": string
- "chapters": [{ "title": "...", "start": "HH:MM:SS", "end": "HH:MM:SS", "notes": "..." }]
- "action_items": [ ... ]

Return only JSON.
  `;

  const res = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.1
  });
  const text = res?.choices?.[0]?.message?.content || res?.choices?.[0]?.text || '';
  try {
    const firstBrace = text.indexOf('{');
    const jsonText = firstBrace >= 0 ? text.slice(firstBrace) : text;
    return JSON.parse(jsonText);
  } catch (err) {
    return {
      executive_summary: combined.slice(0, 800),
      chapters: [],
      action_items: []
    };
  }
}

async function saveTranscriptionResult(title, userId, data) {
  // Example using Supabase


  const { data: dbData, error } = await supabase
    .from('summaries')
    .insert([
      {
        user_id: userId,
        title: title || 'Untitled',
        content: data.chunks ? JSON.stringify(data.chunks) : null,
        final_summary: data.final_summary ? JSON.stringify(data.final_summary.executive_summary) : null,
        transcript: data.raw_deepgram_response ? JSON.stringify(data.raw_deepgram_response.results.channels[0].alternatives[0].transcript) : null,
        created_at: new Date()
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving transcription result:', error);
    return null;
  } else {
    console.log('Transcription result saved for user:', userId);
    return dbData;
  }
}

async function updateTranscriptionResult(summaryId, data) {
  const { data: dbData, error } = await supabase
    .from('summaries')
    .update({
      content: data.chunks ? JSON.stringify(data.chunks) : null,
      final_summary: data.final_summary ? JSON.stringify(data.final_summary.executive_summary) : null,
      transcript: data.raw_deepgram_response ? JSON.stringify(data.raw_deepgram_response.results.channels[0].alternatives[0].transcript) : null,
      status: 'completed'
    })
    .eq('id', summaryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating transcription result:', error);
    return null;
  } else {
    console.log('Transcription result updated for summary:', summaryId);
    return dbData;
  }
}

async function markTranscriptionFailed(summaryId, errorMessage) {
  const { error } = await supabase
    .from('summaries')
    .update({
      status: 'failed',
      error_message: errorMessage
    })
    .eq('id', summaryId);

  if (error) {
    console.error('Error marking transcription as failed:', error);
  }
};

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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
