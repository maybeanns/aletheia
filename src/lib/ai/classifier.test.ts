
const mockCreate = jest.fn();

jest.mock('groq-sdk', () => {
    return {
        __esModule: true,
        default: class MockGroq {
            chat = {
                completions: {
                    create: mockCreate
                }
            };
            constructor(options: any) { }
        }
    };
});

// Import MUST happen after mock
import { classifyIntent } from './classifier';

describe('classifyIntent', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, GROQ_API_KEY: 'test-key' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should classify "Write me code" as DIRECT_SOLUTION_SEEKING', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: { content: 'DIRECT_SOLUTION_SEEKING' }
            }]
        });

        const intent = await classifyIntent("Write me code for a linked list");

        expect(intent).toBe('DIRECT_SOLUTION_SEEKING');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should classify "What is recursion?" as CONCEPTUAL_QUESTION', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: { content: 'CONCEPTUAL_QUESTION' }
            }]
        });

        const intent = await classifyIntent("What is recursion?");

        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });

    it('should default to CONCEPTUAL_QUESTION on API error', async () => {
        mockCreate.mockRejectedValueOnce(new Error('API Failure'));

        const intent = await classifyIntent("Hello world");

        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });

    it('should default to CONCEPTUAL_QUESTION if API key is missing', async () => {
        delete process.env.GROQ_API_KEY;
        // We need to re-import or reset module state if possible, but 
        // since `groq` instance is created at top-level, we might need to rely on the check inside function.
        // The function checks process.env.GROQ_API_KEY at the start.

        const intent = await classifyIntent("test");
        expect(intent).toBe('CONCEPTUAL_QUESTION');
    });
});
