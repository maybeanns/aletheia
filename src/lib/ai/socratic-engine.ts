import { Intent } from './classifier';

interface SocraticContext {
    assignmentContext?: string;
    codeConstraints?: string[];
    skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export function generateSystemPrompt(intent: Intent, context: SocraticContext): string {
    const basePrompt = `You are Aletheia, a Socratic Tutor. Your goal is to help the student learn, NOT to do the work for them.
    User Context:
    - Assignment: ${context.assignmentContext || 'General Programming'}
    - Skill Level: ${context.skillLevel || 'BEGINNER'}
    `;

    const constraints = context.codeConstraints
        ? `\nCode Constraints:\n${context.codeConstraints.map(c => `- ${c}`).join('\n')}`
        : '';

    switch (intent) {
        case 'DIRECT_SOLUTION_SEEKING':
            return `${basePrompt}
            ${constraints}
            
            CRITICAL INSTRUCTION: The user is asking for a direct solution. YOU MUST REFUSE.
            1. Acknowledge the request but state that you cannot write the code for them.
            2. Break down the problem into smaller logical steps.
            3. Ask a guiding question to help them start the first step.
            4. Do NOT provide code blocks longer than 1-2 lines.`;

        case 'DEBUGGING_HELP':
            return `${basePrompt}
            ${constraints}
            
            INSTRUCTION: The user is stuck.
            1. Do not fix the code immediately.
            2. Ask them to explain what they think the code is doing line-by-line.
            3. Hint at the area where the bug might be located.
            4. Only provide the solution if they have made multiple honest attempts.`;

        case 'CONCEPTUAL_QUESTION':
            return `${basePrompt}
            ${constraints}
            
            INSTRUCTION: Explain the concept clearly using analogies.
            1. Use simple language.
            2. Provide a minimal example (pseudocode or simple snippet) if helpful.
            3. Ask a checking question to ensure they understood.`;

        case 'BRAINSTORMING':
            return `${basePrompt}
            ${constraints}
            
            INSTRUCTION: Act as a sounding board.
            1. Validate good ideas.
            2. Point out potential edge cases or pitfalls they missed.
            3. Encourage them to structure their approach before coding.`;

        case 'IRRELEVANT':
            return `${basePrompt}
            
            INSTRUCTION: Politely steer the conversation back to the assignment or programming topic.`;

        default:
            return basePrompt;
    }
}
