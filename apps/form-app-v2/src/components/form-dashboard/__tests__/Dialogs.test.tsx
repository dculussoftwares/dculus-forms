import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../i18n', () => ({
  useTranslate: jest.fn(),
}));

import {
  DeleteDialog,
  UnpublishDialog,
  CollectResponsesDialog,
} from '../Dialogs';
import { useTranslate } from '../../../i18n';

const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;

describe('form-dashboard dialogs', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockUseTranslate.mockReturnValue(
      (key: string, replacements?: Record<string, unknown>) =>
        replacements ? `${key}:${JSON.stringify(replacements)}` : key,
    );
  });

  it('renders delete dialog and handles confirm action', async () => {
    const onConfirm = jest.fn();
    render(
      <DeleteDialog
        open
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        formTitle="Demo"
        loading={false}
      />,
    );

    expect(
      screen.getByText(
        'formDashboard.dialogs.delete.description:{"formTitle":"Demo"}',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByText('formDashboard.dialogs.delete.confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables delete confirmation button while loading', () => {
    render(
      <DeleteDialog
        open
        onOpenChange={jest.fn()}
        onConfirm={jest.fn()}
        formTitle="Loading Form"
        loading
      />,
    );

    expect(
      screen.getByText('formDashboard.dialogs.delete.deleting'),
    ).toBeDisabled();
  });

  it('renders unpublish dialog and triggers confirm handler', async () => {
    const onConfirm = jest.fn();
    render(
      <UnpublishDialog
        open
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
        formTitle="Demo"
        loading={false}
      />,
    );

    await user.click(
      screen.getByText('formDashboard.dialogs.unpublish.confirm'),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('collect responses dialog exposes url copy and open actions', async () => {
    const onCopyLink = jest.fn();
    const onOpenForm = jest.fn();

    render(
      <CollectResponsesDialog
        open
        onOpenChange={jest.fn()}
        formUrl="https://example.com/form"
        formTitle="Demo Form"
        onCopyLink={onCopyLink}
        onOpenForm={onOpenForm}
      />,
    );

    expect(screen.getByText('https://example.com/form')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const copyButton = buttons.find(
      (button) => button.textContent?.trim() === '',
    );
    expect(copyButton).toBeDefined();

    await user.click(copyButton!);
    expect(onCopyLink).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByText('formDashboard.dialogs.collectResponses.openForm'),
    );
    expect(onOpenForm).toHaveBeenCalledTimes(1);
  });
});
