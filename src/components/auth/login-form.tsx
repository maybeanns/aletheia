'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { authenticate } from '@/lib/actions/auth';
import { cn } from '@/lib/utils/cn';
import { AtSign, KeyRound, ArrowRight } from 'lucide-react';

export default function LoginForm() {
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);

    return (
        <form action={dispatch} className="flex-1 rounded-lg bg-card px-6 pb-4 pt-8 text-card-foreground border border-border shadow-sm">
            <h1 className="mb-3 text-2xl font-bold">
                Sign in to Aletheia
            </h1>
            <div className="w-full">
                <div>
                    <label
                        className="mb-3 mt-5 block text-xs font-medium text-foreground"
                        htmlFor="email"
                    >
                        Email
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-input py-[9px] pl-10 text-sm outline-2 placeholder:text-muted-foreground bg-background text-foreground"
                            id="email"
                            type="email"
                            name="email"
                            placeholder="Enter your email address"
                            required
                        />
                        <AtSign className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground peer-focus:text-foreground" />
                    </div>
                </div>
                <div className="mt-4">
                    <label
                        className="mb-3 mt-5 block text-xs font-medium text-foreground"
                        htmlFor="password"
                    >
                        Password
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-input py-[9px] pl-10 text-sm outline-2 placeholder:text-muted-foreground bg-background text-foreground"
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Enter password"
                            required
                            minLength={6}
                        />
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground peer-focus:text-foreground" />
                    </div>
                </div>
            </div>
            <LoginButton />
            <div className="flex h-8 items-end space-x-1" aria-live="polite" aria-atomic="true">
                {errorMessage && (
                    <>
                        <p className="text-sm text-destructive">{errorMessage}</p>
                    </>
                )}
            </div>
            <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Don&apos;t have an account? </span>
                <a href="/register" className="font-medium text-primary hover:text-primary/80">
                    Sign up
                </a>
            </div>
        </form>
    );
}

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <button
            className={cn(
                "mt-4 w-full flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-primary/80 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                pending && "opacity-50 cursor-not-allowed"
            )}
            aria-disabled={pending}
        >
            Sign in <ArrowRight className="ml-auto h-5 w-5" />
        </button>
    );
}
