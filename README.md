# summarizer

Used to transcribe and summarize long audio files for my mom lol

## System Architecture & Data Flow

Built with angular, node.js + express, deepgram, openai models, vercel blobs, supabase + oauth

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Angular as Angular Frontend
    participant Blob as Vercel Blob Storage
    participant API as Node.js + Express API
    participant DG as Deepgram API
    participant OAI as OpenAI API
    participant DB as Supabase Database

    User ->> Angular: Record / Upload Audio
    Angular ->> Blob: Upload audio file
    Blob -->> Angular: Blob URL

    Angular ->> API: Send Blob URL + metadata
    API ->> Blob: Fetch audio file
    Blob -->> API: Audio stream

    API ->> DG: Transcribe audio
    DG -->> API: Transcript text

    API ->> OAI: Summarize transcript
    OAI -->> API: Summary

    API ->> DB: Save transcript + summary
    API -->> Angular: API Response

    Angular ->> Blob: Delete audio file
    Blob -->> Angular: Deletion confirmed

    Angular -->> User: Display results
```

## Try it out!

summarize.alexnham.com
