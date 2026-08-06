import { redirect } from '@tanstack/react-router';
import { getUser } from '@/functions/get-user';

export async function requireSession() {
  const session = await getUser();
  await new Promise((r) => setTimeout(r, 40_000));

  if (!session) {
    throw redirect({ to: '/' });
  }

  return session;
}
