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

// Modèle Whisper (turbo = plus rapide, même qualité pour le français courant)
const WHISPER_MODEL = 'whisper-large-v3-turbo';

// Client instancié à la demande (lazy) pour ne pas crasher au démarrage
// si GROQ_API_KEY n'est pas encore chargée
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

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

    const transcription = await getGroq().audio.transcriptions.create({
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
  const m = (mimeType || '').toLowerCase();
  if (m.includes('ogg'))                      return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('webm'))                     return 'webm';
  if (m.includes('amr'))                      return 'amr';
  return 'ogg'; // fallback WhatsApp vocal = ogg/opus
}

module.exports = { transcribeAudio };
