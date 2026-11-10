import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadTheme, applyTheme } from './theme';
import ThemeSwitcher from './ThemeSwitcher';

const current = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme storage', () => {
  it('defaults to Calm when nothing is saved', () => {
    expect(loadTheme()).toBe('calm');
  });

  it('applies the theme to <html> and remembers it', () => {
    applyTheme('night');
    expect(current()).toBe('night');
    expect(loadTheme()).toBe('night');
  });

  it('falls back to Calm for unknown or old Vacations themes', () => {
    localStorage.setItem('master-theme', 'ocean');
    expect(loadTheme()).toBe('calm');
    expect(applyTheme('dark')).toBe('calm');
    expect(current()).toBe('calm');
  });

  it('clears the old Vacations-only theme setting', () => {
    localStorage.setItem('vacation-planner-theme', 'motherduck');
    applyTheme('calm');
    expect(localStorage.getItem('vacation-planner-theme')).toBeNull();
  });
});

describe('ThemeSwitcher', () => {
  it('switches the whole app by click and by arrow keys', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole('radio', { name: 'Arcade' }));
    expect(current()).toBe('arcade');
    await user.keyboard('{ArrowRight}');
    expect(current()).toBe('night');
    expect(loadTheme()).toBe('night');
  });

  it('in the narrow rail, one button says the theme and steps to the next', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher compact />);
    const button = screen.getByRole('button', { name: 'Theme: Calm. Switch to Arcade' });
    await user.click(button);
    expect(current()).toBe('arcade');
    expect(screen.getByRole('button', { name: 'Theme: Arcade. Switch to Night' })).toBeInTheDocument();
  });
});
