const axios = require("axios");
const FormData = require("form-data");

/**
 * Transcreve áudio usando Groq Whisper
 * @param {Buffer} audioBuffer - Buffer do arquivo de áudio
 * @param {string} mimeType - Tipo do arquivo (audio/ogg, audio/mp4, etc)
 * @returns {string} Texto transcrito
 */
async function transcribeAudio(audioBuffer, mimeType = "audio/ogg") {
  const form = new FormData();

  // Determina extensão pelo mime type
  const extMap = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/opus": "opus",
  };
  const ext = extMap[mimeType] || "ogg";

  form.append("file", audioBuffer, {
    filename: `audio.${ext}`,
    contentType: mimeType,
  });
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "text");

  const response = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
      timeout: 30000,
    }
  );

  return response.data.trim();
}

module.exports = { transcribeAudio };
