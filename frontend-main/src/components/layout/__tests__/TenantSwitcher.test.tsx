// @vitest-environment jsdom
/**
 * Tests for the TenantSwitcher component.
 *
 * Mocks useTenant() and useTheme() so no real context providers are needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import TenantSwitcher from '../TenantSwitcher';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSetActiveTenantId = vi.fn();
const mockUseTenant = vi.fn();

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────
function superAdminCtx(activeTenantId: number | null = null) {
  return {
    isSuperAdmin: true,
    activeTenantId,
    setActiveTenantId: mockSetActiveTenantId,
  };
}

function countryUserCtx() {
  return {
    isSuperAdmin: false,
    activeTenantId: null,
    setActiveTenantId: mockSetActiveTenantId,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('TenantSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Visibility ─────────────────────────────────────────────────────────────

  it('renders nothing for non-super-admin users', () => {
    mockUseTenant.mockReturnValue(countryUserCtx());
    const { container } = render(<TenantSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger button for super admin', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);
    expect(screen.getByTitle('Switch tenant context')).toBeInTheDocument();
  });

  // ── Default state (no active tenant) ──────────────────────────────────────

  it('shows "All Countries" label when no tenant is selected', () => {
    mockUseTenant.mockReturnValue(superAdminCtx(null));
    render(<TenantSwitcher />);
    expect(screen.getByTitle('Switch tenant context')).toHaveTextContent('All Countries');
  });

  // ── Active tenant state ────────────────────────────────────────────────────

  it('shows the active tenant ISO and name in the trigger when a tenant is selected', () => {
    mockUseTenant.mockReturnValue(superAdminCtx(25)); // Kenya
    render(<TenantSwitcher />);
    const trigger = screen.getByTitle('Switch tenant context');
    expect(trigger).toHaveTextContent('KEN');
    expect(trigger).toHaveTextContent('Kenya');
  });

  // ── Dropdown open/close ────────────────────────────────────────────────────

  it('opens the dropdown when the trigger is clicked', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));

    expect(screen.getByPlaceholderText('Search countries...')).toBeInTheDocument();
    expect(screen.getByText('All Countries (Continental)')).toBeInTheDocument();
  });

  // ── Country selection ──────────────────────────────────────────────────────

  it('calls setActiveTenantId(25) when Kenya is clicked', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.click(screen.getByText('Kenya'));

    expect(mockSetActiveTenantId).toHaveBeenCalledWith(25);
  });

  it('calls setActiveTenantId(36) when Nigeria is clicked', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.click(screen.getByText('Nigeria'));

    expect(mockSetActiveTenantId).toHaveBeenCalledWith(36);
  });

  it('calls setActiveTenantId(null) when "All Countries" is clicked', () => {
    mockUseTenant.mockReturnValue(superAdminCtx(25)); // Kenya currently active
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.click(screen.getByText('All Countries (Continental)'));

    expect(mockSetActiveTenantId).toHaveBeenCalledWith(null);
  });

  // ── Reset button ───────────────────────────────────────────────────────────

  it('shows a Reset button when a tenant is active and calls setActiveTenantId(null)', () => {
    mockUseTenant.mockReturnValue(superAdminCtx(25));
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context')); // open dropdown
    const resetBtn = screen.getByTitle('Reset to all countries');
    fireEvent.click(resetBtn);

    expect(mockSetActiveTenantId).toHaveBeenCalledWith(null);
  });

  it('does NOT show the Reset button when no tenant is active', () => {
    mockUseTenant.mockReturnValue(superAdminCtx(null));
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));

    expect(screen.queryByTitle('Reset to all countries')).not.toBeInTheDocument();
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it('filters the country list by search text', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.change(screen.getByPlaceholderText('Search countries...'), {
      target: { value: 'ken' },
    });

    expect(screen.getByText('Kenya')).toBeInTheDocument();
    expect(screen.queryByText('Nigeria')).not.toBeInTheDocument();
    expect(screen.queryByText('Ghana')).not.toBeInTheDocument();
  });

  it('filters by ISO code', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.change(screen.getByPlaceholderText('Search countries...'), {
      target: { value: 'NGA' },
    });

    expect(screen.getByText('Nigeria')).toBeInTheDocument();
    expect(screen.queryByText('Kenya')).not.toBeInTheDocument();
  });

  it('shows "No matching countries" when search matches nothing', () => {
    mockUseTenant.mockReturnValue(superAdminCtx());
    render(<TenantSwitcher />);

    fireEvent.click(screen.getByTitle('Switch tenant context'));
    fireEvent.change(screen.getByPlaceholderText('Search countries...'), {
      target: { value: 'zzz-no-match' },
    });

    expect(screen.getByText('No matching countries')).toBeInTheDocument();
  });
});
