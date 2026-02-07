import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative py-8 px-4 border-t border-white/10">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center gap-4">
          {/* Logo */}
          <Link href="/" className="text-xl font-black text-white">
            PRESS
          </Link>

          {/* Links */}
          <div className="flex gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-white/50 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-white/50 hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-white/30">
            &copy; {currentYear} Press. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
