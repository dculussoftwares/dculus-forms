import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import type { QuizSettings } from '@dculus/types';

export interface QuizModeContextType {
  /** True only when `form.settings.quiz.enabled === true`. */
  enabled: boolean;
  settings?: QuizSettings;
}

// Default value (no provider) = quiz mode off. This lets GradingSettings and the
// field-card badges be mounted without a provider — e.g. in existing
// field-settings-v2 tests — and still satisfy the additive guarantee: no provider
// means no quiz UI, never a thrown error.
const DEFAULT_VALUE: QuizModeContextType = { enabled: false, settings: undefined };

const QuizModeContext = createContext<QuizModeContextType>(DEFAULT_VALUE);

interface QuizModeProviderProps {
  children: ReactNode;
  /** `form.settings.quiz` as loaded from GraphQL — absent for a non-quiz form. */
  quiz?: QuizSettings;
}

export const QuizModeProvider: React.FC<QuizModeProviderProps> = ({ children, quiz }) => {
  const value = useMemo<QuizModeContextType>(
    () => ({ enabled: quiz?.enabled === true, settings: quiz }),
    [quiz]
  );

  return <QuizModeContext.Provider value={value}>{children}</QuizModeContext.Provider>;
};

export const useQuizMode = (): QuizModeContextType => useContext(QuizModeContext);
