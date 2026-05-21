import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label } from "@dculus/ui";
import { signIn, emailOtp } from "../lib/auth-client";
import { useTranslation } from "../hooks/useTranslation";
import { FileText, CheckCircle, BarChart3, Users } from "lucide-react";

/* ── Left panel feature list ── */
const FEATURES = [
  { icon: FileText, text: "Build beautiful forms in minutes" },
  { icon: BarChart3, text: "Real-time analytics and insights" },
  { icon: Users, text: "Team collaboration built in" },
  { icon: CheckCircle, text: "Responses collected securely" },
];

export const SignIn = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation("signIn");

  React.useEffect(() => {
    const message = searchParams.get("message");
    if (message === "password-reset-success") {
      setSuccessMessage(t("messages.passwordResetSuccess"));
    } else if (message === "email-verified") {
      setSuccessMessage(t("messages.emailVerified"));
    }
  }, [searchParams, t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = t("form.fields.email.errors.required");
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t("form.fields.email.errors.invalid");
    if (!formData.password) newErrors.password = t("form.fields.password.errors.required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const response = await signIn.email({
        email: formData.email,
        password: formData.password,
        callbackURL: "/",
      });
      if (response.error) {
        const msg = response.error.message?.toLowerCase() || "";
        if (msg.includes("email") && (msg.includes("verified") || msg.includes("verification"))) {
          try { await emailOtp.sendVerificationOtp({ email: formData.email, type: "email-verification" }); } catch { /* OTP send failure is non-fatal here */ }
          navigate("/verify-email", { state: { email: formData.email, fromSignIn: true } });
        } else {
          setErrors({ submit: response.error.message || t("messages.invalidCredentials") });
        }
      } else {
        navigate("/");
      }
    } catch {
      setErrors({ submit: t("messages.unexpectedError") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Left: dark aubergine brand panel ── */}
      <div
        className="hidden lg:flex lg:flex-col lg:w-[480px] xl:w-[560px] shrink-0 p-10 justify-between"
        style={{ backgroundColor: 'var(--tf-darkest)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--tf-dark)' }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">{t("hero.productName")}</span>
        </div>

        {/* Features */}
        <div className="space-y-6">
          <div>
            <h2 className="text-white text-3xl font-light leading-tight mb-3">
              {t("hero.tagline")}
            </h2>
            <p className="text-sm text-[rgba(255,255,255,0.55)]">
              {t("hero.attribution")}
            </p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-white-overlay)' }}>
                  <Icon className="w-4 h-4 text-[rgba(255,255,255,0.70)]" />
                </div>
                <span className="text-sm text-[rgba(255,255,255,0.70)]">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[rgba(255,255,255,0.35)]">
          © {new Date().getFullYear()} Dculus Forms
        </p>
      </div>

      {/* ── Right: clean white sign-in panel ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        {/* Top nav */}
        <div className="flex items-center justify-end px-8 py-5" style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
          <span className="text-sm text-muted-foreground">
            {t("links.signUpPrompt")}{" "}
            <Link to="/signup" className="font-medium hover:underline transition-colors text-primary">
              {t("links.signUp")}
            </Link>
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold mb-1.5 text-primary">
                {t("meta.heading")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("meta.subheading")}
              </p>
            </div>

            {/* Success banner */}
            {successMessage && (
              <div className="mb-5 p-3 rounded-xl text-xs text-center" style={{ backgroundColor: 'var(--tf-icon-teal)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }}>
                {successMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs font-medium block mb-1.5 text-foreground">
                  {t("form.fields.email.label")}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("form.fields.email.placeholder")}
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className={errors.email ? "border-destructive focus-visible:border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs mt-1 text-destructive">{errors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">
                    {t("form.fields.password.label")}
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs transition-colors hover:text-primary text-muted-foreground"
                  >
                    {t("links.forgotPassword")}
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("form.fields.password.placeholder")}
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className={errors.password ? "border-destructive focus-visible:border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-xs mt-1 text-destructive">{errors.password}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}>
                  {errors.submit}
                </p>
              )}

              {/* Submit button — Typeform dark aubergine */}
              <Button type="submit" disabled={isLoading} className="w-full h-10">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t("form.actions.submitting")}
                  </span>
                ) : t("form.actions.submit")}
              </Button>
            </form>

            {/* Sign up link (mobile only) */}
            <p className="lg:hidden text-xs text-center mt-6 text-muted-foreground">
              {t("links.signUpPrompt")}{" "}
              <Link to="/signup" className="font-medium text-primary">
                {t("links.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
