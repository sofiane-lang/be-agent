/**
 * server.js
 * Point d'entrée principal de l'agent WhatsApp.
 *
 * Routes :
 *  GET  /webhook  → vérification Meta (handshake)
 *  POST /webhook  → réception des messages entrants
 *  GET  /health   → health-check public (Railway, monitoring)
 */

// Charge les variables d'environnement en premier
require('dotenv').config();

const express = require('express');
const { parseIncomingMessage } = require('./src/whatsapp');
const { handleMessage }        = require('./src/messageHandler');
const { initSheets }           = require('./src/sheets');
const { startCronJobs }        = require('./src/cron');
const { sendAlert, sendInfo }  = require('./src/telegram');
const logger                   = require('./src/logger');

// ─────────────────────────────────────────────
//  Handlers globaux — erreurs non capturées
// ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error(`💥 uncaughtException : ${err.message}`, { stack: err.stack });
  sendAlert('be-agent', 'Crash — uncaughtException', err.message).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? reason.message : String(reason);
  logger.error(`💥 unhandledRejection : ${detail}`);
  sendAlert('be-agent', 'Crash — unhandledRejection', detail);
});

const app  = express();
const PORT = process.env.PORT || 8080;

// Parse le JSON entrant (webhooks Meta)
app.use(express.json());

// ─────────────────────────────────────────────
//  GET /webhook  — Vérification Meta (1 seule fois à la config)
// ─────────────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    logger.info('✅ Webhook Meta : vérification réussie');
    return res.status(200).send(challenge);
  }

  logger.warn(`⚠️  Webhook Meta : token invalide reçu → "${token}"`);
  return res.sendStatus(403);
});

// ─────────────────────────────────────────────
//  POST /webhook  — Réception des événements Meta
// ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Répondre 200 immédiatement pour éviter les renvois de Meta
  res.sendStatus(200);

  try {
    const body = req.body;

    // Vérifie que c'est bien un événement WhatsApp Business
    if (body.object !== 'whatsapp_business_account') return;

    const parsed = parseIncomingMessage(body);

    // Ignore si ce n'est pas un message exploitable (ex: statuts de livraison)
    if (!parsed) return;

    // Traitement asynchrone (le 200 est déjà parti)
    await handleMessage(parsed);

  } catch (err) {
    logger.error(`❌ Erreur POST /webhook : ${err.message}`, { stack: err.stack });
  }
});

// ─────────────────────────────────────────────
//  GET /health  — Endpoint de santé
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    uptime:  Math.floor(process.uptime()),
    env:     process.env.NODE_ENV || 'development',
    ts:      new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  Démarrage du serveur
// ─────────────────────────────────────────────
async function bootstrap() {
  try {
    // Initialise Google Sheets dès le démarrage (fail-fast si mal configuré)
    await initSheets();

    // Démarre les tâches cron planifiées
    startCronJobs();

    app.listen(PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
      logger.info(`   • Webhook : POST/GET http://localhost:${PORT}/webhook`);
      logger.info(`   • Santé   : GET      http://localhost:${PORT}/health`);
      // Notification Telegram — visible à chaque redémarrage Railway
      sendInfo('be-agent', 'Serveur démarré ✓');
    });
  } catch (err) {
    logger.error(`💥 Échec du démarrage : ${err.message}`);
    sendAlert('be-agent', 'Échec du démarrage', err.message).finally(() => {
      process.exit(1);
    });
  }
}

bootstrap();
