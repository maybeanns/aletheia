'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { register } from '@/lib/actions/auth';
import { cn } from '@/lib/utils/cn';
import { AtSign, KeyRound, User, Briefcase, GraduationCap, ArrowRight } from 'lucide-react';

export default function RegisterForm() {
    const [state, dispatch] = useFormState(register, undefined);

    if (state?.message === 'Success') {
        return (
            <div className="flex-1 rounded-lg bg-green-50 px-6 py-8 text-green-900 border border-green-200 shadow-sm dark:bg-green-900 dark:text-green-100 dark:border-green-800 text-center">
                <h1 className="mb-3 text-2xl font-bold">Registration Successful!</h1>
                <p className="mb-4">You can now sign in with your credentials.</p>
                <a href="/login" className="inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500">
                    Go to Login
                </a>
            </div>
        );
    }

    return (
        <form action={dispatch} className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8 text-gray-900 border border-gray-200 shadow-sm dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800">
            <h1 className="mb-3 text-2xl font-bold">
                Create an Account
            </h1>
            <div className="w-full">
                <div>
                    <label className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100" htmlFor="name">
                        Full Name
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                            id="name"
                            type="text"
                            name="name"
                            placeholder="Enter your full name"
                            required
                        />
                        <User className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:text-gray-400 dark:peer-focus:text-gray-100" />
                    </div>
                    {state?.errors?.name && (
                        <p className="mt-2 text-sm text-red-500">{state.errors.name[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100" htmlFor="email">
                        Email
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                            id="email"
                            type="email"
                            name="email"
                            placeholder="Enter your email address"
                            required
                        />
                        <AtSign className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:text-gray-400 dark:peer-focus:text-gray-100" />
                    </div>
                    {state?.errors?.email && (
                        <p className="mt-2 text-sm text-red-500">{state.errors.email[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100" htmlFor="password">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Create a password (min 6 chars)"
                            required
                            minLength={6}
                        />
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:text-gray-400 dark:peer-focus:text-gray-100" />
                    </div>
                    {state?.errors?.password && (
                        <p className="mt-2 text-sm text-red-500">{state.errors.password[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100">
                        Role
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <input className="peer hidden" type="radio" name="role" id="role-student" value="STUDENT" required defaultChecked />
                            <label htmlFor="role-student" className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 dark:border-gray-700 dark:peer-checked:border-blue-400 transition-all">
                                <GraduationCap className="w-6 h-6 mb-2 text-gray-500 peer-checked:text-blue-600 dark:text-gray-400" />
                                <span className="text-sm font-medium">Student</span>
                            </label>
                        </div>
                        <div className="relative">
                            <input className="peer hidden" type="radio" name="role" id="role-professor" value="PROFESSOR" />
                            <label htmlFor="role-professor" className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 dark:border-gray-700 dark:peer-checked:border-blue-400 transition-all">
                                <Briefcase className="w-6 h-6 mb-2 text-gray-500 peer-checked:text-blue-600 dark:text-gray-400" />
                                <span className="text-sm font-medium">Professor</span>
                            </label>
                        </div>
                    </div>
                    {state?.errors?.role && (
                        <p className="mt-2 text-sm text-red-500">{state.errors.role[0]}</p>
                    )}
                </div>
                <div className="mt-4">
                    <label className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100" htmlFor="department">
                        Department (Optional)
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                            id="department"
                            type="text"
                            name="department"
                            placeholder="e.g. Computer Science"
                        />
                        <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:text-gray-400 dark:peer-focus:text-gray-100" />
                    </div>
                </div>
            </div>
            <RegisterButton />
            <div className="flex h-8 items-end space-x-1" aria-live="polite" aria-atomic="true">
                {state?.message && state?.message !== 'Success' && (
                    <p className="text-sm text-red-500">{state.message}</p>
                )}
            </div>
            <div className="mt-4 text-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
                <a href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
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
                "mt-4 w-full flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-blue-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                pending && "opacity-50 cursor-not-allowed"
            )}
            aria-disabled={pending}
        >
            Create Account <ArrowRight className="ml-auto h-5 w-5 text-gray-50" />
        </button>
    );
}
