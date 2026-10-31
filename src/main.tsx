import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Footer } from './components/Footer';
import { WalletProviders } from './integration/wallets';
import { followColorScheme } from './theme';
import './vendor/variables.css';
import './styles.css';

followColorScheme(
  document.documentElement,
  window.matchMedia('(prefers-color-scheme: dark)'),
);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <WalletProviders
      rpc={{
        ethereum: import.meta.env.VITE_RPC_ETHEREUM,
        solana: import.meta.env.VITE_RPC_SOLANA,
      }}
    >
      <App />
      <Footer />
    </WalletProviders>
  </StrictMode>,
);
