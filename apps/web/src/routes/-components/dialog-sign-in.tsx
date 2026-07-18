import z from 'zod';

import { useForm } from '@tanstack/react-form';
import { authClient } from '@/lib/auth-client';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Label } from '@yapper/ui/components/label';
import { LockIcon, MailIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@yapper/ui/components/input-group';

export default function DialogSignIn({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate({
    from: '/',
  });

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            setOpen(false);
            navigate({
              to: '/',
            });
            toast.success('Sign in successful');
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email('Invalid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="secondary" className="rounded-full px-5" />}
      >
        Sign in
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Sign in</DialogTitle>
          <DialogDescription>
            Enter your email and password to continue.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-5"
        >
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <MailIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </InputGroup>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-destructive text-sm">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Password</Label>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <LockIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type="password"
                    placeholder="Your password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </InputGroup>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-destructive text-sm">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="rounded-full"
              onClick={() => navigate({ to: '/auth' })}
            >
              Create account
            </Button>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-full"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
