/**
 * whatsapp.js
 * Client pour l'API WhatsApp Business Cloud (Meta Graph API).
 *
 * Fonctions exportées :
 *  - sendTextMessage(to, text)   : envoie un message texte
 *  - markAsRead(messageId)       : marque un message comme lu (double ✓ bleu)
 *  - parseIncomingMessage(body)  : extrait les données utiles du webhook
 */

const axios = require('axios');
const logger = require('./logger');

// URL de base construite depuis les variables d'environnement
function getApiUrl() {
  const version = process.env.META_API_VERSION || 'v19.0';
  const phoneId = process.env.PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${version}/${phoneId}/messages`;
}

// Headers d'authentification communs
function getHeaders() {
  // Nettoie le token au cas où le nom de la variable serait inclus par erreur
  let token = (process.env.WHATSAPP_TOKEN || '').trim();
  if (token.startsWith('WHATSAPP_TOKEN=')) token = token.slice('WHATSAPP_TOKEN='.length);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Envoie un message texte à un numéro WhatsApp.
 *
 * @param {string} to   - Numéro destinataire (format international sans +, ex: 33612345678)
 * @param {string} text - Contenu du message
 * @returns {Promise<Object>} - Réponse API Meta
 */
async function sendTextMessage(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  try {
    const { data } = await axios.post(getApiUrl(), payload, { headers: getHeaders() });
    logger.info(`📤 WhatsApp : message envoyé → ${to} (id: ${data.messages?.[0]?.id})`);
    return data;
  } catch (err) {
    // Log détaillé de l'erreur Meta
    const detail = err.response?.data?.error?.message || err.message;
    logger.error(`❌ WhatsApp sendTextMessage échoué → ${to} : ${detail}`);
    throw err;
  }
}

/**
 * Marque un message reçu comme lu (affiche les ✓✓ bleus côté utilisateur).
 *
 * @param {string} messageId - ID du message entrant (wamid.xxx)
 */
async function markAsRead(messageId) {
  const version = process.env.META_API_VERSION || 'v19.0';
  const phoneId = process.env.PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  try {
    await axios.post(url, payload, { headers: getHeaders() });
    logger.debug(`👁️  WhatsApp : message ${messageId} marqué comme lu`);
  } catch (err) {
    // Non bloquant : on logue mais on ne throw pas
    logger.warn(`⚠️  WhatsApp markAsRead échoué (${messageId}) : ${err.message}`);
  }
}

/**
 * Extrait et normalise les données d'un message entrant depuis le payload webhook Meta.
 *
 * @param {Object} body - Corps brut de la requête POST webhook
 * @returns {Object|null} - { messageId, from, name, type, text } ou null si non pertinent
 */
function parseIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // Ignore les événements de statut (delivered, read, sent)
    if (value?.statuses) return null;

    const messages = value?.messages;
    if (!messages?.length) return null;

    const msg     = messages[0];
    const contact = value?.contacts?.[0];

    return {
      messageId: msg.id,
      from:      msg.from,                          // numéro sans "+"
      name:      contact?.profile?.name || 'Inconnu',
      type:      msg.type,                          // text | audio | image | document | ...
      text:      msg.type === 'text' ? msg.text?.body : null,
      timestamp: parseInt(msg.timestamp, 10),
    };
  } catch (err) {
    logger.error(`❌ parseIncomingMessage erreur : ${err.message}`);
    return null;
  }
}

module.exports = { sendTextMessage, markAsRead, parseIncomingMessage };
