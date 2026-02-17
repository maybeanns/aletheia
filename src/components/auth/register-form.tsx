'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { register } from '@/lib/actions/auth';
import { cn } from '@/lib/utils/cn';
import { AtSign, KeyRound, User, Briefcase, GraduationCap, ArrowRight } from 'lucide-react';

export default function RegisterForm() {
    const [state, dispatch, isPending] = useActionState(register, undefined);


    if (state?.message === 'Success') {
        return (
            <div className="flex-1 rounded-lg bg-accent px-6 py-8 text-accent-foreground border border-border shadow-sm text-center">
                <h1 className="mb-3 text-2xl font-bold">Registration Successful!</h1>
                <p className="mb-4">You can now sign in with your credentials.</p>
                <a href="/login" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    Go to Login
                </a>
            </div>
        );
    }

    return (
        <form action={dispatch} className="flex-1 rounded-lg bg-card px-6 pb-4 pt-8 text-card-foreground border border-border shadow-sm">
            <h1 className="mb-3 text-2xl font-bold">
                Create an Account
            </h1>
            <div className="w-full">
                <div>
                    <label className="mb-3 mt-5 block text-xs font-medium text-foreground" htmlFor="name">
                        Full Name
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-input py-[9px] pl-10 text-sm outline-2 placeholder:text-muted-foreground bg-background text-foreground"
                            id="name"
                            type="text"
                            name="name"
                            placeholder="Enter your full name"
                            required
                        />
                        <User className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground peer-focus:text-foreground" />
                    </div>
                    {state?.errors?.name && (
                        <p className="mt-2 text-sm text-destructive">{state.errors.name[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-foreground" htmlFor="email">
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
                    {state?.errors?.email && (
                        <p className="mt-2 text-sm text-destructive">{state.errors.email[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-foreground" htmlFor="password">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-input py-[9px] pl-10 text-sm outline-2 placeholder:text-muted-foreground bg-background text-foreground"
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Create a password (min 6 chars)"
                            required
                            minLength={6}
                        />
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground peer-focus:text-foreground" />
                    </div>
                    {state?.errors?.password && (
                        <p className="mt-2 text-sm text-destructive">{state.errors.password[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-foreground">
                        Role
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <input className="peer hidden" type="radio" name="role" id="role-student" value="STUDENT" required defaultChecked />
                            <label htmlFor="role-student" className="flex flex-col items-center justify-center p-4 border border-input rounded-lg cursor-pointer hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/10 transition-all">
                                <GraduationCap className="w-6 h-6 mb-2 text-muted-foreground" />
                                <span className="text-sm font-medium">Student</span>
                            </label>
                        </div>
                        <div className="relative">
                            <input className="peer hidden" type="radio" name="role" id="role-professor" value="PROFESSOR" />
                            <label htmlFor="role-professor" className="flex flex-col items-center justify-center p-4 border border-input rounded-lg cursor-pointer hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/10 transition-all">
                                <Briefcase className="w-6 h-6 mb-2 text-muted-foreground" />
                                <span className="text-sm font-medium">Professor</span>
                            </label>
                        </div>
                    </div>
                    {state?.errors?.role && (
                        <p className="mt-2 text-sm text-destructive">{state.errors.role[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-foreground" htmlFor="department">
                        Department (Optional)
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-input py-[9px] pl-10 text-sm outline-2 placeholder:text-muted-foreground bg-background text-foreground"
                            id="department"
                            type="text"
                            name="department"
                            placeholder="e.g. Computer Science"
                        />
                        <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground peer-focus:text-foreground" />
                    </div>
                </div>
            </div>
            <RegisterButton />
            <div className="flex h-8 items-end space-x-1" aria-live="polite" aria-atomic="true">
                {state?.message && state?.message !== 'Success' && (
                    <p className="text-sm text-destructive">{state.message}</p>
                )}
            </div>
            <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <a href="/login" className="font-medium text-primary hover:text-primary/80">
                    Log in
                </a>
            </div>
        </form>
    );
}

function RegisterButton() {
    const { pending } = useFormStatus();

    return (
        <button
            className={cn(
                "mt-4 w-full flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-primary/80 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                pending && "opacity-50 cursor-not-allowed"
            )}
            aria-disabled={pending}
        >
            Create Account <ArrowRight className="ml-auto h-5 w-5" />
        </button>
    );
}
