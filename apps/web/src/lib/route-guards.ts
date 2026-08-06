import { redirect } from '@tanstack/react-router';
import { getUser } from '@/functions/get-user';

export async function requireSession() {
  const session = await getUser();

  if (!session) {
    throw redirect({ to: '/' });
  }

  return session;
}
