import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Eye, Link as LinkIcon, X } from 'lucide-react';
import { Button, Card } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface PublishSuccessAnimationProps {
  formTitle: string;
  formUrl: string;
  onClose: () => void;
  onCopyLink: () => void;
  onViewForm: () => void;
}

export const PublishSuccessAnimation: React.FC<PublishSuccessAnimationProps> = ({
  formTitle,
  formUrl,
  onClose,
  onCopyLink,
  onViewForm,
}) => {
  const { t } = useTranslation('formDashboard');
  const [visible, setVisible] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'entering' | 'showing' | 'exiting'>('entering');

  useEffect(() => {
    // Start entrance animation
    setTimeout(() => setVisible(true), 50);
    setTimeout(() => setAnimationPhase('showing'), 100);

    // Confetti celebration
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Initial burst
    confetti({
      ...defaults,
      particleCount: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'],
    });

    // Continuous confetti
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#10b981', '#059669', '#34d399'],
      });

      // Right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#10b981', '#059669', '#34d399'],
      });
    }, 250);

    // Auto-close after 5 seconds
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(autoCloseTimer);
    };
  }, []);

  const handleClose = () => {
    setAnimationPhase('exiting');
    setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 300);
  };

  const handleCopyLink = () => {
    onCopyLink();
    // Show a quick visual feedback
    const button = document.getElementById('copy-link-btn');
    if (button) {
      button.classList.add('scale-95');
      setTimeout(() => button.classList.remove('scale-95'), 150);
    }
  };

  const handleViewForm = () => {
    onViewForm();
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: animationPhase === 'showing' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0)',
      }}
      onClick={handleClose}
    >
      <Card
        className={`relative max-w-md w-full p-6 text-center transition-all duration-300 ${
          animationPhase === 'entering'
            ? 'scale-95 opacity-0'
            : animationPhase === 'showing'
            ? 'scale-100 opacity-100'
            : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="bg-emerald-100 rounded-full p-4">
              <CheckCircle className="w-12 h-12 text-emerald-600" strokeWidth={2} />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {t('publishSuccess.title')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('publishSuccess.description', { values: { formTitle } })}
            </p>
          </div>

          {/* Form URL Display */}
          <div className="bg-muted rounded-lg p-4 border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">
              {t('publishSuccess.linkLabel')}
            </p>
            <p className="text-sm text-foreground font-mono break-all bg-background px-3 py-2 rounded-md border">
              {formUrl}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              id="copy-link-btn"
              onClick={handleCopyLink}
              className="flex-1"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              {t('publishSuccess.actions.copyLink')}
            </Button>
            <Button
              onClick={handleViewForm}
              variant="outline"
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              {t('publishSuccess.actions.viewForm')}
            </Button>
          </div>

          {/* Close hint */}
          <p className="text-xs text-muted-foreground">
            {t('publishSuccess.autoCloseHint')}
          </p>
        </div>
      </Card>
    </div>
  );
};
