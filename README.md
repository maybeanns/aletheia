# Aletheia

> **The Socratic Firewall & Process Verification Platform**
> 
> *Transforming AI from a tool for academic dishonesty into infrastructure for genuine cognitive work.*

Aletheia is an enterprise-grade B2B SaaS platform designed for universities. Instead of banning AI, Aletheia integrates it as a Socratic tutor that guides students through problems without giving direct answers. It simultaneously acts as a "flight recorder" for the learning process, verifying that the student did the work themselves through forensic keystroke dynamics and audit trail generation.

![Start Dashboard](https://github.com/user-attachments/assets/placeholder-image-url)

## 🚀 Core Features

### Module A: The Pedagogical Gateway ("Socratic Firewall")
-   **Intent Classification**: Uses LLaMA-3 (via Groq) to instantly classify student prompts (e.g., "Direct Solution Seeking" vs. "Conceptual Question").
-   **Prompt Interception**: Blocks direct code generation requests in exam settings.
-   **Socratic Engine**: Instead of writing the essay/code, the AI asks guiding questions to help the student reach the answer themselves.
-   **Mode Switching**: Configurable modes for "Brainstorming" (lenient) vs. "Exam" (strict).

### Module B: The Flight Recorder (Process Verification)
-   **Forensic Telemetry**: Tracks keystroke dynamics, typing cadence, and paste events in real-time.
-   **Audit Tokens**: Generates cryptographically signed tokens upon submission that prove the "provenance" of the work.
-   **Visual Replay**: Professors can replay the entire creation process to verify authenticity.
-   **Integrity Dashboard**: Flags suspicious behavior (e.g., large rapid pastes, low edit time).

### Module C: Faculty Dashboard
-   **Assignment Management**: Configure AI strictness and code constraints.
-   **Class Analytics**: View aggregated data on AI reliance and paste frequency.
-   **Submission Review**: Deep-dive into individual student submissions with side-by-side code and telemetry analysis.

## 🛠 Tech Stack

-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS + Framer Motion
-   **Database**: PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) (for RAG features)
-   **ORM**: Prisma
-   **AI Orchestration**:
    -   **Reasoning**: OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet
    -   **Fast Classification**: Groq (LLaMA-3-8b)
-   **Editor**: Monaco Editor (VS Code web)
-   **Infrastructure**: Docker, Redis (for caching/queues), GitHub Actions

## ⚡ Getting Started

### Prerequisites
-   Node.js 18+
-   Docker & Docker Compose
-   PostgreSQL (or use the Docker container)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/aletheia.git
cd aletheia
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in the required API keys in `.env`:
-   `DATABASE_URL` (PostgreSQL)
-   `GROQ_API_KEY`
-   `OPENAI_API_KEY`
-   `NEXTAUTH_SECRET`

### 3. Run with Docker (Recommended)
This spins up the Application, PostgreSQL with pgvector, and Redis.
```bash
docker-compose -f docker/docker-compose.yml up --build
```
The app will be available at [http://localhost:3000](http://localhost:3000).

### 4. Run Locally (Development)
If you prefer to run Node locally:

```bash
# Install dependencies
npm install

# Initialize Database
npx prisma db push
npx prisma db seed

# Start server
npm run dev
```

## 🧪 Testing

To run the test suite:
```bash
npm test
```

## 🚢 Deployment

The project is configured for **Docker** deployment. 
-   The `Dockerfile` uses a multi-stage build (standalone output) for optimized image size.
-   A GitHub Actions workflow (`.github/workflows/ci.yml`) automatically lints and builds the project on push.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
