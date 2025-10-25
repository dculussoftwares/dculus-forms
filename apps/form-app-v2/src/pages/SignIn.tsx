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
import { signIn } from '../lib/auth-client';
import { useTranslate } from '../i18n';

type LoginFormData = {
  email: string;
  password: string;
};

export const SignIn = () => {
  const t = useTranslate();
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.signIn.validation.email')),
        password: z
          .string()
          .min(8, t('auth.signIn.validation.passwordMin')),
      }),
    [t],
  );

  const navigate = useNavigate();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { control, handleSubmit, formState: { isSubmitting } } = form;

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: '/',
      });

      if (response.error) {
        toast(t('auth.signIn.toast.failure.title'), {
          description:
            response.error.message ||
            t('auth.signIn.toast.failure.description'),
        });
      } else {
        toast(t('auth.signIn.toast.success.title'), {
          description: t('auth.signIn.toast.success.description'),
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast(t('common.errorTitle'), {
        description: t('auth.signIn.toast.error.description'),
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

      {/* Right side - Login form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('auth.signIn.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('auth.signIn.subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">
                {t('auth.signIn.cardTitle')}
              </CardTitle>
              <CardDescription>
                {t('auth.signIn.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2" />
                      {t('auth.signIn.submitting')}
                    </>
                  ) : (
                    t('auth.signIn.submit')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.signIn.footerPrompt')}{' '}
            <Link
              to="/signup"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t('auth.signIn.footerCta')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
