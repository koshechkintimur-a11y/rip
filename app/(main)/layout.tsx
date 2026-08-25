import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { WorldProvider } from '@/components/world-provider';
import { BottomNav } from '@/components/bottom-nav';
import { ComposerProvider } from '@/components/composer-provider';
import { DyingUI } from '@/components/dying-ui';
import { DeathScreen } from '@/components/death-screen';
import { LightboxProvider } from '@/components/lightbox';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <WorldProvider>
      <LightboxProvider>
        <ComposerProvider>
          <DyingUI nav={<BottomNav />}>
            <div className="mx-auto max-w-xl min-h-dvh bg-rip-bg relative">
              {children}
            </div>
          </DyingUI>
          <DeathScreen />
        </ComposerProvider>
      </LightboxProvider>
    </WorldProvider>
  );
}
