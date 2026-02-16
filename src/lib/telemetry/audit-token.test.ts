import { AuditTokenGenerator, AuditTokenPayload } from './audit-token';

// Use a fixed secret for testing
const TEST_SECRET = 'test-secret-key-123';

describe('AuditTokenGenerator', () => {
    let generator: AuditTokenGenerator;

    beforeEach(() => {
        generator = new AuditTokenGenerator(TEST_SECRET);
    });

    it('should generate a valid token structure', () => {
        const payload: AuditTokenPayload = {
            submissionHash: 'hash-123',
            metrics: {
                typingEfficiency: 0.8,
                pasteCount: 0,
                pasteVolume: 0,
                totalTimeMs: 1000,
                aiInteractionCount: 0,
                editDistance: 10
            },
            timestamp: Date.now(),
            sessionId: 'session-123',
            studentId: 'student-123'
        };

        const token = generator.generateToken(payload);
        const parts = token.split('.');

        expect(parts.length).toBe(2); // Payload + Signature
    });

    it('should verify a valid token', () => {
        const payload: AuditTokenPayload = {
            submissionHash: 'hash-123',
            metrics: {
                typingEfficiency: 0.8,
                pasteCount: 0,
                pasteVolume: 0,
                totalTimeMs: 1000,
                aiInteractionCount: 0,
                editDistance: 10
            },
            timestamp: Date.now(),
            sessionId: 'session-123',
            studentId: 'student-123'
        };

        const token = generator.generateToken(payload);
        const isValid = generator.verifyToken(token);

        expect(isValid).toBe(true);
    });

    it('should reject a tampered token', () => {
        const payload: AuditTokenPayload = {
            submissionHash: 'hash-123',
            metrics: {
                typingEfficiency: 0.8,
                pasteCount: 0,
                pasteVolume: 0,
                totalTimeMs: 1000,
                aiInteractionCount: 0,
                editDistance: 10
            },
            timestamp: Date.now(),
            sessionId: 'session-123',
            studentId: 'student-123'
        };

        const token = generator.generateToken(payload);
        const parts = token.split('.');

        // Tamper with the signature
        const tamperedToken = `${parts[0]}.fake_signature`;

        const isValid = generator.verifyToken(tamperedToken);
        expect(isValid).toBe(false);
    });

    it('should generate consistent hashes for identical content', () => {
        const content = "const a = 1;";
        const hash1 = generator.generateHash(content);
        const hash2 = generator.generateHash(content);

        expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
        const hash1 = generator.generateHash("const a = 1;");
        const hash2 = generator.generateHash("const a = 2;");

        expect(hash1).not.toBe(hash2);
    });
});
