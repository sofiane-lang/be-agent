/**
 * transcription.js
 * Transcription de messages vocaux WhatsApp via Groq Whisper.
 *
 * Fonctions exportées :
 *  - transcribeAudio(audioBuffer, mimeType) : retourne le texte transcrit
 */

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const Groq   = require('groq-sdk');
const logger = require('./logger');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Modèle Whisper (turbo = plus rapide, même qualité pour le français courant)
const WHISPER_MODEL = 'whisper-large-v3-turbo';

/**
 * Transcrit un buffer audio en texte via Groq Whisper.
 *
 * @param {Buffer} audioBuffer - Contenu binaire du fichier audio
 * @param {string} mimeType    - Type MIME reçu de Meta (ex: "audio/ogg; codecs=opus")
 * @returns {Promise<string>}  - Texte transcrit
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  // Détermine l'extension à partir du type MIME
  const ext = resolveExtension(mimeType);
  const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}.${ext}`);

  try {
    fs.writeFileSync(tmpFile, audioBuffer);

    const transcription = await groq.audio.transcriptions.create({
      file:     fs.createReadStream(tmpFile),
      model:    WHISPER_MODEL,
      language: 'fr',
    });

    const text = transcription.text?.trim() || '';
    logger.info(`🎙️  Groq Whisper : transcription OK (${text.length} chars)`);
    return text;

  } finally {
    // Supprime le fichier temporaire dans tous les cas
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

/**
 * Retourne l'extension de fichier correspondant au type MIME.
 * WhatsApp envoie généralement de l'ogg/opus pour les vocaux.
 */
function resolveExtension(mimeType) {
  if (mimeType.includes('ogg'))             return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('webm'))            return 'webm';
  if (mimeType.includes('amr'))             return 'amr';
  return 'ogg'; // fallback
}

module.exports = { transcribeAudio };
