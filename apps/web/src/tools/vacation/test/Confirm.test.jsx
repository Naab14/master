import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Confirm } from '../../../workforce/ui';

describe('Confirm keeps focus inside the dialog', () => {
  it('wraps Tab and Shift+Tab, and pulls focus back in from outside', () => {
    render(<><button>behind</button><Confirm title="Sure?" body="x" confirmLabel="Replace" onConfirm={vi.fn()} onCancel={vi.fn()} /></>);
    const cancel = screen.getByText('Cancel');
    const ok = screen.getByText('Replace');
    expect(ok).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });            // from the last button: back to the first
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); // from the first: to the last
    expect(ok).toHaveFocus();
    screen.getByText('behind').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });
});
