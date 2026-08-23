import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function Home() {
  const user = await getSessionUser();
  // залогинен → в мир; нет → onboarding (вход в уже живой мир)
  redirect(user ? '/feed' : '/onboarding');
}
