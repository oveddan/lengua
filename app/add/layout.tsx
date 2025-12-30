// Force dynamic rendering for this route (uses useSearchParams)
export const dynamic = 'force-dynamic';

export default function AddLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
