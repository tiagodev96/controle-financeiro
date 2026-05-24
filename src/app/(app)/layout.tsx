import { BottomNav } from '@/components/finance/bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-base">
      <main
        className="mx-auto w-full max-w-md flex-1 px-4 pt-6"
        style={{
          paddingBottom: 'calc(var(--space-16) + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
