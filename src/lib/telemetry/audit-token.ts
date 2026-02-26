import SHA256 from 'crypto-js/sha256';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import Base64 from 'crypto-js/enc-base64';
import Utf8 from 'crypto-js/enc-utf8';
import type { DriftReport, IKIProfile } from './iki-analyzer';

export interface AuditMetrics {
    typingEfficiency: number; // chars typed / total chars
    pasteCount: number;
    pasteVolume: number;       // total chars pasted
    totalTimeMs: number;
    aiInteractionCount: number;
    editDistance: number;      // Levenshtein distance (rough)
    /** IKI-based typing-signature drift report for this submission */
    ikiDriftReport: DriftReport | null;
    /** Snapshot of the student's rolling IKI profile at submission time */
    ikiProfile: IKIProfile | null;
}

export interface AuditTokenPayload {
    submissionHash: string;
    metrics: AuditMetrics;
    timestamp: number;
    sessionId: string;
    studentId: string;
}

export class AuditTokenGenerator {
    private secretKey: string;

    constructor(secretKey: string) {
        if (!secretKey) {
            throw new Error('AuditTokenGenerator requires a secret key');
        }
        this.secretKey = secretKey;
    }

    generateHash(content: string): string {
        return SHA256(content).toString();
    }

    generateToken(payload: AuditTokenPayload): string {
        const payloadString = JSON.stringify(payload);
        const payloadWords = Utf8.parse(payloadString);
        const signature = Base64.stringify(HmacSHA256(payloadWords, this.secretKey));
        return `${Base64.stringify(payloadWords)}.${signature}`;
    }

    verifyToken(token: string): boolean {
        try {
            const parts = token.split('.');
            if (parts.length !== 2) return false;
            const [payloadB64, signature] = parts;

            const payloadWords = Base64.parse(payloadB64);
            const expectedSignature = Base64.stringify(HmacSHA256(payloadWords, this.secretKey));

            return signature === expectedSignature;
        } catch {
            return false;
        }
    }

    decodeToken(token: string): AuditTokenPayload | null {
        if (!this.verifyToken(token)) return null;
        try {
            const [payloadB64] = token.split('.');
            const payloadWords = Base64.parse(payloadB64);
            const payloadString = Utf8.stringify(payloadWords);
            return JSON.parse(payloadString);
        } catch {
            return null;
        }
    }
}
