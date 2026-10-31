import { render, screen, within } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('links the Upshift socials, docs and source, and names the year', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    const socials = within(footer)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('link'));
    expect(socials.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Telegram',
      'X (Twitter)',
      'Discord',
      'LinkedIn',
      'YouTube',
    ]);
    for (const link of socials) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
    expect(within(footer).getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://docs.upshift.finance/sdk/three-chain-app',
    );
    expect(
      within(footer).getByRole('link', { name: 'Source' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/upshift-protocol/example-sdk-app',
    );
    expect(footer).toHaveTextContent(
      `Copyright © ${new Date().getFullYear()} Upshift`,
    );
  });
});
