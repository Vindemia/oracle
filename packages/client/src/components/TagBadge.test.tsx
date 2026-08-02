import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/render.js';
import { TagBadge } from './TagBadge.js';
import type { Tag } from '../types/index.js';

const tag: Tag = {
  id: 't1',
  name: 'Urgent',
  icon: '🔥',
  color: '#e35b4a',
  isDefault: false,
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('TagBadge', () => {
  it('affiche l\'icône et le nom du tag', () => {
    // Passe par le helper : le test de fumée valide aussi MemoryRouter + ThemeProvider,
    // dont dépendront TaskCard et FocusView.
    renderWithProviders(<TagBadge tag={tag} />);
    expect(screen.getByText('🔥 Urgent')).toBeInTheDocument();
  });
});
