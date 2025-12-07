# summarizer

Used to summarize long audio files for my mom lol

Built with node.js, deepgram and openai models

usage of server

npm install

npm run start

transcribe endpoint

curl -X POST -F "audio=@C:/Users/Alex/Downloads/call.mp3" http://localhost:3000/transcribe