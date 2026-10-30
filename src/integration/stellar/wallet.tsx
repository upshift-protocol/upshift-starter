import {
  getAddress,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction as freighterSign,
} from '@stellar/freighter-api';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

export const STELLAR_MAINNET_PASSPHRASE =
  'Public Global Stellar Network ; September 2015';
export const STELLAR_STORAGE_KEY = 'upshift-starter-stellar-address';

interface StellarWallet {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const StellarWalletContext = createContext<StellarWallet>({
  address: null,
  connected: false,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => {
    throw new Error('No Stellar wallet connected.');
  },
});

async function restoreFreighterAddress(): Promise<string | null> {
  const stored = localStorage.getItem(STELLAR_STORAGE_KEY);
  if (!stored) return null;
  const conn = await isConnected();
  if (!conn.isConnected) return null;
  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    localStorage.removeItem(STELLAR_STORAGE_KEY);
    return null;
  }
  const { address } = await getAddress();
  return address || stored;
}

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    restoreFreighterAddress()
      .then((restored) => cancelled || setAddress(restored))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    const result = await requestAccess();
    if (result.error || !result.address) {
      throw new Error(
        result.error?.message ?? 'Freighter did not return an address.',
      );
    }
    localStorage.setItem(STELLAR_STORAGE_KEY, result.address);
    setAddress(result.address);
  };

  const disconnect = () => {
    localStorage.removeItem(STELLAR_STORAGE_KEY);
    setAddress(null);
  };

  const signTransaction = async (xdr: string) => {
    if (!address) throw new Error('No Stellar wallet connected.');
    const result = await freighterSign(xdr, {
      networkPassphrase: STELLAR_MAINNET_PASSPHRASE,
      address,
    });
    if (result.error || !result.signedTxXdr) {
      throw new Error(result.error?.message ?? 'Freighter did not sign.');
    }
    return result.signedTxXdr;
  };

  return (
    <StellarWalletContext.Provider
      value={{
        address,
        connected: address !== null,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet() {
  return useContext(StellarWalletContext);
}
