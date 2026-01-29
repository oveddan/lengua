'use client';

import { usePathname } from 'next/navigation';
import { LogoutButton } from './LogoutButton';

export function Header() {
  const pathname = usePathname();

  // Don't show header on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="fixed top-0 right-0 p-4 z-50">
      <LogoutButton />
    </header>
  );
}
