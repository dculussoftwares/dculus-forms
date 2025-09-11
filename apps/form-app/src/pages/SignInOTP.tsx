import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, TypographyH2, TypographyP, TypographySmall } from "@dculus/ui";
import { emailOtp, signIn } from "../lib/auth-client";
import { OTPInput } from "../components/OTPInput";
import { ArrowLeft, Mail, Timer } from "lucide-react";

export const SignInOTP = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Initialize email from URL params
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp');
    }
  }, [searchParams]);

  // Countdown timer for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const validateEmail = (emailValue: string) => {
    if (!emailValue.trim()) {
      return "Email is required";
    }
    if (!/\S+@\S+\.\S+/.test(emailValue)) {
      return "Please enter a valid email";
    }
    return null;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'sign-in',
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || "Failed to send OTP" 
        });
      } else {
        setStep('otp');
        setCountdown(60); // 1 minute countdown
        setOtp(''); // Clear any existing OTP
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      setErrors({ 
        submit: "An unexpected error occurred. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit code" });
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      if (response.error) {
        setErrors({ 
          otp: response.error.message || "Invalid or expired code" 
        });
      } else {
        // Successful signin, redirect to dashboard
        navigate("/");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      setErrors({ 
        otp: "An unexpected error occurred. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      const response = await emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'sign-in',
      });

      if (response.error) {
        setErrors({ 
          submit: response.error.message || "Failed to resend OTP" 
        });
      } else {
        setCountdown(60);
        setOtp('');
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      setErrors({ 
        submit: "Failed to resend OTP. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp('');
    setErrors({});
    setCountdown(0);
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
          Dculus Forms
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;Sign in securely with just your email. No passwords to remember, just a simple verification code.&rdquo;
            </TypographyP>
            <footer className="text-sm">Secure Authentication</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>
              {step === 'email' ? 'Sign in with OTP' : 'Verify your email'}
            </TypographyH2>
            <TypographySmall className="text-muted-foreground">
              {step === 'email' 
                ? 'Enter your email to receive a verification code'
                : `We sent a 6-digit code to ${email}`
              }
            </TypographySmall>
          </div>
          
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {step === 'otp' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToEmail}
                    className="p-1 h-auto"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <Mail className="w-5 h-5" />
                {step === 'email' ? 'Enter Email' : 'Enter Code'}
              </CardTitle>
              <CardDescription>
                {step === 'email' 
                  ? 'We\'ll send you a secure verification code'
                  : 'Enter the 6-digit code we sent to your email'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
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
                    {isLoading ? "Sending..." : "Send Verification Code"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-center block">Verification Code</Label>
                      <OTPInput
                        value={otp}
                        onChange={(value) => {
                          setOtp(value);
                          if (errors.otp) {
                            setErrors(prev => ({ ...prev, otp: "" }));
                          }
                        }}
                        disabled={isLoading}
                        hasError={!!errors.otp}
                      />
                      {errors.otp && (
                        <TypographySmall className="text-red-500 text-center">
                          {errors.otp}
                        </TypographySmall>
                      )}
                    </div>

                    <div className="text-center">
                      {countdown > 0 ? (
                        <TypographySmall className="text-muted-foreground flex items-center justify-center gap-2">
                          <Timer className="w-4 h-4" />
                          Resend code in {countdown}s
                        </TypographySmall>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-sm"
                        >
                          Didn't receive the code? Resend
                        </Button>
                      )}
                    </div>
                  </div>

                  {errors.submit && (
                    <TypographySmall className="text-red-500 text-center">
                      {errors.submit}
                    </TypographySmall>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Sign In"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            Want to use password instead?{" "}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in with password
            </Link>
          </TypographySmall>
          
          <TypographySmall className="text-center">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </Link>
          </TypographySmall>
        </div>
      </div>
    </div>
  );
};