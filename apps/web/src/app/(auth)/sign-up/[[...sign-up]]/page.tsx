import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl",
          headerTitle: "text-white",
          headerSubtitle: "text-white/70",
          socialButtonsBlockButton: "bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20 transition-all",
          socialButtonsBlockButtonText: "text-white font-medium",
          dividerLine: "bg-white/20",
          dividerText: "text-white/60",
          formFieldLabel: "text-white/80",
          formFieldInput: "bg-white/10 backdrop-blur border-white/20 text-white placeholder:text-white/40 focus:ring-brand focus:border-brand",
          formButtonPrimary: "bg-brand hover:bg-brand-dark text-white font-semibold shadow-lg",
          footerActionLink: "text-brand hover:text-brand-dark font-medium",
          footerActionText: "text-white/60",
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-brand",
          formFieldInputShowPasswordButton: "text-white/60 hover:text-white",
          otpCodeFieldInput: "bg-white/10 border-white/20 text-white",
          formResendCodeLink: "text-brand hover:text-brand-dark",
          alert: "bg-white/10 border-white/20 text-white",
          alertText: "text-white",
        },
        variables: {
          colorPrimary: "#22c55e",
          colorBackground: "transparent",
          colorInputBackground: "rgba(255, 255, 255, 0.1)",
          colorInputText: "#FFFFFF",
          colorText: "#FFFFFF",
          colorTextSecondary: "rgba(255, 255, 255, 0.7)",
          colorTextOnPrimaryBackground: "#FFFFFF",
          borderRadius: "12px",
        },
      }}
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      afterSignUpUrl="/onboarding"
    />
  );
}
