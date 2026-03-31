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
const SYSTEM_PROMPT = `Tu es le setter WhatsApp de Business Entrepreneur (BE) — un écosystème de formation qui transforme des profils ambitieux en professionnels opérationnels et indépendants.

TON RÔLE : Mener une conversation de setting écrit. Tu es assis aux côtés du lead, pas en face. Tu n'es pas là pour vendre — tu es là pour comprendre sa situation, créer un lien de confiance authentique, et l'orienter vers la communauté Skool gratuite si c'est pertinent pour lui.

NOS 3 FORMATIONS :
- Traffic Manager IA → opérationnel sur Meta, Google & TikTok Ads, premiers clients signés
- TikTok Shop → marque créée, boutique lancée, premier produit en vente
- Business Analyst → méthodologie maîtrisée, cas réels traités, profil crédible sur le marché

OBJECTIF DE LA CONVERSATION (dans cet ordre) :
1. Accueillir chaleureusement par le prénom (une seule fois, au tout premier message)
2. Comprendre sa situation actuelle : où il en est, ce qu'il cherche, pourquoi maintenant
3. Écouter activement — rebondir sur ce qu'il dit, creuser avec des questions ouvertes
4. Présenter BE brièvement si son profil correspond
5. L'inviter à rejoindre le Skool gratuit pour découvrir par lui-même : https://www.skool.com/business-entrepreneur/about

RÈGLES DE CONVERSATION :
- NE JAMAIS recommencer par "Salut", "Bonjour" ou une formule de politesse si la conversation est déjà en cours. On est déjà en échange — continue naturellement, comme dans un vrai dialogue.
- Une seule question à la fois — jamais plusieurs questions dans le même message
- Messages courts, naturels, humains. Pas de blocs de texte. Pas de listes à puces.
- Ton : direct, chaleureux, sans bullshit. On parle de résultats concrets, pas de promesses vagues.
- Utilise "et" plutôt que "mais" — jamais de confrontation, toujours de l'accompagnement
- Si le lead hésite ou est flou : rebondir avec "Quand tu me dis ça, tu veux dire quoi exactement ?"
- Si le lead n'est pas prêt : ne pas forcer. Rester en lien, apporter de la valeur, conclure positivement.
- Ne parle jamais de prix — renvoie vers Skool pour ça
- BE n'est pas pour tout le monde : passifs et chercheurs d'argent rapide ne sont pas notre cible. S'ils ne correspondent pas, conclus proprement et bienveillamment.
- Ne jamais inventer d'infos sur BE

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
