const SOCIALS = [
  { label: 'Telegram', href: 'https://t.me/upshiftfi', icon: 'telegram' },
  { label: 'X (Twitter)', href: 'https://www.x.com/upshift_fi', icon: null },
  { label: 'Discord', href: 'https://discord.gg/eMGRewH6vY', icon: 'discord' },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/upshiftfinance',
    icon: 'linkedin',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@upshiftfi',
    icon: 'youtube',
  },
];

function XIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M25.2 1.33h4.91L19.39 13.59 32 30.26h-9.88l-7.73-10.11-8.85 10.11H.63l11.47-13.1L0 1.33h10.12l6.99 9.25 8.09-9.25Zm-1.72 25.99h2.72L8.65 4.12H5.73l17.75 23.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <ul>
        {SOCIALS.map((social) => (
          <li key={social.label}>
            <a
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
            >
              {social.icon ? (
                <img src={`/img/logos/${social.icon}.svg`} alt="" />
              ) : (
                <XIcon />
              )}
            </a>
          </li>
        ))}
      </ul>
      <a href="https://docs.upshift.finance/sdk/three-chain-app">Docs</a>
      <a href="https://github.com/upshift-protocol/example-sdk-app">Source</a>
      <p>Copyright © {new Date().getFullYear()} Upshift</p>
    </footer>
  );
}
