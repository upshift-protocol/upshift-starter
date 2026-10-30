import { fireEvent, render, screen } from '@testing-library/react';
import type { createSdk } from '../integration/sdk';
import { Positions } from './Positions';

const none = { evm: null, solana: null, stellar: null };
const position = (vault: string, shares: string) => ({
  vault,
  status: 'STAKED',
  walletBalance: { normalized: shares },
  redeemable: { normalized: '0' },
});
const sdkWith = (getVaultPositions: unknown) =>
  ({ getVaultPositions }) as unknown as ReturnType<typeof createSdk>;

describe('Positions', () => {
  it('renders nothing with no wallet connected', () => {
    const sdk = sdkWith(vi.fn());
    const { container } = render(<Positions sdk={sdk} addresses={none} />);
    expect(container).toBeEmptyDOMElement();
    expect(sdk.getVaultPositions).not.toHaveBeenCalled();
  });

  it('lists positions for the connected wallets and says what EVM covers', async () => {
    const sdk = sdkWith(vi.fn().mockResolvedValue([position('Cabc', '12.5')]));
    render(<Positions sdk={sdk} addresses={{ ...none, stellar: 'G1' }} />);
    expect(await screen.findByText('12.5 shares')).toBeInTheDocument();
    expect(screen.getByText(/Ethereum mainnet/)).toBeInTheDocument();
  });

  it('opens the vault behind a row and disables rows it cannot open', async () => {
    const sdk = sdkWith(
      vi
        .fn()
        .mockResolvedValue([position('Cabc', '1'), position('Cmissing', '2')]),
    );
    const open = vi.fn();
    const onOpen = vi.fn((_family: string, vault: string) =>
      vault === 'Cabc' ? open : undefined,
    );
    render(
      <Positions
        sdk={sdk}
        addresses={{ ...none, stellar: 'G1' }}
        onOpen={onOpen}
      />,
    );
    const [openable, missing] = (await screen.findAllByRole('button', {
      name: /shares/,
    })) as [HTMLElement, HTMLElement];
    expect(missing).toBeDisabled();
    fireEvent.click(openable);
    expect(open).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('stellar', 'Cabc');
  });

  it('disables every row when no opener is given', async () => {
    const sdk = sdkWith(vi.fn().mockResolvedValue([position('Cabc', '1')]));
    render(<Positions sdk={sdk} addresses={{ ...none, stellar: 'G1' }} />);
    expect(
      await screen.findByRole('button', { name: /shares/ }),
    ).toBeDisabled();
  });

  it('lists the same address held on two families without a key clash', async () => {
    const sdk = sdkWith(vi.fn().mockResolvedValue([position('0xSAME', '1')]));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Positions
        sdk={sdk}
        addresses={{ evm: '0x1', solana: null, stellar: 'G1' }}
      />,
    );
    expect(await screen.findAllByText('0xSAME')).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('keeps the families that loaded and retries only on request when one fails', async () => {
    let evmDown = true;
    const read = vi.fn(async (props: { wallet?: string }) => {
      if (props.wallet) {
        if (evmDown) throw new Error('rpc down');
        return [position('0xEvm', '9')];
      }
      return [position('Sol1', '3')];
    });
    render(
      <Positions
        sdk={sdkWith(read)}
        addresses={{ ...none, evm: '0x1', solana: 'S1' }}
      />,
    );
    expect(await screen.findByText('3 shares')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not read EVM positions.',
    );
    expect(screen.queryByText(/No positions/)).toBeNull();
    evmDown = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('9 shares')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says every family failed instead of showing an empty list', async () => {
    const sdk = sdkWith(vi.fn().mockRejectedValue(new Error('down')));
    render(<Positions sdk={sdk} addresses={{ ...none, evm: '0x1' }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not read EVM positions.',
    );
    expect(screen.queryByText(/No positions/)).toBeNull();
  });
});
