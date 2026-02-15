'use server';

import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { RegisterFormSchema } from '@/lib/definitions';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db/prisma';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}

export async function register(
    prevState: { message: string, errors?: { [key: string]: string[] } } | undefined,
    formData: FormData,
) {
    const validatedFields = RegisterFormSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        department: formData.get('department'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Register.',
        };
    }

    const { name, email, password, role, department } = validatedFields.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return {
                message: 'User already exists.',
            };
        }

        await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                role: role as 'STUDENT' | 'PROFESSOR',
                department,
            },
        });
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create User.',
        };
    }

    // Redirect after successful registration happens implicitly or via redirect()
    // But here we return success so the client can redirect
    return { message: 'Success' };
}
