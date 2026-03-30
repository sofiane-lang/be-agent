/**
 * claude.js
 * Wrapper autour du SDK Anthropic pour générer des réponses contextuelles.
 *
 * Fonctions exportées :
 *  - generateReply(userMessage, history, contactName) → string
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./logger');

// Instanciation unique du client (lit ANTHROPIC_API_KEY depuis l'env)
const anthropic = new Anthropic();

/**
 * Prompt système : personnalise ici le rôle et le ton de l'agent.
 * Ce texte définit la "personnalité" du bot WhatsApp.
 */
const SYSTEM_PROMPT = `Tu es un assistant WhatsApp professionnel et bienveillant.
Tu réponds toujours en français, de façon concise (3-5 phrases maximum).
Tu es serviable, précis et tu ne fais jamais de suppositions non fondées.
Si tu ne connais pas la réponse, tu le dis honnêtement et tu proposes une alternative.
Tu ne partages jamais d'informations confidentielles.
Date d'aujourd'hui : ${new Date().toLocaleDateString('fr-FR')}.`;

/**
 * Génère une réponse Claude en tenant compte de l'historique de la conversation.
 *
 * @param {string} userMessage   - Dernier message de l'utilisateur
 * @param {Array}  history       - Historique [{role, content}, ...] depuis Sheets
 * @param {string} contactName   - Prénom du contact (pour personnaliser)
 * @returns {Promise<string>}    - Texte de la réponse à envoyer
 */
async function generateReply(userMessage, history = [], contactName = '') {
  // Construction des messages : historique + message courant
  const messages = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  // Personnalisation légère du system prompt si on connaît le prénom
  const systemPrompt = contactName
    ? `${SYSTEM_PROMPT}\nTu parles à ${contactName}.`
    : SYSTEM_PROMPT;

  logger.debug(`🤖 Claude : envoi requête (${messages.length} messages, user: "${userMessage.slice(0, 50)}...")`);

  const response = await anthropic.messages.create({
    model:      process.env.CLAUDE_MODEL      || 'claude-opus-4-5',
    max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1024', 10),
    system:     systemPrompt,
    messages,
  });

  // Extrait le texte de la première réponse (type "text")
  const reply = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  logger.debug(`🤖 Claude : réponse reçue (${reply.length} caractères)`);
  return reply;
}

module.exports = { generateReply };
