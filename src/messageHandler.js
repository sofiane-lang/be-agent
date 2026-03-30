/**
 * messageHandler.js
 * Orchestre le traitement d'un message WhatsApp entrant :
 *   1. Marque le message comme lu
 *   2. Récupère l'historique depuis Google Sheets
 *   3. Génère une réponse via Claude
 *   4. Envoie la réponse WhatsApp
 *   5. Persiste l'échange dans Google Sheets
 */

const { markAsRead, sendTextMessage } = require('./whatsapp');
const { generateReply }               = require('./claude');
const { getConversationHistory, appendConversation } = require('./sheets');
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
  const { messageId, from, name, type, text } = parsed;

  logger.info(`📨 Message reçu de ${name} (${from}) | type: ${type}`);

  // 1. Accusé de réception (double ✓ bleu)
  await markAsRead(messageId);

  // 2. Gestion des types non-texte
  if (type !== 'text' || !text) {
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
  let reply;
  try {
    reply = await generateReply(text, history, name);
  } catch (err) {
    logger.error(`❌ Claude erreur pour ${from} : ${err.message}`);
    reply = "Je rencontre une difficulté technique momentanée. Merci de réessayer dans quelques instants 🙏";
  }

  // 5. Envoi de la réponse WhatsApp
  await sendTextMessage(from, reply);

  // 6. Persistance dans Google Sheets
  try {
    await appendConversation({ phone: from, name, incoming: text, reply });
  } catch (err) {
    // Non bloquant : l'échange a eu lieu même si le log échoue
    logger.error(`❌ Sheets append échoué pour ${from} : ${err.message}`);
  }
}

module.exports = { handleMessage };
