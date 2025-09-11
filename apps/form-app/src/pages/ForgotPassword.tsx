import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, TypographyH2, TypographyP, TypographySmall } from "@dculus/ui";
import { forgetPassword, authClient } from "../lib/auth-client";
import { CheckCircle, KeyRound } from "lucide-react";

export const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const navigate = useNavigate();

  // Check for reset token in URL
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setStep('reset');
    }
  }, [searchParams]);

  const validateEmail = (emailValue: string) => {
    if (!emailValue.trim()) {
      return "Email is required";
    }
    if (!/\S+@\S+\.\S+/.test(emailValue)) {
      return "Please enter a valid email";
    }
    return null;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      return "Password is required";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    return null;
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await forgetPassword({
        email: email.trim(),
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || "Failed to send reset email" 
        });
      } else {
        // Show success message
        setStep('email');
        setErrors({});
        // You could also show a success state here
        alert('Reset email sent! Please check your email for the reset link.');
      }
    } catch (error) {
      console.error("Send reset email error:", error);
      setErrors({ 
        submit: "An unexpected error occurred. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrors({ password: passwordError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    if (!token) {
      setErrors({ submit: "Invalid reset token" });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || "Failed to reset password" 
        });
      } else {
        // Password reset successful, redirect to sign-in
        navigate('/signin?message=password-reset-success');
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrors({ 
        submit: "An unexpected error occurred. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepInfo = () => {
    if (step === 'reset') {
      return {
        title: 'Set new password',
        subtitle: 'Choose a strong password for your account',
        cardTitle: 'Reset Password',
        cardDescription: 'Enter your new password below',
        icon: <CheckCircle className="w-5 h-5" />
      };
    }
    
    return {
      title: 'Reset your password',
      subtitle: 'Enter your email to receive a reset link',
      cardTitle: 'Forgot Password',
      cardDescription: 'We\'ll send you a secure reset link',
      icon: <KeyRound className="w-5 h-5" />
    };
  };

  const stepInfo = getStepInfo();

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
          Dculus Forms
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;Secure password reset with email verification. We'll help you regain access to your account safely.&rdquo;
            </TypographyP>
            <footer className="text-sm">Account Security</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>{stepInfo.title}</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {stepInfo.subtitle}
            </TypographySmall>
          </div>
          
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {stepInfo.icon}
                {stepInfo.cardTitle}
              </CardTitle>
              <CardDescription>
                {stepInfo.cardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' && (
                <form onSubmit={handleSendResetEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors(prev => ({ ...prev, email: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <TypographySmall className="text-red-500">{errors.email}</TypographySmall>
                    )}
                  </div>

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
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              )}

              {step === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errors.password) {
                          setErrors(prev => ({ ...prev, password: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.password ? "border-red-500" : ""}
                    />
                    {errors.password && (
                      <TypographySmall className="text-red-500">{errors.password}</TypographySmall>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors(prev => ({ ...prev, confirmPassword: "" }));
                        }
                      }}
                      disabled={isLoading}
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && (
                      <TypographySmall className="text-red-500">{errors.confirmPassword}</TypographySmall>
                    )}
                  </div>

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
                    {isLoading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            Remember your password?{" "}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};