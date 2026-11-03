import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TemplatePreview, SCOPE_CLASS } from '../index';

const schema = {
  isShuffleEnabled: false,
  layout: {
    code: 'L1',
    theme: 'light',
    textColor: '#1f2937',
    spacing: 'normal',
    content: '<h1>Contact us</h1>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
    pageMode: 'single_page',
  },
  pages: [
    {
      id: 'page-1',
      title: 'Details',
      order: 0,
      fields: [
        {
          id: 'f-name',
          type: 'text_input_field',
          label: 'Your name',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          validation: { required: false, type: 'text_input_field' },
        },
      ],
    },
  ],
};

afterEach(cleanup);

describe('TemplatePreview', () => {
  it('renders the intro screen inside the style scope, then the fields', async () => {
    const { container } = render(<TemplatePreview formSchema={schema} />);
    expect(container.firstElementChild?.classList.contains(SCOPE_CLASS)).toBe(true);
    expect(screen.getByText('Contact us')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() => expect(screen.getAllByText('Your name').length).toBeGreaterThan(0));
  });

  it('adds a caller class next to the scope class', () => {
    const { container } = render(<TemplatePreview formSchema={schema} className="rounded-xl" />);
    expect(container.firstElementChild?.className).toBe(`${SCOPE_CLASS} rounded-xl`);
  });

  it('renders nothing for an unreadable schema', () => {
    const { container } = render(<TemplatePreview formSchema={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onSubmitAttempt instead of submitting', async () => {
    const onSubmitAttempt = vi.fn();
    render(<TemplatePreview formSchema={schema} onSubmitAttempt={onSubmitAttempt} />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    await screen.findAllByText('Your name');
    const submit = screen.queryAllByRole('button').find((b) => /submit/i.test(b.textContent ?? ''));
    expect(submit).toBeTruthy();
    fireEvent.click(submit!);
    await waitFor(() => expect(onSubmitAttempt).toHaveBeenCalled());
  });
});
