export const SOLANA_HOLDER = '6JbuegVZKdfqKWkR1xe57DCC2xWr2jQEqJKzDz1TeFpW';

export const STELLAR_HOLDER =
  'GAHBXQUD5ALLP33GEE3ZUTGTPMC74CZVBQHKNGP2UOR763AR4W3V3Y7I';

export const FEATURED_VAULTS = {
  evm: { chainId: 1, address: '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42' },
  solana: {
    chainId: -1,
    address: '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1',
    programId: 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt',
  },
  stellar: {
    chainId: -3,
    address: 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY',
    nativeXlmAddress:
      'CC6TRAPQD3NK7THUKWPV5SL2JHKQGNXZVB6S6MVYFSLRWAKEFUWZKZ7J',
    shareDecimals: 13,
  },
} as const;
