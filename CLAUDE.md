# CLAUDE.md — Agent IA WhatsApp Business Entrepreneur

> **Ce fichier est le point d'entrée pour toute nouvelle session Claude Code.**
> Lis-le entièrement avant de toucher quoi que ce soit.

---

## 1. C'est quoi ce projet ?

Un bot WhatsApp automatisé pour **Business Entrepreneur (BE)**, un écosystème de formations digitales francophone.

Le bot se fait passer pour **Angélique du support BE**. Il reçoit des messages WhatsApp de prospects, les qualifie en 2 questions max, et les envoie systématiquement vers le Skool gratuit BE :
👉 https://www.skool.com/business-entrepreneur/about

---

## 2. Stack technique

| Composant | Technologie |
|---|---|
| Serveur | Node.js + Express |
| IA | Claude (Anthropic SDK) — modèle `claude-opus-4-5` |
| WhatsApp | Meta WhatsApp Business Cloud API |
| Mémoire | Google Sheets (historique conversations) |
| Tâches planifiées | node-cron (rapport quotidien 8h) |
| Hébergement | Railway (déploiement auto depuis GitHub) |
| Repo | https://github.com/sofiane-lang/be-agent |

---

## 3. Architecture — fichiers clés

```
be-agent/
├── server.js              ← point d'entrée, routes Express, bootstrap
├── src/
│   ├── claude.js          ← PROMPT SYSTÈME + appel API Anthropic ⭐
│   ├── messageHandler.js  ← orchestre : lecture → Claude → envoi → Sheets
│   ├── whatsapp.js        ← client Meta API (send, markAsRead, parse)
│   ├── sheets.js          ← Google Sheets (historique + stats)
│   ├── cron.js            ← rapport quotidien WhatsApp admin
│   └── logger.js          ← Winston logger
├── credentials/
│   └── google-service-account.json  ← clé service Google (ne jamais committer)
└── .env                   ← variables d'environnement (ne jamais committer)
```

### Flux d'un message entrant
```
WhatsApp → POST /webhook → parseIncomingMessage()
         → getConversationHistory() [Google Sheets]
         → generateReply() [Claude + SYSTEM_PROMPT]
         → sendTextMessage() [Meta API]
         → appendConversation() [Google Sheets]
```

---

## 4. Variables d'environnement requises

Toutes dans `.env` (local) et dans Railway (prod) :

```
ANTHROPIC_API_KEY=          ← clé API Anthropic
WHATSAPP_TOKEN=             ← token Meta permanent
PHONE_NUMBER_ID=            ← ID numéro WhatsApp Business
VERIFY_TOKEN=               ← token vérification webhook Meta
GOOGLE_SHEET_ID=            ← ID du Google Sheet de suivi
GOOGLE_SHEET_TAB=           ← nom de l'onglet (défaut: "SUIVI DES APPELS")
GOOGLE_SERVICE_ACCOUNT_JSON= ← JSON credentials Google (en prod Railway)
ADMIN_WHATSAPP_NUMBER=      ← numéro qui reçoit le rapport quotidien
CRON_DAILY_REPORT=          ← cron expression (défaut: "0 8 * * *")
CLAUDE_MODEL=               ← modèle Claude (défaut: claude-opus-4-5)
CLAUDE_MAX_TOKENS=          ← tokens max réponse (défaut: 1024)
META_API_VERSION=           ← version API Meta (défaut: v19.0)
```

---

## 5. Prompt système — état actuel (v5.0)

Le prompt est dans `src/claude.js`, constante `SYSTEM_PROMPT`.
Deux constantes en haut du fichier centralisent les liens :
```js
const SKOOL    = 'https://www.skool.com/business-entrepreneur/about';
const CALENDLY = 'https://calendly.com/business-entrepreneur/appel-accompagnement-perso';
```

### Séquence bot (résumé)
```
MSG 1 : Accueil + "le digital t'attire toujours ?"
  ├── OUI / ambigu → MSG 2
  ├── NON explicite → lien Skool + FIN
  └── STOP → SILENCE TOTAL DÉFINITIF

MSG 2 : "E-commerce, marketing digital ou analyse de données — lequel t'attire le plus ?"
  └── Toute réponse → MSG 3

MSG 3 : Transition + lien Skool → FIN
```

