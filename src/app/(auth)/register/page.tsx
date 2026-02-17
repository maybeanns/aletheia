import RegisterForm from '@/components/auth/register-form';

export default function RegisterPage() {
    return (
        <main className="flex items-center justify-center md:h-screen">
            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
                <div className="flex w-full items-center justify-center p-6 mb-2">
                    <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl text-primary">
                        Aletheia
                    </h1>
                </div>
                <RegisterForm />
            </div>
        </main>
    );
}
