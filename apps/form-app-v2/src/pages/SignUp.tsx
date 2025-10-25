import { useMemo } from 'react';
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
import { useTranslate } from '../i18n';

type SignUpFormData = {
  name: string;
  email: string;
  organizationName: string;
  password: string;
  confirmPassword: string;
};

export const SignUp = () => {
  const t = useTranslate();
  const signupSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(2, t('auth.signUp.validation.nameMin')),
          email: z.string().email(t('auth.signUp.validation.email')),
          organizationName: z
            .string()
            .min(2, t('auth.signUp.validation.organizationMin')),
          password: z
            .string()
            .min(8, t('auth.signUp.validation.passwordMin')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('auth.signUp.validation.passwordMatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );
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
        toast(t('auth.signUp.toast.failure.title'), {
          description:
            signUpResponse.error.message ||
            t('auth.signUp.toast.failure.description'),
        });
        return;
      }

      // Sign in the user
      const signInResponse = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (signInResponse.error) {
        toast(t('auth.signUp.toast.partialFailure.title'), {
          description: t('auth.signUp.toast.partialFailure.description'),
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

      toast(t('auth.signUp.toast.success.title'), {
        description: t('auth.signUp.toast.success.description'),
      });

      navigate('/');
    } catch (error) {
      console.error('Sign up error:', error);
      toast(t('common.errorTitle'), {
        description: t('auth.signUp.toast.error.description'),
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
          {t('common.brandName')}
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;{t('common.brandQuote')}&rdquo;
            </p>
            <footer className="text-sm">
              {t('common.brandQuoteAttribution')}
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right side - Sign up form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('auth.signUp.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('auth.signUp.subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">
                {t('auth.signUp.cardTitle')}
              </CardTitle>
              <CardDescription>
                {t('auth.signUp.cardDescription')}
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
                      <FieldLabel htmlFor="name">
                        {t('common.fullNameLabel')}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="name"
                        type="text"
                        placeholder={t('common.fullNamePlaceholder')}
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
                      <FieldLabel htmlFor="email">
                        {t('common.emailLabel')}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        placeholder={t('common.emailPlaceholder')}
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
                      <FieldLabel htmlFor="organizationName">
                        {t('common.organizationNameLabel')}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="organizationName"
                        type="text"
                        placeholder={t('common.organizationNamePlaceholder')}
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
                      <FieldLabel htmlFor="password">
                        {t('common.passwordLabel')}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="password"
                        type="password"
                        placeholder={t('common.passwordPlaceholder')}
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
                      <FieldLabel htmlFor="confirmPassword">
                        {t('auth.signUp.confirmPasswordLabel')}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="confirmPassword"
                        type="password"
                        placeholder={t('common.passwordPlaceholder')}
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
                      {t('auth.signUp.submitting')}
                    </>
                  ) : (
                    t('auth.signUp.submit')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.signUp.footerPrompt')}{' '}
            <Link
              to="/signin"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('auth.signUp.footerCta')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
