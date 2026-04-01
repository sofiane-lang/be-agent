/**
 * telegram.js
 * Envoi d'alertes et de notifications vers un bot Telegram.
 *
 * Fonctions exportées :
 *  - sendAlert(service, errorType, detail) → alerte 🔴 (erreur critique)
 *  - sendInfo(service, message)            → notification 🟢 (info)
 *
 * Si TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ne sont pas configurés,
 * les fonctions s'exécutent en silence sans erreur.
 */

const axios  = require('axios');
const logger = require('./logger');

/**
 * Envoie un message au bot Telegram.
 * @param {string} text - Texte brut à envoyer
 */
async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Silencieux si non configuré — ne bloque jamais l'app
  if (!token || !chatId) return;

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text },
      { timeout: 5000 }
    );
  } catch (err) {
    // Ne jamais laisser une alerte Telegram crasher l'app
    logger.warn(`⚠️  Telegram : envoi échoué — ${err.message}`);
  }
}

/**
 * Alerte critique (rouge) — erreur de service.
 *
 * Format :
 * 🔴 [service] — [errorType]
 * Heure : [HH:MM:SS DD/MM/YYYY]
 * Détail : [detail]
 *
 * @param {string} service   - Nom du service (ex: "Anthropic", "WhatsApp", "be-agent")
 * @param {string} errorType - Type d'erreur (ex: "5 erreurs consécutives")
 * @param {string} detail    - Message d'erreur détaillé
 */
async function sendAlert(service, errorType, detail) {
  const ts   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const text = `🔴 ${service} — ${errorType}\nHeure : ${ts}\nDétail : ${detail}`;
  logger.warn(`🔴 Alerte Telegram → ${service} : ${errorType}`);
  await sendTelegram(text);
}

/**
 * Notification info (vert) — événement normal.
 *
 * @param {string} service - Nom du service
 * @param {string} message - Message informatif
 */
async function sendInfo(service, message) {
  const ts   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const text = `🟢 ${service} — ${message}\nHeure : ${ts}`;
  logger.info(`🟢 Info Telegram → ${service} : ${message}`);
  await sendTelegram(text);
}

module.exports = { sendAlert, sendInfo };
