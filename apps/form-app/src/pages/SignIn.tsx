import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input, Label } from "@dculus/ui";
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
          navigate("/verify-email", { state: { email: formData.email, password: formData.password, fromSignIn: true } });
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
        style={{ backgroundColor: '#2a222b' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3c323e' }}>
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
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {t("hero.attribution")}
            </p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.70)' }} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          © {new Date().getFullYear()} Dculus Forms
        </p>
      </div>

      {/* ── Right: clean white sign-in panel ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        {/* Top nav */}
        <div className="flex items-center justify-end px-8 py-5" style={{ borderBottom: '1px solid rgba(81,76,84,0.08)' }}>
          <span className="text-sm" style={{ color: '#655d67' }}>
            {t("links.signUpPrompt")}{" "}
            <Link to="/signup" className="font-medium transition-colors" style={{ color: '#3c323e' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = 'underline'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = 'none'}
            >
              {t("links.signUp")}
            </Link>
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold mb-1.5" style={{ color: '#3c323e' }}>
                {t("meta.heading")}
              </h1>
              <p className="text-sm" style={{ color: '#655d67' }}>
                {t("meta.subheading")}
              </p>
            </div>

            {/* Success banner */}
            {successMessage && (
              <div className="mb-5 p-3 rounded-xl text-xs text-center" style={{ backgroundColor: '#f4faf8', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }}>
                {successMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs font-medium block mb-1.5" style={{ color: '#4c414e' }}>
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
                  className={errors.email ? "border-red-400 focus-visible:border-red-400" : ""}
                />
                {errors.email && (
                  <p className="text-xs mt-1" style={{ color: '#ce5d55' }}>{errors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password" className="text-xs font-medium" style={{ color: '#4c414e' }}>
                    {t("form.fields.password.label")}
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs transition-colors"
                    style={{ color: '#655d67' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3c323e'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#655d67'}
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
                  className={errors.password ? "border-red-400 focus-visible:border-red-400" : ""}
                />
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#ce5d55' }}>{errors.password}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'rgba(206,93,85,0.06)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.14)' }}>
                  {errors.submit}
                </p>
              )}

              {/* Submit button — Typeform dark aubergine */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-lg text-sm font-medium text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#3c323e' }}
                onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2e2530'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3c323e'; }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t("form.actions.submitting")}
                  </span>
                ) : t("form.actions.submit")}
              </button>
            </form>

            {/* Sign up link (mobile only) */}
            <p className="lg:hidden text-xs text-center mt-6" style={{ color: '#655d67' }}>
              {t("links.signUpPrompt")}{" "}
              <Link to="/signup" className="font-medium" style={{ color: '#3c323e' }}>
                {t("links.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
