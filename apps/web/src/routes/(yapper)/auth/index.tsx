import { createFileRoute } from '@tanstack/react-router';
import { SignUpForm } from '@/components/sign-up-form';

export const Route = createFileRoute('/(yapper)/auth/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden flex-1 flex-col items-center justify-center gap-4 border-r px-12 md:flex">
        <h1 className="font-heading text-primary text-center text-6xl font-extrabold tracking-tight lg:text-7xl">
          Create account
        </h1>
        <p className="text-muted-foreground text-center text-lg font-medium">
          We're so excited to have you join us!
        </p>
      </div>

      <div className="flex flex-1 items-start justify-center px-6 pt-16 md:pt-40">
        <SignUpForm />
      </div>
    </div>
  );
}
