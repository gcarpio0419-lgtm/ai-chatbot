// --- 1. BROWSER SUPPORT CHECK ---
// We'll use a try-catch block to gracefully handle browsers that don't support the API.
try {
  // Check for the API and its prefixed versions
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  // If the API is supported, we can proceed to set up the app
  initializeApp(recognition);

} catch (e) {
  // If the API is not supported, log the error and update the UI
  console.error(e);
  const talkButton = document.getElementById('talkButton');
  talkButton.disabled = true;
  talkButton.querySelector('span').textContent = 'Browser Not Supported';
  alert('Sorry, your browser does not support the Web Speech API. Please try Chrome or Edge.');
}

/**
 * Main function to set up the application logic.
 * @param {SpeechRecognition} recognition - The Speech Recognition instance.
 */
function initializeApp(recognition) {
  // --- 2. GRAB DOM ELEMENTS AND INITIALIZE SOCKET.IO ---
  const socket = io();
  const talkButton = document.getElementById('talkButton');
  const conversationLog = document.getElementById('conversationLog');

  // --- 3. CONFIGURE SPEECH RECOGNITION ---
  recognition.lang = 'en-US';
  recognition.interimResults = false; // We only want the final, most confident transcript
  recognition.maxAlternatives = 1;

  // --- 4. SET UP EVENT LISTENERS ---

  // Start recognition when the talk button is clicked
  talkButton.addEventListener('click', () => {
    try {
      recognition.start();
    } catch(error) {
      // This can happen if recognition is already running
      console.error("Error starting speech recognition:", error);
      talkButton.classList.remove('listening');
    }
  });

  // Provide visual feedback when the API starts listening
  recognition.onstart = () => {
    talkButton.classList.add('listening');
    talkButton.querySelector('span').textContent = 'Listening...';
    console.log('Speech recognition started.');
  };

  // Stop the visual feedback when the API stops listening
  recognition.onend = () => {
    talkButton.classList.remove('listening');
    talkButton.querySelector('span').textContent = 'Talk';
    console.log('Speech recognition ended.');
  };

  // Process the recognized speech
  recognition.onresult = (event) => {
    // Get the transcript of the most recent speech recognition result
    const text = event.results[event.results.length - 1][0].transcript;
    
    addMessageToLog(text, 'user-message');
    
    // Send the recognized text to the server via Socket.IO
    socket.emit('chat message', text);
  };

  // Handle errors, such as microphone access denial
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    const errorMessage = `Error: ${event.error}. ${event.message || ''}`;
    addMessageToLog(errorMessage, 'error-message');
  };

  // Listen for the 'bot reply' event from the server
  socket.on('bot reply', (data) => {
    // Add the bot's text response to the conversation log
    addMessageToLog(data.text, 'bot-message');

    // If audio data is present, play it
    if (data.audio) {
      // Convert the ArrayBuffer from the server into a Blob
      const audioBlob = new Blob([data.audio], { type: 'audio/mpeg' });
      // Create a temporary URL for the Blob
      const audioUrl = URL.createObjectURL(audioBlob);
      // Create a new Audio object and play it
      const audio = new Audio(audioUrl);
      audio.play();
    }
  });

  /**
   * Helper function to create a message element and add it to the conversation log.
   * @param {string} message - The text content of the message.
   * @param {string} className - The CSS class for styling the message ('user-message', 'bot-message', or 'error-message').
   */
  function addMessageToLog(message, className) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', className);
    messageElement.textContent = message;
    conversationLog.appendChild(messageElement);
    // Automatically scroll to the latest message
    conversationLog.scrollTop = conversationLog.scrollHeight;
  }
}

