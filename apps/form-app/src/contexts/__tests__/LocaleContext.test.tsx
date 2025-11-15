import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { LocaleProvider, LOCALE_STORAGE_KEY } from '../LocaleContext';
import { useLocale } from '../../hooks/useLocale';
import { defaultLocale } from '../../locales';

const LocaleConsumer = () => {
  const { locale, setLocale } = useLocale();

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale('ta')}>
        switch-to-ta
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        switch-to-en
      </button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <LocaleProvider>
      <LocaleConsumer />
    </LocaleProvider>,
  );
};

describe('LocaleContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to the default locale when storage is empty', () => {
    renderWithProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent(defaultLocale);
  });

  it('initializes locale from storage when available', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ta');
    renderWithProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent('ta');
  });

  it('persists locale changes to storage', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('switch-to-ta'));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ta');
  });

  it('reacts to storage events triggered from other tabs', () => {
    renderWithProvider();

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: LOCALE_STORAGE_KEY,
          newValue: 'ta',
        }),
      );
    });

    expect(screen.getByTestId('locale')).toHaveTextContent('ta');
  });

  it('resets to the default locale when the stored value becomes invalid', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ta');
    renderWithProvider();

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: LOCALE_STORAGE_KEY,
          newValue: 'invalid-locale',
        }),
      );
    });

    expect(screen.getByTestId('locale')).toHaveTextContent(defaultLocale);
  });
});
