import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Sparkles, Eye, Link as LinkIcon } from 'lucide-react';
import { Button } from '@dculus/ui';

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
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: animationPhase === 'entering'
          ? 'rgba(0, 0, 0, 0)'
          : animationPhase === 'showing'
          ? 'rgba(0, 0, 0, 0.4)'
          : 'rgba(0, 0, 0, 0)',
        backdropFilter: animationPhase === 'showing' ? 'blur(8px)' : 'blur(0px)',
      }}
      onClick={handleClose}
    >
      <div
        className={`relative max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 text-center transition-all duration-700 ${
          animationPhase === 'entering'
            ? 'scale-50 opacity-0 rotate-12'
            : animationPhase === 'showing'
            ? 'scale-100 opacity-100 rotate-0'
            : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: animationPhase === 'showing'
            ? 'translateY(0) scale(1) rotate(0deg)'
            : animationPhase === 'entering'
            ? 'translateY(50px) scale(0.5) rotate(12deg)'
            : 'translateY(-20px) scale(0.95)',
        }}
      >
        {/* Animated background glow */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 opacity-50 animate-pulse" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          {/* Success Icon with animation */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-40 animate-ping" />
            <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-full p-6 shadow-lg transform transition-transform hover:scale-110">
              <CheckCircle className="w-16 h-16 text-white" strokeWidth={2.5} />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>

          {/* Success Message */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              🎉 Form Published!
            </h2>
            <p className="text-lg text-slate-600">
              <span className="font-semibold text-emerald-600">{formTitle}</span> is now live and ready to collect responses
            </p>
          </div>

          {/* Form URL Display */}
          <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-semibold">
              Your Form Link
            </p>
            <p className="text-sm text-slate-700 font-mono break-all bg-white px-3 py-2 rounded-lg border border-slate-200">
              {formUrl}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              id="copy-link-btn"
              onClick={handleCopyLink}
              className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <LinkIcon className="mr-2 h-5 w-5" />
              Copy Link
            </Button>
            <Button
              onClick={handleViewForm}
              variant="outline"
              className="flex-1 h-12 border-2 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-xl transition-all transform hover:scale-105"
            >
              <Eye className="mr-2 h-5 w-5" />
              View Form
            </Button>
          </div>

          {/* Close hint */}
          <p className="text-xs text-slate-400 pt-2">
            Click anywhere to close • Auto-closes in 5s
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-4 left-4 w-20 h-20 bg-emerald-200 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-4 right-4 w-24 h-24 bg-green-200 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
};
