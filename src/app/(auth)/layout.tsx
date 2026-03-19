export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen pt-[env(safe-area-inset-top)]">
      {children}
    </main>
  );
}
