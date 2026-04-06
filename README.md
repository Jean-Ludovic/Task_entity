# TaskFlow

A full-stack task management application with AI features, built with Next.js, TypeScript, and FastAPI.

## Live demo

**[task-entity.vercel.app](https://task-entity.vercel.app)**

---

## Features

**Task management**
- Create, edit, delete tasks with title, description, status, priority and due date
- Filter by status (todo / in progress / done), search by keyword, sort by date
- Cursor-based pagination

**AI (powered by OpenAI)**
- **Create with AI** — describe what you need to do in plain text, the AI extracts structured tasks
- **AI Search** — search tasks using natural language ("show me urgent tasks due this week")
- **AI Overview** — dashboard summary with top priorities, urgent tasks and suggested actions

**Contacts**
- Send / accept / reject contact requests between users

**Organizations**
- Create organizations, invite members, assign tasks at org level

**Calendar**
- Weekly calendar view with auto-arrange (AI-powered slot scheduling)

**Notifications**
- Real-time bell icon with unread count, mark as read / mark all read

**Auth**
- Email / password signup and login
- GitHub and Google OAuth (production)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (TypeScript) |
| AI layer | FastAPI (Python), OpenAI API |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Auth.js v5 |
| Deployment | Vercel |

---

## Run locally

> The local branch uses **PostgreSQL local** + **Ollama** (free, no API key needed) instead of Neon + OpenAI.

### Prerequisites

- Node.js 18+
- pnpm
- Python 3.11+
- Docker (for PostgreSQL) or a local PostgreSQL install
- [Ollama](https://ollama.com) for the AI features

### 1 — Clone the local branch

```bash
git clone -b local https://github.com/Jean-Ludovic/Task_entity.git
cd Task_entity
```

### 2 — Install JS dependencies

```bash
pnpm install
```

### 3 — Install Python dependencies

```bash
pip install fastapi openai pydantic pydantic-settings uvicorn
```

### 4 — Start PostgreSQL

```bash
docker run --name task-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=task_entity \
  -p 5432:5432 -d postgres
```

### 5 — Configure environment

Copy and fill in the variables:

```bash
cp .env.local.example .env
```

Minimum required in `.env`:

```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/task_entity
AUTH_SECRET=any_random_32_char_string
NEXTAUTH_URL=http://localhost:3000
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2
```

### 6 — Set up the database

```bash
pnpm db:push
```

### 7 — Start Ollama (for AI features)

```bash
ollama pull llama3.2    # one-time download (~2 GB)
ollama serve            # starts on localhost:11434
```

### 8 — Start the app

In two terminals:

```bash
# Terminal 1 — Next.js
pnpm dev
```

```bash
# Terminal 2 — AI API
uvicorn api.ai:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment variables (production / Vercel)

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js secret (generate with `npx auth secret`) |
| `AUTH_GITHUB_ID` | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app client secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model name (default: `gpt-4o-mini`) |

---

## Project structure

```
├── app/
│   ├── (dashboard)/        # All authenticated pages (tasks, calendar, contacts, orgs)
│   └── api/                # Next.js API routes
├── components/
│   ├── ai/                 # AI components (task assistant modal, AI overview widget)
│   ├── tasks/              # Task table, form, modal
│   └── ui/                 # shadcn/ui base components
├── hooks/                  # use-ai.ts, use-tasks.ts
├── lib/                    # Services, schemas, validation, error handling
├── ai_service/             # Python AI layer (services, provider abstraction, schemas)
└── api/
    └── ai.py               # Vercel Python serverless entry point (FastAPI)
```

---

## Branches

| Branch | Description |
|---|---|
| `main` | Production — deployed on Vercel with OpenAI |
| `local` | Local development — PostgreSQL local + Ollama (no paid API) |
