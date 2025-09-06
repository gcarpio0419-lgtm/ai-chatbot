import os
from flask import Flask, request, jsonify, send_file
from TTS.api import TTS
import torch
import soundfile as sf

# --- NEW: Import the SECOND necessary class for the security fix ---
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig # This is the new class from the error log
from torch.serialization import add_safe_globals

# --- 1. SETUP ---

# Check if a GPU is available, otherwise use CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"XTTS is running on: {device}")

# Define a path for the temporary output audio file
output_path = os.path.join(os.getcwd(), "output.wav")

# Path to your voice sample for cloning
speaker_wav_path = os.path.join(os.getcwd(), "my_voice.wav")
if not os.path.exists(speaker_wav_path):
    raise ValueError(f"Voice sample not found at path: {speaker_wav_path}. Please add a 'my_voice.wav' file to the 'tts-server' directory.")

# --- NEW: Apply the security fix for BOTH classes BEFORE loading the model ---
# This tells PyTorch that both custom classes from the TTS library are safe to load.
add_safe_globals([XttsConfig, XttsAudioConfig])

# Initialize the XTTS model.
print("Loading XTTS model... (This will take a few minutes on the first run)")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("XTTS model loaded successfully.")

# Initialize the Flask web server
app = Flask(__name__)

# --- 2. API ENDPOINT ---

@app.route('/synthesize', methods=['POST'])
def synthesize():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided in JSON body"}), 400

    text = data.get('text')
    
    try:
        print(f"Synthesizing text with cloned voice: '{text}'")
        
        tts.tts_to_file(
            text=text,
            speaker_wav=speaker_wav_path,
            language="en",
            file_path=output_path
        )
        
        return send_file(output_path, mimetype='audio/wav')

    except Exception as e:
        print(f"Error during TTS synthesis: {e}")
        return jsonify({"error": "Failed to generate audio"}), 500

# --- 3. RUN THE SERVER ---

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)