### Règles critiques du prompt
- **2 questions max** — jamais de Q3/Q4
- **STOP = silence absolu** — zéro message envoyé, même pas de confirmation
- **Anti-boucle Q1** — tout signal non-négatif = OUI → MSG2 direct
- **Pas de prénom inventé** — si WhatsApp ne fournit pas de nom, aucun prénom écrit
- **Calendly** si demande d'appel/RDV explicite (remplace Skool, pas de cumul)

### Formations connues par le bot
| Formation | Contenu clé | Format | Durée |
|---|---|---|---|
| Traffic Manager IA | Campagnes Meta + IA + trouver 1ers clients freelance | Coaching live + e-learning | 3 mois |
| TikTok Shop (TSB) | Créer boutique + 1ères ventes e-commerce | Coaching live + e-learning | 3 mois |
| Business Analyst | Power BI, lives + exercices, expert dispo communauté | Lives plusieurs fois/semaine + e-learning | 3-6 mois |
| Masterclass | Sessions thématiques communauté | Ponctuel | - |

---

## 6. Déploiement

```bash
# Lancer en local
npm run dev

# Déployer en prod
git add src/claude.js   # (ou autres fichiers modifiés)
git commit -m "description"
git push origin main
# Railway redéploie automatiquement en 1-2 min
```

Vérifier que ça tourne :
```
GET https://[railway-url]/health
```

---

## 7. Historique des modifications majeures (pour ne pas régresser)

| # | Ce qui a été corrigé | Fichier |
|---|---|---|
| v1 | Création initiale du bot | tous |
| v2 | Fix [Prénom] littéral quand nom inconnu | claude.js, messageHandler.js |
| v3 | Fix boucle historique vide → restart séquence | messageHandler.js |
| v4 | NON → lien Skool direct sans question | claude.js |
| v4 | Ajout mots interdits : "c'est noté", "tu préfères", "on en reste là" | claude.js |
| v4 | Ajout Calendly pour demandes d'appel | claude.js |
| v4 | "t'es une IA ?" → réponse neutre + Calendly | claude.js |
| v4 | "je veux plus être contacté" → silence total | claude.js |
| v4 | Skool : suppression "communauté gratuite" | claude.js |
| v5 | **STOP répété 3x dans le prompt** — silence garanti | claude.js |
| v5 | **Anti-boucle Q1** : "Revenu", "0", etc. = réponse acceptée → MSG2 | claude.js |
| v5 | Réécriture complète en 3 messages clairs (MSG1/MSG2/MSG3) | claude.js |
| v5 | Formations Traffic Manager IA, TikTok Shop, Business Analyst intégrées | claude.js |
| v5 | Variables SKOOL et CALENDLY centralisées | claude.js |

---

## 8. Bugs connus / points de vigilance

- **Mémoire Google Sheets** : si le prospect envoie plusieurs messages très rapidement, le Sheet peut ne pas avoir eu le temps d'écrire l'échange précédent → Claude reçoit un historique incomplet. Le prompt v5 couvre ce cas via l'interprétation contextuelle.
- **STOP** : la commande `/stop` dans le prompt est une instruction pour Claude, pas un appel de fonction réel. Si on veut vraiment bloquer un numéro côté code, il faudrait une liste noire en base.
- **Relances 48h** : le cron de relance n'est **pas encore implémenté** dans le code. `cron.js` envoie uniquement le rapport quotidien admin. La relance automatique après 48h de silence est décrite dans le prompt mais pas déclenchée automatiquement.

---

## 9. Prochaines évolutions possibles

- [ ] Implémenter la relance automatique 48h (lecture Sheets → détecter silence → envoyer MSG relance)
- [ ] Blacklist en mémoire pour les STOP (ne plus jamais répondre à ce numéro même si Claude se trompe)
- [ ] File d'attente avec délai 2s minimum entre appels API (éviter le spam si messages rapides)
- [ ] Dashboard simple pour visualiser les stats Sheets
- [ ] Tester avec d'autres points d'entrée (pas seulement "traffic manager" dans MSG1)

---

## 10. Pour reprendre la maintenance

1. Lire ce fichier en entier
2. Lire `src/claude.js` pour voir le prompt actuel
3. Tester un échange complet avant de modifier
4. Modifier uniquement `src/claude.js` pour les changements de prompt
5. Toujours pusher sur `main` — Railway redéploie automatiquement
6. Mettre à jour la section "Historique des modifications" dans ce fichier après chaque changement significatif
