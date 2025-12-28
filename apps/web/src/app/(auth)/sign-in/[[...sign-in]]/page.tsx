import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-surface border border-border shadow-xl",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted",
          socialButtonsBlockButton: "bg-elevated border-border text-foreground hover:bg-elevated/80",
          formFieldLabel: "text-muted",
          formFieldInput: "bg-elevated border-border text-foreground focus:ring-brand",
          formButtonPrimary: "bg-brand hover:bg-brand-dark",
          footerActionLink: "text-brand hover:text-brand-dark",
          identityPreviewText: "text-foreground",
          identityPreviewEditButton: "text-brand",
        },
        variables: {
          colorPrimary: "#10B981",
          colorBackground: "#1E293B",
          colorInputBackground: "#334155",
          colorInputText: "#FFFFFF",
          colorText: "#FFFFFF",
          colorTextSecondary: "#94A3B8",
          borderRadius: "12px",
        },
      }}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      forceRedirectUrl="/"
      fallbackRedirectUrl="/"
    />
  );
}
