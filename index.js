// Load environment variables from the .env file
require('dotenv').config();

// 1. Import necessary modules
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ElevenLabsClient } = require("elevenlabs");

// 2. Initialize servers, clients, and constants
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;

// --- API Client Initialization ---

// Check for and initialize Google Gemini client
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in the .env file.');
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// Check for and initialize ElevenLabs client
if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not set in the .env file.');
}
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// 3. Serve static files from the 'public' and 'views' directories
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 4. Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('A user connected via WebSocket');

  // Start a new chat session for this connected user
  // This gives the AI context and is a more robust way to interact.
  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: "You are a friendly and helpful chatbot named Sparky." }] },
      { role: "model", parts: [{ text: "Great! I'm Sparky, ready to chat and help out." }] },
    ],
  });

  // Listen for the 'chat message' event from the client
  socket.on('chat message', async (msg) => {
    console.log(`Message received from client: "${msg}"`);

    try {
      // --- Step A: Get AI Text Response from Gemini ---
      // Use the ongoing chat session to send the new message
      const result = await chat.sendMessage(msg);
      const response = await result.response;
      const aiText = response.text();
      console.log(`AI Text Response: "${aiText}"`);

      // --- Step B: Get AI Voice Response from ElevenLabs ---
      const audioStream = await elevenlabs.generate({
        voice: "Rachel", // You can change the voice to any other available voice
        text: aiText,
        model_id: "eleven_multilingual_v2"
      });
      
      // Convert the audio stream into a buffer that can be sent over Socket.IO
      const audioChunks = [];
      for await (const chunk of audioStream) {
        audioChunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(audioChunks);

      // --- Step C: Send both text and audio back to the client ---
      socket.emit('bot reply', { 
        text: aiText, 
        audio: audioBuffer 
      });

    } catch (error) {
      // --- IMPROVED ERROR LOGGING ---
      // This will print the detailed error message to your VS Code terminal
      console.error("--- DETAILED ERROR ---", error); 
      
      // Send a user-friendly error message back to the client
      socket.emit('bot reply', { 
        text: "I'm sorry, but I'm having a little trouble thinking right now. Could you try that again?" 
      });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// 5. Start the HTTP server
server.listen(PORT, () => {
  console.log(`Server is running and listening on http://localhost:${PORT}`);
});



