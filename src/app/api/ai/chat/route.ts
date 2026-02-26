import { NextRequest } from 'next/server';
import { classifyIntent } from '@/lib/ai/classifier';
import { generateSystemPrompt, SocraticContext } from '@/lib/ai/socratic-engine';
import { meshStream } from '@/lib/ai/model-mesh';
import { checkRateLimit, chatRateLimiter } from '@/lib/rate-limit';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Convert our frontend message format to Gemini's expected history format.
 * Gemini requires alternating user/model turns.
 */
function buildGeminiHistory(messages: ChatMessage[]) {
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        const lastEntry = history[history.length - 1];

        // Merge consecutive same-role messages (Gemini requires strict alternation)
        if (lastEntry && lastEntry.role === geminiRole) {
            lastEntry.parts[0].text += '\n\n' + msg.content;
        } else {
            history.push({ role: geminiRole, parts: [{ text: msg.content }] });
        }
    }

    // History must start with 'user'
    if (history.length > 0 && history[0].role === 'model') {
        history.unshift({ role: 'user', parts: [{ text: '[Conversation started]' }] });
    }
    // Remove trailing user (will be sent via sendMessageStream)
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
    }

    return history;
}

/**
 * POST /api/ai/chat
 *
 * Socratic chat endpoint with:
 * - Per-user rate limiting (Upstash Redis sliding window)
 * - Model Mesh failover: Gemini → Groq 70B → Groq 8B → stub
 * - Intent classification (Groq LLaMA-3, keyword fallback)
 * - Streaming NDJSON response
 * - AI Mode awareness (Brainstorming vs Exam)
 */
export async function POST(req: NextRequest) {
    // ── Rate limiting ──────────────────────────────────────────────────────
    // Use the authenticated user ID if present; fall back to IP for guests
    const userId = req.headers.get('x-user-id') ??
        req.ip ??
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'anonymous';

    const rateLimit = await checkRateLimit(chatRateLimiter, userId, 'chat');

    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
        return Response.json(
            {
                error: 'Too many requests. Please slow down — the AI is thinking!',
                retryAfter: retryAfterSec,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfterSec),
                    'X-RateLimit-Remaining': String(rateLimit.remaining),
                    'X-RateLimit-Reset': String(rateLimit.resetAt),
                },
            }
        );
    }

    try {
        const body = await req.json();
        const {
            messages,
            assignmentContext,
            codeConstraints,
            aiMode = 'BRAINSTORMING',
            currentCode,
        } = body;

        // Validate input
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ error: 'Messages array is required.' }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.content?.trim()) {
            return Response.json(
                { error: 'Last message must be a non-empty user message.' },
                { status: 400 }
            );
        }

        const userPrompt = lastMessage.content.trim();

        // ── Step 1: Classify Intent (Groq LLaMA-3, keyword fallback) ──────
        const intent = await classifyIntent(userPrompt);
        console.log(`[Socratic Gateway] Intent: ${intent} | Mode: ${aiMode} | Provider: mesh`);

        // ── Step 2: Generate context-aware Socratic system prompt ──────────
        const context: SocraticContext = {
            assignmentContext,
            codeConstraints,
            aiMode,
            currentCode,
            conversationLength: messages.length,
        };
        const systemPrompt = generateSystemPrompt(intent, context);

        // ── Step 3: Build provider-agnostic history ────────────────────────
        const previousMessages = messages.slice(0, -1) as ChatMessage[];
        const geminiHistory = buildGeminiHistory(previousMessages);

        // Prepend system prompt as the opening exchange for Gemini
        const fullGeminiHistory = [
            { role: 'user' as const, parts: [{ text: systemPrompt }] },
            {
                role: 'model' as const,
                parts: [{ text: 'Understood. I am Aletheia, operating as a Socratic Tutor. I will follow the response strategy provided.' }],
            },
            ...geminiHistory,
        ];

        // ── Step 4: Stream through the Model Mesh ─────────────────────────
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of meshStream({
                        systemPrompt,
                        history: fullGeminiHistory,
                        messages: previousMessages,
                        userMessage: userPrompt,
                    })) {
                        const payload = JSON.stringify({
                            content: chunk.content,
                            intent,
                            provider: chunk.provider,
                            isDegraded: chunk.isDegraded,
                            done: chunk.done,
                        }) + '\n';

                        controller.enqueue(encoder.encode(payload));

                        if (chunk.done) {
                            controller.close();
                            return;
                        }
                    }
                } catch (streamErr) {
                    console.error('[Socratic Gateway] Stream error:', streamErr);
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({ error: 'Stream interrupted. Please try again.', intent }) + '\n'
                        )
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Intent': intent,
                'X-RateLimit-Remaining': String(rateLimit.remaining),
            },
        });

    } catch (error) {
        console.error('[Socratic Gateway] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';

        if (msg.includes('API key') || msg.includes('API_KEY')) {
            return Response.json(
                { error: 'AI service authentication failed. Check your API key configuration.' },
                { status: 503 }
            );
        }

        return Response.json(
            { error: 'The Socratic Engine encountered an issue. Please try again.' },
            { status: 500 }
        );
    }
}
