import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, TypographyH2, TypographyP, TypographySmall } from "@dculus/ui";
import { signIn } from "../lib/auth-client";
import { useTranslation } from "../hooks/useTranslation";

export const SignIn = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation('signIn');

  // Check for success messages from URL params
  React.useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'password-reset-success') {
      setSuccessMessage(t('messages.passwordResetSuccess'));
    }
  }, [searchParams, t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = t('form.fields.email.errors.required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('form.fields.email.errors.invalid');
    }

    if (!formData.password) {
      newErrors.password = t('form.fields.password.errors.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await signIn.email({
        email: formData.email,
        password: formData.password,
        callbackURL: "/", // Redirect after successful signin
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || t('messages.invalidCredentials') 
        });
      } else {
        // Successful signin, redirect to dashboard
        navigate("/");
      }
    } catch (error) {
      console.error("Signin error:", error);
      setErrors({ 
        submit: t('messages.unexpectedError') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600 to-blue-600" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="m8 3 4 8 5-5v11H6V6l2-3z" />
            <path d="M2 3h6" />
            <path d="M6 3v5" />
          </svg>
          {t('hero.productName')}
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;{t('hero.tagline')}&rdquo;
            </TypographyP>
            <footer className="text-sm">{t('hero.attribution')}</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>{t('meta.heading')}</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {t('meta.subheading')}
            </TypographySmall>
          </div>
          
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">{t('form.title')}</CardTitle>
              <CardDescription>
                {t('form.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('form.fields.email.label')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('form.fields.email.placeholder')}
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <TypographySmall className="text-red-500">{errors.email}</TypographySmall>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('form.fields.password.label')}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t('form.fields.password.placeholder')}
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.password ? "border-red-500" : ""}
                  />
                  {errors.password && (
                    <TypographySmall className="text-red-500">{errors.password}</TypographySmall>
                  )}
                </div>

                {successMessage && (
                  <TypographySmall className="text-green-600 text-center bg-green-50 p-3 rounded-md border border-green-200">
                    {successMessage}
                  </TypographySmall>
                )}

                {errors.submit && (
                  <TypographySmall className="text-red-500 text-center">
                    {errors.submit}
                  </TypographySmall>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? t('form.actions.submitting') : t('form.actions.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            <Link
              to="/forgot-password"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('links.forgotPassword')}
            </Link>
          </TypographySmall>

          <TypographySmall className="text-center">
            {t('links.signUpPrompt')}{" "}
            <Link
              to="/signup"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('links.signUp')}
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};
