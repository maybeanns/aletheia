import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

async function getUser(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    trustHost: true,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    // ── Dev Bypass ──────────────────────────────────────────
                    // If DB is down or using default seed creds, allow bypass
                    if (email === 'student@university.edu' && password === 'student123') {
                        console.log('[Auth] Dev Bypass: Logged in as Student');
                        return {
                            id: 'user-student-456',
                            name: 'Jane Doe (Dev)',
                            email: 'student@university.edu',
                            role: 'STUDENT'
                        };
                    }
                    if (email === 'prof@university.edu' && password === 'password123') {
                        console.log('[Auth] Dev Bypass: Logged in as Professor');
                        return {
                            id: 'user-prof-123',
                            name: 'Dr. Alan Turing (Dev)',
                            email: 'prof@university.edu',
                            role: 'PROFESSOR'
                        };
                    }

                    try {
                        const user = await getUser(email);
                        if (!user) return null;
                        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

                        if (passwordsMatch) return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        };
                    } catch (err) {
                        console.error('[Auth] Database error during login:', err);
                        // Fallback to null (don't throw so user sees "Invalid credentials" 
                        // instead of "Something went wrong")
                        return null;
                    }
                }
                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
