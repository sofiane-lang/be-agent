/**
 * sheets.js
 * Toutes les interactions avec Google Sheets via l'API googleapis.
 *
 * Fonctions exportées :
 *  - initSheets()          : authentifie le client Google
 *  - appendConversation()  : ajoute une ligne conversation
 *  - getConversationHistory() : lit l'historique d'un numéro
 *  - getDailyStats()       : statistiques du jour pour le rapport
 */

const { google } = require('googleapis');
const logger = require('./logger');

// Client Sheets réutilisé après init
let sheetsClient = null;

/**
 * Construit les credentials depuis le fichier JSON ou la variable d'env.
 */
function getCredentials() {
  // Priorité à la variable d'env (utile pour Railway, Render, etc.)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON invalide (JSON malformé)');
    }
  }

  // Sinon, lecture du fichier local
  const fs = require('fs');
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './credentials/google-service-account.json';
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier credentials introuvable : ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Initialise et retourne le client Google Sheets authentifié.
 * Utilise un singleton pour ne s'authentifier qu'une seule fois.
 */
async function initSheets() {
  if (sheetsClient) return sheetsClient;

  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  logger.info('✅ Google Sheets : authentification réussie');
  return sheetsClient;
}

/**
 * Ajoute une ligne dans l'onglet des conversations.
 * Colonnes : Date | Heure | Numéro | Prénom | Message reçu | Réponse bot | Statut
 *
 * @param {Object} data
 * @param {string} data.phone    - Numéro WhatsApp (ex: 33612345678)
 * @param {string} data.name     - Prénom / nom du contact
 * @param {string} data.incoming - Message reçu
 * @param {string} data.reply    - Réponse envoyée par le bot
 * @param {string} [data.status] - Statut optionnel (ex: "traité", "escaladé")
 */
async function appendConversation({ phone, name, incoming, reply, status = 'traité' }) {
  const sheets = await initSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tab    = process.env.GOOGLE_SHEET_TAB || 'SUIVI DES APPELS';

  const now  = new Date();
  const date = now.toLocaleDateString('fr-FR');
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const row = [date, time, phone, name, incoming, reply, status];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tab}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  logger.debug(`📝 Sheets : ligne ajoutée pour ${phone}`);
}

/**
 * Récupère les N derniers échanges d'un numéro pour alimenter
 * le contexte conversationnel de Claude.
 *
 * @param {string} phone  - Numéro WhatsApp
 * @param {number} limit  - Nombre de messages à récupérer (défaut : 10)
 * @returns {Array<{role: string, content: string}>}
 */
async function getConversationHistory(phone, limit = 10) {
  const sheets = await initSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tab    = process.env.GOOGLE_SHEET_TAB || 'SUIVI DES APPELS';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A:G`,
  });

  const rows = response.data.values || [];
  // Filtre les lignes de ce numéro (colonne C = index 2)
  const userRows = rows.filter((r) => r[2] === phone);

  // Retourne les `limit` derniers sous forme messages Claude
  return userRows.slice(-limit).flatMap((r) => [
    { role: 'user',      content: r[4] || '' }, // message reçu
    { role: 'assistant', content: r[5] || '' }, // réponse bot
  ]);
}

/**
 * Calcule des statistiques simples sur la journée en cours.
 * Utilisé par le rapport cron quotidien.
 *
 * @returns {{ total: number, numbers: string[], topHour: string }}
 */
async function getDailyStats() {
  const sheets = await initSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tab    = process.env.GOOGLE_SHEET_TAB || 'SUIVI DES APPELS';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A:G`,
  });

  const rows = response.data.values || [];
  const today = new Date().toLocaleDateString('fr-FR');

  // Filtre les lignes du jour (colonne A = index 0)
  const todayRows = rows.filter((r) => r[0] === today);

  // Numéros uniques
  const numbers = [...new Set(todayRows.map((r) => r[2]).filter(Boolean))];

  // Heure de pointe (colonne B = index 1, format HH:MM)
  const hourCount = {};
  todayRows.forEach((r) => {
    const h = (r[1] || '').split(':')[0];
    if (h) hourCount[h] = (hourCount[h] || 0) + 1;
  });
  const topHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return { total: todayRows.length, numbers, topHour };
}

module.exports = { initSheets, appendConversation, getConversationHistory, getDailyStats };
