import { render, screen, fireEvent } from '@testing-library/react';
import { AskAIPill } from '../AskAIPill';
import mockEnAskAI from '../../../locales/en/askAI.json';

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string) => {
      const messages: Record<string, unknown> = { askAI: mockEnAskAI };
      let node: unknown = messages[namespace];
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      return typeof node === 'string' ? node : key;
    },
  }),
}));

describe('AskAIPill', () => {
  it('renders the pill with the Ask AI label when closed', () => {
    render(<AskAIPill isOpen={false} onClick={jest.fn()} />);
    const pill = screen.getByTestId('ask-ai-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent(mockEnAskAI.pill.label);
    expect(pill).toHaveAttribute('aria-label', mockEnAskAI.pill.ariaLabel);
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<AskAIPill isOpen={false} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('ask-ai-pill'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while the drawer is open', () => {
    const { container } = render(<AskAIPill isOpen={true} onClick={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
