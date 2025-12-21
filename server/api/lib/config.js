/**
 * Shared configuration and utilities for Vercel serverless functions
 */

const { Deepgram } = require('@deepgram/sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config
const CHUNK_MINUTES = parseInt(process.env.CHUNK_MINUTES || '7', 10);
const CHUNK_SECONDS = CHUNK_MINUTES * 60;

// Default transcription options
const DEFAULT_TRANSCRIPTION_OPTIONS = {
  punctuate: true,
  diarize: false,
  language: 'en',
  model: 'general',
  smart_format: true,
};

// Supported languages
const SUPPORTED_LANGUAGES = [
  'en', 'en-US', 'en-GB', 'en-AU', 'en-IN',
  'es', 'es-ES', 'es-419',
  'fr', 'fr-FR', 'fr-CA',
  'de',
  'it',
  'pt', 'pt-BR', 'pt-PT',
  'nl',
  'ja',
  'ko',
  'zh', 'zh-CN', 'zh-TW',
  'ru',
  'hi',
  'ar',
  'vi',
];

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://summarize.alexnham.com',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle CORS preflight requests
 */
function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).set(corsHeaders).end();
    return true;
  }
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return false;
}

/**
 * Build Deepgram transcription options from request parameters
 */
function buildDeepgramOptions(params = {}) {
  const options = { ...DEFAULT_TRANSCRIPTION_OPTIONS };
  
  if (params.diarize !== undefined) {
    options.diarize = params.diarize === true || params.diarize === 'true';
  }
  
  if (params.language) {
    const lang = params.language.toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      options.language = lang;
    } else {
      console.warn(`Unsupported language: ${lang}, falling back to 'en'`);
    }
  }
  
  if (params.language === 'vi') {
    options.model = 'nova-3';
  }
  
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
 */
function formatWithSpeakerLabels(parts) {
  if (!parts || parts.length === 0) return '';

  const hasSpeakers = parts.some(p => p.speaker !== null && p.speaker !== undefined);

  if (!hasSpeakers) {
    return parts.map(p => p.text).join(' ');
  }

  const groups = [];
  let currentGroup = { speaker: parts[0].speaker, words: [parts[0].text] };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.speaker === currentGroup.speaker) {
      currentGroup.words.push(part.text);
    } else {
      groups.push(currentGroup);
      currentGroup = { speaker: part.speaker, words: [part.text] };
    }
  }
  groups.push(currentGroup);

  return groups.map(g => {
    const speakerLabel = g.speaker !== null && g.speaker !== undefined
      ? `[Speaker ${g.speaker}]: `
      : '';
    return speakerLabel + g.words.join(' ');
  }).join('\n\n');
}

/**
 * Convert Deepgram transcript into time-ordered chunks
 */
function buildChunksFromDeepgram(result) {
  const words = [];

  if (result?.results?.utterances && Array.isArray(result.results.utterances)) {
    result.results.utterances.forEach(u => {
      words.push({
        start: u.start,
        end: u.end,
        speaker: u.speaker ?? null,
        text: u.transcript.trim()
      });
    });
  } else {
    const channels = result?.results?.channels || result?.results?.channel || [];
    const chArr = Array.isArray(channels) ? channels : [result?.results?.channels]?.flat() ?? [];
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

  const chunks = [];
  const totalDuration = Math.ceil(words[words.length - 1].end || CHUNK_SECONDS);
  const numChunks = Math.ceil(totalDuration / CHUNK_SECONDS);

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = i * CHUNK_SECONDS;
    const chunkEnd = (i + 1) * CHUNK_SECONDS;
    const parts = words.filter(w => w.start >= chunkStart && w.start < chunkEnd);
    if (parts.length > 0) {
      const text = formatWithSpeakerLabels(parts);
      chunks.push({
        index: i,
        start: chunkStart,
        end: Math.min(chunkEnd, totalDuration),
        text
      });
    }
  }

  return chunks;
}

/**
 * Summarize a text chunk with OpenAI
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

  const text = res?.choices?.[0]?.message?.content || res?.choices?.[0]?.text || '';
  try {
    const firstBrace = text.indexOf('{');
    const jsonText = firstBrace >= 0 ? text.slice(firstBrace) : text;
    return JSON.parse(jsonText);
  } catch (err) {
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
 * Summarize array of chunk summaries into an executive summary
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

/**
 * Save transcription result to database
 */
async function saveTranscriptionResult(title, userId, data) {
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
  }
  return dbData;
}

/**
 * Update existing transcription result
 */
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
  }
  return dbData;
}

/**
 * Mark transcription as failed
 */
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
}

module.exports = {
  supabase,
  deepgram,
  openai,
  CHUNK_MINUTES,
  CHUNK_SECONDS,
  corsHeaders,
  handleCors,
  buildDeepgramOptions,
  secondsToHMS,
  formatWithSpeakerLabels,
  buildChunksFromDeepgram,
  summarizeChunk,
  summarizeSummaries,
  saveTranscriptionResult,
  updateTranscriptionResult,
  markTranscriptionFailed,
};
