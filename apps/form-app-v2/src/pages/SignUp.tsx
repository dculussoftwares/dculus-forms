import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  FieldLabel,
  FieldError,
  Spinner,
  toast,
} from '@dculus/ui-v2';
import { signUp, signIn, organization as orgClient } from '../lib/auth-client';

// Validation schema
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signupSchema>;

export const SignUp = () => {
  const navigate = useNavigate();

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      organizationName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { control, handleSubmit, formState: { isSubmitting } } = form;

  const onSubmit = async (data: SignUpFormData) => {
    try {
      // Create user account
      const signUpResponse = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      if (signUpResponse.error) {
        toast('Sign up failed', {
          description: signUpResponse.error.message || 'Failed to create account',
        });
        return;
      }

      // Sign in the user
      const signInResponse = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (signInResponse.error) {
        toast('Account created but sign in failed', {
          description: 'Please sign in manually',
        });
        navigate('/signin');
        return;
      }

      // Create organization
      const slug = data.organizationName.toLowerCase().replace(/\s+/g, '-');
      await orgClient.create({
        name: data.organizationName,
        slug: slug,
      });

      toast('Account created successfully', {
        description: 'Welcome to Dculus Forms!',
      });

      navigate('/');
    } catch (error) {
      console.error('Sign up error:', error);
      toast('Error', {
        description: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Left side - Branding */}
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
          Dculus Forms V2
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Build beautiful forms collaboratively with your team. Create, share, and analyze responses all in one place.&rdquo;
            </p>
            <footer className="text-sm">Team Dculus</footer>
          </blockquote>
        </div>
      </div>

      {/* Right side - Sign up form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create an account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your details below to create your account
            </p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Get started</CardTitle>
              <CardDescription>
                Create your account and organization to start building forms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Name Field */}
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="name">Full Name</FieldLabel>
                      <Input
                        {...field}
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        disabled={isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Email Field */}
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        disabled={isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Organization Name Field */}
                <Controller
                  name="organizationName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="organizationName">Organization Name</FieldLabel>
                      <Input
                        {...field}
                        id="organizationName"
                        type="text"
                        placeholder="Acme Inc."
                        disabled={isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Password Field */}
                <Controller
                  name="password"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Input
                        {...field}
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Confirm Password Field */}
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                      <Input
                        {...field}
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2" />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
