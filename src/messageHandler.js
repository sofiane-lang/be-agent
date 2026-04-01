/**
 * messageHandler.js
 * Orchestre le traitement d'un message WhatsApp entrant :
 *   1. Marque le message comme lu
 *   2. Récupère l'historique depuis Google Sheets
 *   3. Génère une réponse via Claude
 *   4. Envoie la réponse WhatsApp
 *   5. Persiste l'échange dans Google Sheets
 */

const { markAsRead, sendTextMessage, getMediaUrl, downloadMedia } = require('./whatsapp');
const { generateReply }               = require('./claude');
const { getConversationHistory, appendConversation } = require('./sheets');
const { transcribeAudio }             = require('./transcription');
const logger = require('./logger');

/**
 * Message envoyé quand le type reçu n'est pas un texte.
 * Personnalisable librement.
 */
const UNSUPPORTED_TYPE_MSG =
  "Je suis désolé, je ne peux traiter que les messages texte pour l'instant. " +
  'Merci de m\'envoyer votre demande par écrit 🙏';

/**
 * Traite un message entrant de bout en bout.
 *
 * @param {Object} parsed  - Objet retourné par parseIncomingMessage()
 *   { messageId, from, name, type, text, timestamp }
 */
async function handleMessage(parsed) {
  const { messageId, from, name, type } = parsed;
  let { text } = parsed;

  logger.info(`📨 Message reçu de ${name} (${from}) | type: ${type}`);

  // 1. Accusé de réception (double ✓ bleu)
  await markAsRead(messageId);

  // 2. Gestion des types non-texte
  if (type === 'audio' && parsed.mediaId) {
    // Message vocal → transcription Groq Whisper
    try {
      logger.info(`🎙️  Vocal reçu de ${from} — transcription en cours…`);
      const mediaUrl    = await getMediaUrl(parsed.mediaId);
      const audioBuffer = await downloadMedia(mediaUrl);
      text              = await transcribeAudio(audioBuffer, parsed.mimeType);
      logger.info(`🎙️  Transcrit (${from}) : "${text.substring(0, 100)}"`);
    } catch (err) {
      logger.error(`❌ Transcription audio échouée pour ${from} : ${err.message}`);
      await sendTextMessage(from, UNSUPPORTED_TYPE_MSG);
      await appendConversation({
        phone:    from,
        name,
        incoming: '[audio]',
        reply:    UNSUPPORTED_TYPE_MSG,
        status:   'transcription_échouée',
      });
      return;
    }
  } else if (type !== 'text' || !text) {
    // Image, document ou autre type non supporté
    logger.info(`↩️  Type non supporté "${type}" → réponse automatique`);
    await sendTextMessage(from, UNSUPPORTED_TYPE_MSG);
    await appendConversation({
      phone:    from,
      name,
      incoming: `[${type}]`,
      reply:    UNSUPPORTED_TYPE_MSG,
      status:   'type_non_supporté',
    });
    return;
  }

  // 3. Récupération de l'historique (contexte pour Claude)
  let history = [];
  try {
    history = await getConversationHistory(from, 10);
  } catch (err) {
    // Non bloquant : on continue sans historique
    logger.warn(`⚠️  Impossible de charger l'historique de ${from} : ${err.message}`);
  }

  // 4. Génération de la réponse par Claude
  // Ne passer le prénom que si connu (évite "Bonjour Inconnu" ou "[Prénom]")
  const knownName = (name && name !== 'Inconnu') ? name : '';

  let reply;
  try {
    reply = await generateReply(text, history, knownName);
  } catch (err) {
    logger.error(`❌ Claude erreur pour ${from} : ${err.message}`);
    reply = "Je rencontre une difficulté technique momentanée. Merci de réessayer dans quelques instants 🙏";
  }

  // 5. Envoi de la réponse WhatsApp
  await sendTextMessage(from, reply);

  // 6. Persistance dans Google Sheets
  // Si le message d'origine était un vocal, on le note dans le log Sheets
  const incomingLog = (type === 'audio') ? `[vocal] ${text}` : text;
  try {
    await appendConversation({ phone: from, name, incoming: incomingLog, reply });
  } catch (err) {
    // Non bloquant : l'échange a eu lieu même si le log échoue
    logger.error(`❌ Sheets append échoué pour ${from} : ${err.message}`);
  }
}

module.exports = { handleMessage };
