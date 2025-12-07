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

const app = express();
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config
const CHUNK_MINUTES = parseInt(process.env.CHUNK_MINUTES || '7', 10); // chunk length in minutes
const CHUNK_SECONDS = CHUNK_MINUTES * 60;

function secondsToHMS(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
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
      // join with speaker labels if available
      const text = parts.map(p => {
        if (p.speaker !== null && p.speaker !== undefined) {
          return `[Speaker ${p.speaker}] ${p.text}`;
        } else {
          return p.text;
        }
      }).join(' ');
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

/**
 * Endpoint: transcribe
 * - Accepts file upload via multipart form field `audio` OR JSON { audioUrl: 'https://...' }
 */
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioUrl = req.body.audioUrl || null;
    let deepgramResponse = null;
    if (audioUrl) {
      // Let Deepgram fetch the file directly from URL (recommended for large files)
      // Using Deepgram SDK: speech.long? We'll use SDK `.transcription.preRecorded` which accepts URL in sources
      console.log('Requesting Deepgram to fetch audio URL:', audioUrl);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { url: audioUrl },
        {
          punctuate: true,
          // diarize true if you want speaker separation (may cost a bit more)
          diarize: true,
          // set `model` if you want (e.g. 'general')
          // language: 'en-US'
        }
      );
    } else if (req.file) {
      // File uploaded to local server — stream to Deepgram
      const filePath = req.file.path;
      console.log('Uploading local file to Deepgram:', filePath);
      const fileBuffer = fs.createReadStream(filePath);
      deepgramResponse = await deepgram.transcription.preRecorded(
        { buffer: fileBuffer, mimetype: req.file.mimetype },
        { punctuate: true, diarize: true }
      );
      // remove uploaded file to save disk
      fs.unlink(filePath, () => {});
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
      chunkSummaries.push(sum);
      console.log(`Summarized chunk ${chunk.index} (${sum.start} - ${sum.end})`);
    }

    // Create final executive summary
    const finalSummary = await summarizeSummaries(chunkSummaries);

    const responsePayload = {
      metadata: {
        duration_seconds: Math.ceil(deepgramResponse?.metadata?.duration || 0),
        chunk_minutes: CHUNK_MINUTES,
        chunks_count: chunks.length
      },
      chunks: chunkSummaries,
      final_summary: finalSummary,
      raw_deepgram_response: deepgramResponse
    };

    return res.json(responsePayload);
  } catch (err) {
    console.error('Error in /transcribe', err?.response?.data || err);
    return res.status(500).json({ error: err?.message || 'internal error', details: err?.response?.data || null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
