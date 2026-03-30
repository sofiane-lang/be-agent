/**
 * logger.js
 * Configuration de Winston pour les logs structurés.
 * - En développement : sortie colorée dans la console
 * - En production    : fichiers rotatifs (logs/combined.log + logs/error.log)
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, colorize, printf, json, errors } = format;

// Format personnalisé pour la console
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] ${stack || message}`;
  // Affiche les métadonnées supplémentaires si présentes
  if (Object.keys(meta).length) {
    log += ` | ${JSON.stringify(meta)}`;
  }
  return log;
});

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  // Niveau minimum loggé (debug en dev, info en prod)
  level: isProduction ? 'info' : 'debug',

  // Capture les stack traces des erreurs
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),

  transports: [
    // --- Console (toujours active) ---
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
  ],
});

// En production : écriture dans des fichiers
if (isProduction) {
  logger.add(
    new transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: combine(timestamp(), json()),
    })
  );
  logger.add(
    new transports.File({
      filename: path.join('logs', 'combined.log'),
      format: combine(timestamp(), json()),
    })
  );
}

module.exports = logger;
