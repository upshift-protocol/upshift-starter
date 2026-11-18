# Upshift SDK starter

A three-chain reference integration on `@upshiftfinance/sdk`: EVM, Solana and Stellar vaults in one Vite + React app, live at [integrate.upshift.finance](https://integrate.upshift.finance).

Mainnet only. Real funds. Vault reads work with no wallet and no API keys. Solana balances and Solana writes also need a Solana RPC that allows `getTokenAccountsByOwner`, which free public endpoints do not (see `VITE_RPC_SOLANA`). Every write asks the wallet for a signature first.

Full walkthrough: [Build a three-chain vault app](https://docs.upshift.finance/sdk/three-chain-app).

## What to copy

Most files here only run this demo site. An integration needs a few of them. Paths are under `src/`.

| | EVM | Solana | Stellar |
| --- | --- | --- | --- |
| SDK functions | [`snippets/evm/upshift-vault.ts`](src/snippets/evm/upshift-vault.ts) | [`snippets/solana/upshift-vault.ts`](src/snippets/solana/upshift-vault.ts) | [`snippets/stellar/upshift-vault.ts`](src/snippets/stellar/upshift-vault.ts) |
| React component | [`snippets/evm/UpshiftVault.tsx`](src/snippets/evm/UpshiftVault.tsx) | [`snippets/solana/UpshiftVault.tsx`](src/snippets/solana/UpshiftVault.tsx) | [`snippets/stellar/UpshiftVault.tsx`](src/snippets/stellar/UpshiftVault.tsx) |
| Wallet provider | `EvmWalletProvider` in [`integration/evm/wallet.tsx`](src/integration/evm/wallet.tsx) | `SolanaWalletProvider` in [`integration/solana/wallet.tsx`](src/integration/solana/wallet.tsx) | none: Freighter is a browser extension |
| Install | `@upshiftfinance/sdk wagmi viem @tanstack/react-query` | `@upshiftfinance/sdk @solana/web3.js @solana/wallet-adapter-react` | `@upshiftfinance/sdk @stellar/freighter-api` |

1. **One vault.** Copy the two `snippets/<chain>/` files. They import only the SDK and that chain's wallet library. `upshift-vault.ts` exports `createVaultSdk`, `readVault`, `readPosition`, `deposit`, and `requestWithdraw` (EVM) or `withdraw` (Solana, Stellar). `UpshiftVault.tsx` exports `<UpshiftVault />`, built on those functions. Set `VAULT`, `RPC_URL` and `appName` at the top of `upshift-vault.ts`, then render the component inside the wallet provider. Each vault's Integrate tab on [integrate.upshift.finance](https://integrate.upshift.finance/vaults) gives you the same two files with `VAULT` filled in.
2. **Every vault on all three chains.** Copy [`integration/`](src/integration). It holds the SDK instance, the vault catalog, positions, the wallet providers, and the reads and writes for each chain in `integration/<chain>/actions.ts`. It imports nothing from outside that directory. `components/EvmActions.tsx`, `SolanaActions.tsx` and `StellarActions.tsx` show one form per chain on top of it.
3. **Skip the rest.** These files only run this site: `pages/`, `integrate/`, `App.tsx`, `Root.tsx`, `router.tsx`, `main.tsx`, `theme.ts`, `reduced-motion.ts`, `styles.css`, the site chrome in `components/` (`Layout`, `Footer`, `Logo`, `ThemeToggle`, `CodeBlock`, `CopyButton`, `VaultViews`), and the top-level `public/` folder. Every component uses plain class names (`upshift-vault*` in the snippets), so it works without `styles.css`; it only loses this site's look.

## Run

Run these from `apps/starter` in the monorepo, or from the repository root in the mirror.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/
pnpm test         # unit + component tests
pnpm test:canary  # read-only checks against the real mainnet vaults
```

## Environment

Every variable is optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_RPC_ETHEREUM` | `https://ethereum-rpc.publicnode.com` | Ethereum mainnet JSON-RPC |
| `VITE_RPC_SOLANA` | `https://solana-rpc.publicnode.com` | Solana mainnet JSON-RPC. The default serves vault reads only: it rejects `getTokenAccountsByOwner`, which the SDK uses for Solana balances and deposits. Set a keyed RPC (Helius, Alchemy, QuickNode) restricted to your origin. `api.mainnet-beta.solana.com` returns 403 to browser origins. |

## Layout

```text
src/
├── snippets/               copy-paste pair per chain (see What to copy)
│   ├── evm/                upshift-vault.ts, UpshiftVault.tsx
│   ├── solana/             upshift-vault.ts, UpshiftVault.tsx
│   └── stellar/            upshift-vault.ts, UpshiftVault.tsx
├── integration/            full integration, copy this directory
│   ├── config.ts           default RPCs, dev API proxy path
│   ├── sdk.ts              builds the SDK config and instance
│   ├── starter-sdk.ts      the one instance this app shares
│   ├── vaults.ts           vault catalog grouped by chain family
│   ├── vault-detail.ts     one vault and 30 days of history
│   ├── positions.ts        a wallet's positions on every chain
│   ├── tx-flow.ts          write state machine and error classification
│   ├── wallets.tsx         WalletProviders and useWallets for all three chains
│   ├── evm/
│   │   ├── chains.ts       signing chains, explorer links, amount parsing
│   │   ├── wallet.tsx      wagmi provider, useEvmWallet
│   │   └── actions.ts      balances, approve, deposit, request redeem, claim
│   ├── solana/
│   │   ├── wallet.tsx      wallet-adapter provider, useSolanaWallet
│   │   └── actions.ts      balances, deposit, withdraw
│   └── stellar/
│       ├── wallet.tsx      Freighter provider, useStellarWallet
│       └── actions.ts      account pre-flight, balances, deposit, withdraw
├── components/             demo UI: one form per chain, vault list and detail, site chrome
├── App.tsx                 /vaults and /vaults/<chain>/<address>: list, overview, form
├── pages/                  demo site: landing page and each vault's Integrate tab
├── integrate/              demo site: vault URLs, and the files and commands the Integrate tab shows
├── main.tsx                mounts WalletProviders around Root and Footer
├── Root.tsx                picks the page for the path
├── router.tsx              path matching, navigate, Link (no router dependency)
└── styles.css, theme.ts    this site's look and light/dark switch
tests/canary/               read-only checks against the live vaults, nightly in CI
```

Each test sits next to the file it covers.

## SDK construction (`src/integration/sdk.ts`)

| Setting | Value | Why |
| --- | --- | --- |
| `appName` | `upshift-starter` | Tags this app's telemetry. Use your own slug. |
| `providers` | `{ 1: <rpc> }` | Chain 1 only. `getVaults` drops EVM vaults on chains with no provider. |
| `solana` | `{ rpcUrl, network: 'mainnet-beta', commitment: 'confirmed' }` | Set Solana here, not through `providers[-1]`, or `commitment` stays at `finalized`. |
| `stellar` | `{ network: 'mainnet' }` | The SDK's built-in public Soroban endpoints. |
| `monitoring.env` | `DEV` | Keeps this demo out of production telemetry. A real integration leaves the `PROD` default. |
| `monitoring.curatorAlerts` | `{ enabled: false }` | A failed Stellar redeem would otherwise page the vault's curator. A real integration keeps alerts on. |
| `analytics.enabled` | `false` in CI and preview builds, `true` in local `pnpm dev` | Same reason as `env`, except local dev mirrors production. |
| `keys` | omitted | Vault reads need no August key. `getVault` reads loans and allocations by default, and allocations need a key, so every read here passes `options: { loans: false, allocations: false }`. |
| `publicApiBaseUrl` | dev only: `<origin>/api/august` | See CORS below. |

The package is CommonJS. Vite's dev server and its production build expose the default export differently, so `resolveSdkClass` unwraps `default.default`, `default` or the module itself. `build.commonjsOptions.defaultIsModuleExports` and `define.global` in `vite.config.ts` are part of the same interop and are required.

## Per-chain walkthroughs

### EVM (`integration/evm/actions.ts`)

1. `sdk.evm.setSigner(walletClient)` before every write. The wallet can rotate between interactions.
2. Approve is its own button. `sdk.evm.approve` returns `sent`, `sufficient` or `native`; the deposit button unlocks after it.
3. `vaultDeposit({ target, wallet, amount, wait: true })` in human units.
4. Withdraw is `vaultRequestRedeem`, then `getVaultAvailableRedemptions`, then `claimWithdrawal` (`evm-2`) or `vaultRedeem` with `receiverIndex: '0'` (`evm-0`, `evm-1`), chosen by `vault.version`.

### Solana (`integration/solana/actions.ts`)

1. `Solana.utils.resolveProgramId(vault.address, { program_id: vault.programId })`. The catalog's `programId` is what makes a factory (v2) vault resolve; pass `vaultAddress` only when it differs from the program.
2. `sdk.solana.setWalletProvider(publicKey, signTransaction)` before every write.
3. Amounts are `bigint` from `toNormalizedBn(amount, decimals).raw`.
4. `vaultDeposit(programId, idl, publicKey, raw, undefined, vaultAddress)`. Keep the `undefined` in slot five.
5. Withdrawals are sized with the share mint's decimals from `fetchUserShareBalanceRaw`.
6. A failed balance read shows "unknown", never 0. Submit stays disabled until `publicKey` and `signTransaction` are both present.

### Stellar (`integration/stellar/actions.ts`)

1. Connect with Freighter `requestAccess` on click, never on mount. Restore the stored address in an effect.
2. `sdk.stellar.vaultDeposit({ contractId, amount, senderAddress })` builds unsigned XDR; `amount` is the raw string in smallest units. Freighter signs with the mainnet passphrase; `sdk.stellar.submitTransaction` sends it.
3. Pre-flight: Horizon `GET /accounts/{G...}` returns 404 for an unfunded account, which cannot source a transaction. The form explains activation and re-checks every 8 s. Network failure fails open.
4. Native XLM: Max is capped at the spendable balance (reserve, subentries, sponsorship, liabilities, fee buffer). Offering the full balance reverts with `Error(Contract, #10)`.
5. Withdraw reads `getUserPosition` first and refuses while `decimalsFromFallback` is true. Share decimals can be asset decimals plus a vault offset (13 for earnUSDC).
6. An `AugustSDKError` with `context.resultCode === 'txBadSeq'` is rebuilt and resubmitted once. An `AugustTimeoutError` means the outcome is unknown, so the UI links the explorer instead of saying failed.

### Hardening left out on purpose

Solana retry on Lighthouse guard trips and landed-signature recovery after a confirmation error; the Stellar XDR sequence guard, collision-safe Freighter transport and Soroban error decoding; the Solana withdrawal queue; D'CENT, Para, Ledger and Stellar Wallets Kit.

## CORS

The Upshift API allows every `*.upshift.finance` origin. It rejects `localhost` on every port. In `pnpm dev`, Vite proxies `/api/august` to `https://api.augustdigital.io/api/v1` and the SDK is pointed at that path, so local reads work. The production build calls the API directly.

If you host this app on your own origin, ask Upshift to add it to the allow-list or put the same proxy in front of it.

The app routes by path, so your host must serve `index.html` for every unknown page path. `pnpm dev` and `vite preview` already do; on Vercel, add `"rewrites": [{ "source": "/((?!assets/|media/).*)", "destination": "/index.html" }]` to `vercel.json`. The rewrite skips `/assets/` and `/media/`, so a missing build file or video returns a 404 and not the HTML shell.

## Chain notes

- Solana and Stellar addresses are case-sensitive. Never lowercase them.
- Solana vaults carry the SDK's synthetic chain id `-1`, Stellar `-3`. `vaults.ts` groups on those.
- EVM writes sign on the chains in `integration/evm/chains.ts` (Ethereum mainnet). The form asks the wallet to switch when it is on another chain, shows no form for a vault on a chain outside that list, and builds explorer links from the chain's own explorer.
- Positions are read once per chain family, so one failing family does not hide the others. EVM positions cover the chains configured in `providers` (Ethereum mainnet).
- The SDK logs a version-check warning when a newer release exists. Set `versionCheck: { enabled: false }` to silence it.
