import z from 'zod';

import { Loader } from './loader';
import { Label } from '@yapper/ui/components/label';
import { authClient } from '@/lib/auth-client';
import { useRefreshSession, useSession } from '@/hooks/use-session';
import { AtSignIcon, LockIcon, MailIcon, UserIcon } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@yapper/ui/components/button';
import { Checkbox } from '@yapper/ui/components/checkbox';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@yapper/ui/components/input-group';

const USERNAME_SUFFIX = '.yapper';

const stepFields = {
  1: ['name', 'email', 'password'],
  2: ['username'],
} as const;

const stepTitles = {
  1: 'Your account',
  2: 'Choose your username',
  3: 'Review and confirm',
} as const;

export function SignUpForm() {
  const navigate = useNavigate({
    from: '/',
  });
  const refreshSession = useRefreshSession();

  const { isPending } = useSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      name: '',
      username: '',
      agreeTerms: false,
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
          username: value.username + USERNAME_SUFFIX,
        },
        {
          onSuccess: async () => {
            await refreshSession();
            navigate({
              to: '/',
            });
            toast.success('Sign up successful');
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
  });

  const goNext = async (from: 1 | 2) => {
    await Promise.all(
      stepFields[from].map((field) => form.validateField(field, 'submit')),
    );
    const hasErrors = stepFields[from].some(
      (field) => (form.getFieldMeta(field)?.errors.length ?? 0) > 0,
    );
    if (hasErrors) {
      return;
    }

    if (from === 2) {
      const handle = form.getFieldValue('username') + USERNAME_SUFFIX;
      const { data, error } = await authClient.isUsernameAvailable({
        username: handle,
      });
      if (error) {
        toast.error(error.message || 'Could not check username availability');
        return;
      }
      if (!data?.available) {
        form.setFieldMeta('username', (meta) => ({
          ...meta,
          errorMap: {
            ...meta.errorMap,
            onSubmit: { message: 'Username is already taken' },
          },
        }));
        return;
      }
    }

    setStep(from === 1 ? 2 : 3);
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="w-full max-w-xl">
      <p className="text-muted-foreground text-sm font-medium">
        Step {step} of 3
      </p>
      <h2 className="mt-1 mb-8 text-2xl font-bold">{stepTitles[step]}</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-5"
      >
        {step === 1 && (
          <>
            <form.Field
              name="name"
              validators={{
                onSubmit: z
                  .string()
                  .min(2, 'Name must be at least 2 characters'),
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <InputGroup className="h-11">
                    <InputGroupAddon>
                      <UserIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      placeholder="Your name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </InputGroup>
                  {field.state.meta.errors.map((error) => (
                    <p
                      key={error?.message}
                      className="text-destructive text-sm"
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{
                onSubmit: z.email('Invalid email address'),
              }}
            >
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
                    <p
                      key={error?.message}
                      className="text-destructive text-sm"
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onSubmit: z
                  .string()
                  .min(8, 'Password must be at least 8 characters'),
              }}
            >
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
                      placeholder="Choose your password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </InputGroup>
                  {field.state.meta.errors.map((error) => (
                    <p
                      key={error?.message}
                      className="text-destructive text-sm"
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </>
        )}

        {step === 2 && (
          <form.Field
            name="username"
            validators={{
              onSubmit: z
                .string()
                .min(3, 'Username must be at least 3 characters')
                .max(20, 'Username must be at most 20 characters')
                .regex(
                  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
                  'Lowercase letters, numbers, and hyphens only',
                ),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Username</Label>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <AtSignIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    placeholder="someusername"
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(e.target.value.toLowerCase())
                    }
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{USERNAME_SUFFIX}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                {field.state.value && (
                  <p className="text-muted-foreground text-sm">
                    Your handle will be{' '}
                    <span className="text-foreground font-medium">
                      @{field.state.value}
                      {USERNAME_SUFFIX}
                    </span>
                  </p>
                )}
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-destructive text-sm">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        )}

        {step === 3 && (
          <>
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <dl className="border-border divide-border divide-y rounded-xl border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-muted-foreground text-sm">Name</dt>
                    <dd className="text-sm font-medium">{values.name}</dd>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-muted-foreground text-sm">Email</dt>
                    <dd className="text-sm font-medium">{values.email}</dd>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-muted-foreground text-sm">Username</dt>
                    <dd className="text-sm font-medium">
                      @{values.username}
                      {USERNAME_SUFFIX}
                    </dd>
                  </div>
                </dl>
              )}
            </form.Subscribe>

            <form.Field
              name="agreeTerms"
              validators={{
                onSubmit: z
                  .boolean()
                  .refine(
                    (v) => v,
                    'You must agree to the Terms of Service and Privacy Policy',
                  ),
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    <Label htmlFor={field.name} className="font-normal">
                      I agree to the Terms of Service and Privacy Policy
                    </Label>
                  </div>
                  {field.state.meta.errors.map((error) => (
                    <p
                      key={error?.message}
                      className="text-destructive text-sm"
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </>
        )}

        <div className="flex items-center justify-between border-b pb-8">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="rounded-full"
            onClick={() =>
              step === 1 ? navigate({ to: '/' }) : setStep(step === 3 ? 2 : 1)
            }
          >
            Back
          </Button>

          {step < 3 ? (
            <Button
              key={`next-${step}`}
              type="button"
              size="lg"
              className="rounded-full w-30"
              onClick={() => goNext(step as 1 | 2)}
            >
              Next
            </Button>
          ) : (
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
                  {isSubmitting ? 'Creating account...' : 'Create account'}
                </Button>
              )}
            </form.Subscribe>
          )}
        </div>
      </form>
    </div>
  );
}
