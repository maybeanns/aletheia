/**
 * Model Mesh — LLM Provider Abstraction with Automatic Failover
 *
 * PROBLEM:
 * The original chat route hard-codes Gemini as the sole LLM provider.
 * During peak load:
 *   - Gemini 2.0 Flash has a free-tier quota of ~15 RPM / 1M TPM.
 *   - A class of 200 submitting simultaneously will breach this in seconds.
 *   - The route returns 503 and students lose their Socratic session mid-exam.
 *
 * SOLUTION — "Model Mesh" with a priority fallback chain:
 *
 *   Priority 1 → Gemini 2.0 Flash     (primary: best quality, lowest latency)
 *   Priority 2 → Groq / LLaMA-3 70B   (fallback: ultra-fast, generous limits)
 *   Priority 3 → Groq / LLaMA-3 8B    (degraded: lightweight, high-throughput)
 *   Priority 4 → Local stub            (emergency: never rejects, minimal reply)
 *
 * WHY NOT ANTHROPIC / GPT-4o YET?
 *   They require additional API keys.  The mesh is designed to accept new
 *   providers by implementing the `ModelProvider` interface — drop in Claude
 *   or GPT-4o by adding a new entry to PROVIDER_CHAIN.
 *
 * RETRY LOGIC:
 *   Each provider attempt has a per-provider timeout (PROVIDER_TIMEOUT_MS).
 *   On failure the error is logged with provider name and we immediately try
 *   the next tier — no exponential backoff between providers (we want speed).
 *
 * PRODUCTION UPGRADE PATH:
 *   - Replace the stub with a self-hosted vLLM endpoint on AWS/GCP:
 *       { type: 'openai-compatible', baseUrl: 'https://vllm.internal/v1' }
 *   - Add circuit breakers per provider (track 5xx rate over a sliding window).
 *   - Emit provider selection as a metric to DataDog / Prometheus for alerting.
 */

import Groq from 'groq-sdk';
import { model as geminiModel } from './gemini';

export interface ModelResponse {
    /** The full text content of the reply */
    text: string;
    /** Which provider ultimately answered */
    provider: string;
    /** Whether the response is degraded (emergency stub used) */
    isDegraded: boolean;
}

export interface StreamChunk {
    content: string;
    provider: string;
    isDegraded: boolean;
    done: boolean;
}

/** How long to wait for a single provider before trying the next one (ms) */
const PROVIDER_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function* callGemini(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    userMessage: string,
    signal: AbortSignal
): AsyncGenerator<string> {
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessageStream(userMessage);

    for await (const chunk of result.stream) {
        if (signal.aborted) break;
        const text = chunk.text();
        if (text) yield text;
    }
}

async function* callGroq(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    modelId: 'llama-3.3-70b-versatile' | 'llama3-8b-8192',
    signal: AbortSignal
): AsyncGenerator<string> {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey: groqKey });

    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content } as Groq.Chat.ChatCompletionMessageParam)),
        { role: 'user', content: userMessage },
    ];

    const stream = await groq.chat.completions.create({
        model: modelId,
        messages: groqMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
    });

    for await (const chunk of stream) {
        if (signal.aborted) break;
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) yield text;
    }
}

async function* callEmergencyStub(
    userMessage: string
): AsyncGenerator<string> {
    // Minimal, always-available fallback — never throws
    const reply =
        "I'm experiencing high load right now and my ability to provide detailed guidance is temporarily limited. " +
        "Please re-read the assignment brief carefully, attempt the problem to the best of your ability, " +
        "and reach out to your instructor if you remain stuck. I'll be back to full capacity shortly! 🙏";
    yield reply;
}

// ---------------------------------------------------------------------------
// Mesh orchestrator
// ---------------------------------------------------------------------------

/**
 * Stream a chat response through the provider chain.
 * Yields `StreamChunk` objects so the caller can pipe them directly to the
 * HTTP response stream.
 *
 * The caller passes flat `messages` in our internal format; this function
 * translates to each provider's format internally.
 */
export async function* meshStream(opts: {
    systemPrompt: string;
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
}): AsyncGenerator<StreamChunk> {
    const { systemPrompt, history, messages, userMessage } = opts;

    const PROVIDER_CHAIN: Array<{
        name: string;
        call: () => AsyncGenerator<string>;
    }> = [
            {
                name: 'gemini-2.0-flash',
                call: () => {
                    const ctrl = new AbortController();
                    setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
                    return callGemini(systemPrompt, history, userMessage, ctrl.signal);
                },
            },
            {
                name: 'groq/llama-3.3-70b',
                call: () => {
                    const ctrl = new AbortController();
                    setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
                    return callGroq(systemPrompt, messages, userMessage, 'llama-3.3-70b-versatile', ctrl.signal);
                },
            },
            {
                name: 'groq/llama-3-8b',
                call: () => {
                    const ctrl = new AbortController();
                    setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
                    return callGroq(systemPrompt, messages, userMessage, 'llama3-8b-8192', ctrl.signal);
                },
            },
            {
                name: 'emergency-stub',
                call: () => callEmergencyStub(userMessage),
            },
        ];

    for (let i = 0; i < PROVIDER_CHAIN.length; i++) {
        const { name, call } = PROVIDER_CHAIN[i];
        const isStub = name === 'emergency-stub';

        try {
            console.log(`[ModelMesh] Trying provider: ${name}`);
            const gen = call();
            let yielded = false;

            for await (const text of gen) {
                yielded = true;
                yield { content: text, provider: name, isDegraded: isStub, done: false };
            }

            if (yielded) {
                // Successful — close out the stream
                yield { content: '', provider: name, isDegraded: isStub, done: true };
                return;
            }

            // Provider returned empty stream — treat as failure
            throw new Error(`Provider ${name} returned empty stream`);

        } catch (err) {
            const isLast = i === PROVIDER_CHAIN.length - 1;
            console.error(`[ModelMesh] Provider "${name}" failed${isLast ? ' (no more fallbacks)' : ', trying next'}:`, err);

            if (isLast) {
                // All providers exhausted — this should never happen because the stub always works
                yield {
                    content: 'All AI providers are currently unavailable. Please try again in a few minutes.',
                    provider: 'none',
                    isDegraded: true,
                    done: true,
                };
            }
            // continue to next provider
        }
    }
}
