import { createFileRoute } from '@tanstack/react-router';
import { SignUpForm } from '@/components/sign-up-form';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(global)/auth/')({
  head: () => ({ meta: seo({ title: 'Create account' }) }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <section className="w-full min-h-svh flex items-center">
      <div className="w-full sm:w-[40%] self-stretch flex-col flex items-end justify-center gap-4 border-r border px-15">
        <h1 className="font-heading text-primary text-center text-6xl font-extrabold tracking-tight lg:text-6xl">
          Create account
        </h1>
        <p className="text-muted-foreground text-center text-lg font-medium">
          We're so excited to have you join us!
        </p>
      </div>
      <div className="w-full sm:w-[60%] flex items-start justify-start px-15">
        <SignUpForm />
      </div>
    </section>
  );
}
