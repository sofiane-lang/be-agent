/**
 * cron.js
 * Tâches planifiées via node-cron.
 *
 * Tâches configurées :
 *  1. Rapport quotidien  → envoyé à l'admin WhatsApp selon CRON_DAILY_REPORT
 *  2. Health-check       → log de vie toutes les heures
 *
 * Appeler startCronJobs() au démarrage du serveur.
 */

const cron = require('node-cron');
const { getDailyStats } = require('./sheets');
const { sendTextMessage } = require('./whatsapp');
const logger = require('./logger');

/**
 * Génère et envoie le rapport quotidien à l'administrateur.
 */
async function sendDailyReport() {
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!adminNumber) {
    logger.warn('⏰ Cron rapport : ADMIN_WHATSAPP_NUMBER non défini, rapport ignoré');
    return;
  }

  try {
    logger.info('⏰ Cron : génération du rapport quotidien...');
    const stats = await getDailyStats();

    const rapport = [
      `📊 *Rapport quotidien — ${new Date().toLocaleDateString('fr-FR')}*`,
      ``,
      `💬 Messages traités : *${stats.total}*`,
      `👤 Contacts uniques : *${stats.numbers.length}*`,
      `🕐 Heure de pointe  : *${stats.topHour}h*`,
      ``,
      `✅ Bot opérationnel — bonne journée !`,
    ].join('\n');

    await sendTextMessage(adminNumber, rapport);
    logger.info(`⏰ Cron : rapport envoyé à ${adminNumber}`);
  } catch (err) {
    logger.error(`❌ Cron rapport quotidien échoué : ${err.message}`);
  }
}

/**
 * Log de santé toutes les heures pour confirmer que le process tourne.
 */
function healthCheck() {
  const uptime = Math.floor(process.uptime() / 60);
  logger.info(`💚 Health-check : serveur actif depuis ${uptime} minute(s)`);
}

/**
 * Démarre toutes les tâches planifiées.
 * À appeler une seule fois au démarrage de l'application.
 */
function startCronJobs() {
  // --- Rapport quotidien ---
  const dailyCron = process.env.CRON_DAILY_REPORT || '0 8 * * *';

  if (!cron.validate(dailyCron)) {
    logger.error(`❌ Cron expression invalide : "${dailyCron}" — rapport quotidien désactivé`);
  } else {
    cron.schedule(dailyCron, sendDailyReport, {
      timezone: 'Europe/Paris',
    });
    logger.info(`⏰ Cron rapport quotidien planifié : "${dailyCron}" (Europe/Paris)`);
  }

  // --- Health-check toutes les heures ---
  cron.schedule('0 * * * *', healthCheck);
  logger.info('⏰ Cron health-check planifié : toutes les heures');
}

module.exports = { startCronJobs, sendDailyReport };
