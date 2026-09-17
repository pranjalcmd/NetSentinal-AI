import { AppShell } from '@/components/shell/AppShell';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
