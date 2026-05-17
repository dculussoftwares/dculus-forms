import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { AlertTriangle } from 'lucide-react';
import { Input, Label } from '@dculus/ui';
import { Eye, EyeOff, Shield } from 'lucide-react';

export default function LoginPage() {
  const { signIn, isAuthenticated, user } = useAuth();
  const { t } = useTranslation('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await signIn(email, password);
    if (!result.success) setError(result.error || t('error.loginFailed'));
    setIsLoading(false);
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left dark panel */}
      <div className="hidden lg:flex lg:flex-col lg:w-[400px] shrink-0 p-10 justify-between" style={{ backgroundColor: '#2a222b' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3c323e' }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Admin</span>
        </div>
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Shield className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.70)' }} />
          </div>
          <h2 className="text-white text-2xl font-light leading-snug">Dculus Forms<br />Administration</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Restricted access — authorized personnel only</p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} Dculus Forms</p>
      </div>

      {/* Right white panel */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-1.5" style={{ color: '#3c323e' }}>{t('subtitle')}</h1>
            <p className="text-sm" style={{ color: '#655d67' }}>Admin access only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isAuthenticated && user && (
              <div className="py-2 px-3 rounded-lg text-xs flex gap-2 items-start" style={{ backgroundColor: 'rgba(234,179,8,0.06)', color: '#92400e', border: '1px solid rgba(234,179,8,0.20)' }}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Signed in as <strong>{user.email}</strong> which lacks admin access. Sign in with an admin account below.</span>
              </div>
            )}
            {error && (
              <p className="py-2 px-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(206,93,85,0.06)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.14)' }}>
                {error}
              </p>
            )}
            <div>
              <Label htmlFor="email" className="text-xs font-medium block mb-1.5" style={{ color: '#4c414e' }}>{t('email')}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-medium block mb-1.5" style={{ color: '#4c414e' }}>{t('password')}</Label>
              <div className="relative">
                <Input
                  id="password" name="password" type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} className="pr-9"
                />
                <button type="button" className="absolute inset-y-0 right-3 flex items-center" style={{ color: '#655d67' }}
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3c323e'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#655d67'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full h-10 rounded-lg text-sm font-medium text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#3c323e' }}
              onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2e2530'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3c323e'; }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {t('signingIn')}
                </span>
              ) : t('signIn')}
            </button>
          </form>
          <p className="text-xs text-center mt-6" style={{ color: '#655d67' }}>Contact your system administrator for access.</p>
        </div>
      </div>
    </div>
  );
}
