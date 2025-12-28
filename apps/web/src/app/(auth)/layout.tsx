export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-lg bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-3xl">
          <h1 className="text-hero gradient-text">Press</h1>
          <p className="text-muted mt-sm">Golf Betting Made Simple</p>
        </div>

        {children}
      </div>
    </div>
  );
}
