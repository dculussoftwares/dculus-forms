import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TypographyH2,
  TypographyP,
  TypographySmall,
} from '@dculus/ui';
import { slugify } from '@dculus/utils';
import { authClient, signUp } from '../lib/auth-client';

export const SignUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  // const [createOrganization] = useMutation(CREATE_ORGANIZATION);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
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
      // First, create the user account

      const organizationSlug = slugify(formData.organizationName);

      const signUpResponse = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        callbackURL: '/', // Redirect after successful signup
      });

      if (signUpResponse.error) {
        setErrors({
          submit: signUpResponse.error.message || 'Failed to create account',
        });
        return;
      }

      // const organizationSlug = slugify(formData.organizationName);
      await authClient.organization.create({
        name: formData.organizationName,
        slug: organizationSlug,
        keepCurrentActiveOrganization: false,
      });

      await authClient.signOut();
     
      navigate('/');
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({
        submit: 'An unexpected error occurred. Please try again.',
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
          Dculus Forms
        </div>
        <div className="relative z-20 mt-auto">
          <div className="mt-6 border-l-2 pl-6 italic">
            <TypographyP>
              &ldquo;Build beautiful forms collaboratively with your team.
              Create, share, and analyze responses all in one place.&rdquo;
            </TypographyP>
            <footer className="text-sm">Team Dculus</footer>
          </div>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <TypographyH2>Create an account</TypographyH2>
            <TypographySmall className="text-muted-foreground">
              Enter your details below to create your account
            </TypographySmall>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Get started</CardTitle>
              <CardDescription>
                Create your account and organization to start building forms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <TypographySmall className="text-red-500">
                      {errors.name}
                    </TypographySmall>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <TypographySmall className="text-red-500">
                      {errors.email}
                    </TypographySmall>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    placeholder="Acme Inc."
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.organizationName ? 'border-red-500' : ''}
                  />
                  {errors.organizationName && (
                    <TypographySmall className="text-red-500">
                      {errors.organizationName}
                    </TypographySmall>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && (
                    <TypographySmall className="text-red-500">
                      {errors.password}
                    </TypographySmall>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {errors.confirmPassword && (
                    <TypographySmall className="text-red-500">
                      {errors.confirmPassword}
                    </TypographySmall>
                  )}
                </div>

                {errors.submit && (
                  <TypographySmall className="text-red-500 text-center">
                    {errors.submit}
                  </TypographySmall>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <TypographySmall className="text-center">
            Already have an account?{' '}
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
