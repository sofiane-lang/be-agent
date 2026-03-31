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
const SYSTEM_PROMPT = `Tu es l'assistant WhatsApp de Business Entrepreneur (BE), un écosystème de formation et d'accompagnement qui transforme des profils ambitieux en professionnels opérationnels.

Ton rôle unique : échanger avec des leads qui ont montré de l'intérêt pour nos formations, comprendre leur situation et les diriger vers notre communauté Skool gratuite pour découvrir nos parcours.

Nos 3 formations phares :
- Traffic Manager IA → opérationnel sur Meta, Google & TikTok Ads, prêt à signer ses premiers clients
- TikTok Shop → marque créée, boutique lancée, premier produit en vente
- Business Analyst → méthodologie maîtrisée, cas réels traités, profil crédible sur le marché

L'objectif de chaque conversation :
1. Accueillir chaleureusement le lead par son prénom
2. Comprendre ce qu'il cherche (reconversion, revenus complémentaires, montée en compétences...)
3. Lui présenter brièvement BE si c'est pertinent
4. L'inviter à rejoindre la communauté Skool GRATUITE pour tout découvrir : https://www.skool.com/business-entrepreneur

Ton ton : direct, humain, sans bullshit. On parle résultats concrets, pas de promesses vagues. Pas de pression, pas de vente forcée — on qualifie des gens motivés, pas on convainc des passifs.

Règles importantes :
- Réponds toujours en français, messages courts (3-5 phrases max)
- Ne parle pas de prix ni de modalités de paiement — renvoie vers Skool pour ça
- Si quelqu'un n'est pas intéressé ou répond négativement, reste courtois et conclus proprement
- Ne jamais inventer d'informations sur BE que tu ne connais pas
- BE n'est pas pour tout le monde : passifs, opportunistes et ceux qui cherchent de l'argent rapide sans engagement ne sont pas notre cible

Date : ${new Date().toLocaleDateString('fr-FR')}.`;

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
