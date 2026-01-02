import Image from "next/image";
import { InstallButton } from "@/components/pwa/install-button";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-lg relative">
      {/* Full-screen background image */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/images/golf-hero.jpg"
          alt="Golf Course"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-3xl">
          <h1 className="text-6xl md:text-7xl font-black tracking-tight text-white drop-shadow-2xl">
            <span className="inline-block transform -skew-x-2">P</span>
            <span className="inline-block transform skew-x-1">R</span>
            <span className="inline-block">E</span>
            <span className="inline-block transform skew-x-1">S</span>
            <span className="inline-block transform -skew-x-2">S</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/50"></div>
            <p className="text-white/70 text-sm uppercase tracking-[0.3em] font-medium">Golf Betting Made Simple</p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/50"></div>
          </div>
        </div>

        {children}

        {/* Add to Home Screen */}
        <InstallButton />
      </div>
    </div>
  );
}
