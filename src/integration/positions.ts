import type AugustSDK from '@augustdigital/sdk';
import type { IAddress, IVaultPosition } from '@augustdigital/sdk';

export type PositionsSdk = Pick<AugustSDK, 'getVaultPositions'>;

export type PositionFamily = 'evm' | 'solana' | 'stellar';

export type ConnectedAddresses = Record<PositionFamily, string | null>;

interface PositionRow {
  family: PositionFamily;
  position: IVaultPosition;
}

export interface PositionsResult {
  rows: PositionRow[];
  failed: PositionFamily[];
}

const FAMILIES: PositionFamily[] = ['evm', 'solana', 'stellar'];

function readFamily(
  sdk: PositionsSdk,
  family: PositionFamily,
  address: string,
) {
  switch (family) {
    case 'evm':
      return sdk.getVaultPositions({ wallet: address as IAddress });
    case 'solana':
      return sdk.getVaultPositions({ solanaWallet: address });
    case 'stellar':
      return sdk.getVaultPositions({ stellarWallet: address });
  }
}

export async function readPositions(
  sdk: PositionsSdk,
  addresses: ConnectedAddresses,
): Promise<PositionsResult> {
  const connected = FAMILIES.filter((family) => addresses[family]);
  const settled = await Promise.allSettled(
    connected.map((family) =>
      readFamily(sdk, family, addresses[family] as string),
    ),
  );
  const rows: PositionRow[] = [];
  const failed: PositionFamily[] = [];
  settled.forEach((result, index) => {
    const family = connected[index] as PositionFamily;
    if (result.status === 'rejected') failed.push(family);
    else rows.push(...result.value.map((position) => ({ family, position })));
  });
  return { rows, failed };
}
