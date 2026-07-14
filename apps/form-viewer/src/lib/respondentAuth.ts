// Respondent sessions are stored in localStorage, not sessionStorage — unlike
// form-app's builder session, a respondent should stay signed in across days
// and tabs so they don't need to re-authenticate for every gated form they
// happen to fill out.
const TOKEN_KEY = 'dculus_respondent_token';

export function getRespondentToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRespondentToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage may be unavailable (private browsing) — sign-in simply
    // won't persist across reloads in that case.
  }
}

export function clearRespondentToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no-op
  }
}
