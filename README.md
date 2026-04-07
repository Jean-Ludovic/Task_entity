# TaskFlow

Application de gestion de tâches full-stack avec intégration IA.

**Démo en ligne** → [task-entity.vercel.app](https://task-entity.vercel.app)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend API | Next.js API Routes |
| Base de données | PostgreSQL (Neon) + Drizzle ORM |
| Authentification | Auth.js v5 (email/password + OAuth GitHub) |
| IA | FastAPI (Python 3.12) + Ollama (local) ou OpenAI |
| Déploiement | Vercel |

---

## Prérequis

### Node.js
- **Node.js** >= 20
- **pnpm** >= 9 — `npm install -g pnpm`

### Python
- **Python** >= 3.12
- **pip** ou **venv**

### LLM local (optionnel — pour les fonctionnalités IA en local)
- **Ollama** — [ollama.com](https://ollama.com)
- Modèle recommandé : `llama3.2`

---

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd Task_entity-local
```

### 2. Dépendances Node.js

```bash
pnpm install
```

### 3. Dépendances Python

```bash
# Créer un environnement virtuel (recommandé)
python -m venv .venv

# Activer l'environnement
# Windows :
.venv\Scripts\activate
# macOS / Linux :
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 4. Variables d'environnement

Copier le fichier exemple et remplir les valeurs :

```bash
cp .env.example .env
```

Valeurs à renseigner dans `.env` :

```env
# Base de données PostgreSQL (Neon ou locale)
POSTGRES_URL=postgresql://user:password@host/dbname?sslmode=require

# Auth.js — générer avec : openssl rand -hex 32
AUTH_SECRET=votre-secret-ici

# URL de l'app (dev)
NEXTAUTH_URL=http://localhost:3000

# OAuth GitHub (optionnel)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# LLM — Ollama local (par défaut)
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2

# LLM — OpenAI (production)
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# URL du service FastAPI
# Dev : http://localhost:8000
# Vercel : https://votre-app.vercel.app
AI_SERVICE_URL=http://localhost:8000

# Clé secrète partagée entre Next.js et FastAPI (laisser vide pour désactiver)
# AI_SECRET_KEY=votre-cle-secrete
```

### 5. Base de données

```bash
# Appliquer le schéma
pnpm db:push

# (Optionnel) Injecter des données de test
pnpm db:seed
```

### 6. LLM local (pour les fonctionnalités IA)

```bash
# Installer et démarrer Ollama
# Télécharger depuis https://ollama.com puis :
ollama pull llama3.2
ollama serve
```

---

## Lancer l'application

Trois terminaux en parallèle :

**Terminal 1 — Next.js**
```bash
pnpm dev
```
→ [http://localhost:3000](http://localhost:3000)

**Terminal 2 — FastAPI (service IA)**
```bash
# S'assurer que le venv est activé
uvicorn api.ai:app --port 8000 --reload
```
→ [http://localhost:8000/api/ai/docs](http://localhost:8000/api/ai/docs)

**Terminal 3 — Ollama (LLM local)**
```bash
ollama serve
```

---

## Fonctionnalités

### Gestion de tâches
- Création, modification, suppression de tâches
- Statuts : `Todo`, `In Progress`, `Done`
- Priorités : `Low`, `Medium`, `High`
- Dates de début, fin et d'échéance
- Filtrage par statut, tri par date
- Pagination par curseur

### Contacts & Organisations
- Invitations de contacts
- Création d'organisations
- Assignation de tâches à des membres
- Notifications en temps réel

### Intégration IA
Trois fonctionnalités propulsées par LLM :

| Fonctionnalité | Description |
|---|---|
| **Task Assistant** | Bouton "Create with AI" → décrire des tâches en texte libre → extraction automatique → création en un clic |
| **Smart Search** | Icône ✨ dans la barre de recherche → requête naturelle ("tâches urgentes de cette semaine") → filtres appliqués automatiquement |
| **AI Overview** | Carte en haut du dashboard → résumé de la charge de travail, priorités, actions suggérées, tâches en retard |

---

## Structure du projet

```
├── app/                    # Next.js App Router (pages + API routes)
│   ├── (dashboard)/        # Pages protégées (tasks, contacts, orgs, calendar)
│   └── api/                # API routes (tasks, auth, AI proxy…)
├── components/             # Composants React
│   ├── ai/                 # Composants IA (drawer, summary card)
│   ├── tasks/              # Composants tâches
│   └── ui/                 # shadcn/ui (boutons, modals, etc.)
├── hooks/                  # Custom hooks React (use-tasks, use-ai)
├── lib/                    # Services backend (tasks, auth, contacts…)
├── ai_service/             # Module Python FastAPI
│   ├── core/               # Config (provider LLM, settings)
│   ├── models/             # Schémas Pydantic
│   ├── providers/          # Abstraction LLM (Ollama / OpenAI)
│   └── services/           # Logique métier IA
└── api/ai.py               # Point d'entrée FastAPI (Vercel serverless)
```

---

## Scripts disponibles

```bash
pnpm dev              # Serveur de développement Next.js (Turbopack)
pnpm build            # Build de production
pnpm start            # Serveur de production

pnpm db:generate      # Générer les migrations Drizzle
pnpm db:push          # Appliquer le schéma en base
pnpm db:seed          # Injecter des données de test

pnpm test             # Tests TypeScript uniquement (Vitest)
pnpm test:watch       # Tests TypeScript en mode watch
pnpm test:python      # Tests Python uniquement (pytest)
pnpm test:all         # Tous les tests (TypeScript + Python)
```

> Pour lancer tous les tests d'un coup : `pnpm test:all`

---

## Déploiement Vercel

1. Importer le repo sur [vercel.com](https://vercel.com)
2. Renseigner les variables d'environnement dans les settings du projet
3. Pour l'IA en production, utiliser `LLM_PROVIDER=openai` avec une `OPENAI_API_KEY`
4. Le fichier `vercel.json` configure automatiquement le runtime Python pour `api/ai.py`
