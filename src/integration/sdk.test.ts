import { buildSdkConfig, resolveSdkClass } from './sdk';

describe('buildSdkConfig', () => {
  const config = buildSdkConfig({});

  it('identifies the app as upshift-starter', () => {
    expect(config.appName).toBe('upshift-starter');
  });

  it('reads Solana at confirmed commitment on mainnet-beta', () => {
    expect(config.solana).toMatchObject({
      network: 'mainnet-beta',
      commitment: 'confirmed',
    });
  });

  it('targets Stellar mainnet', () => {
    expect(config.stellar).toEqual({ network: 'mainnet' });
  });

  it('turns curator alerts off and reports as DEV', () => {
    expect(config.monitoring).toEqual({
      env: 'DEV',
      curatorAlerts: { enabled: false },
    });
  });

  it('ships no API keys', () => {
    expect(config).not.toHaveProperty('keys');
  });

  it('only configures Ethereum mainnet as an EVM provider', () => {
    expect(Object.keys(config.providers ?? {})).toEqual(['1']);
  });

  it('honours RPC overrides', () => {
    const overridden = buildSdkConfig({
      VITE_RPC_ETHEREUM: 'https://eth.example',
      VITE_RPC_SOLANA: 'https://sol.example',
    });
    expect(overridden.providers?.[1]).toBe('https://eth.example');
    expect(overridden.solana?.rpcUrl).toBe('https://sol.example');
  });

  it('routes catalog reads through the Vite proxy only in dev', () => {
    expect(
      buildSdkConfig({ DEV: true }, 'http://localhost:5173').publicApiBaseUrl,
    ).toBe('http://localhost:5173/api/august');
    expect(
      buildSdkConfig({ DEV: false }, 'https://starter.upshift.finance')
        .publicApiBaseUrl,
    ).toBeUndefined();
  });

  it('disables analytics in CI and preview builds', () => {
    expect(buildSdkConfig({ CI: 'true' }).analytics).toEqual({
      enabled: false,
    });
    expect(buildSdkConfig({ VERCEL_ENV: 'preview' }).analytics).toEqual({
      enabled: false,
    });
    expect(buildSdkConfig({ VERCEL_ENV: 'production' }).analytics).toEqual({
      enabled: true,
    });
  });

  it('keeps analytics on when CI is the string "false"', () => {
    expect(buildSdkConfig({ CI: 'false' }).analytics).toEqual({
      enabled: true,
    });
  });
});

describe('resolveSdkClass', () => {
  class Fake {}

  it('unwraps the bundler-nested CJS default', () => {
    expect(resolveSdkClass({ default: { default: Fake } })).toBe(Fake);
  });

  it('accepts a plain ESM default', () => {
    expect(resolveSdkClass({ default: Fake })).toBe(Fake);
  });

  it('accepts the class itself', () => {
    expect(resolveSdkClass(Fake)).toBe(Fake);
  });
});
