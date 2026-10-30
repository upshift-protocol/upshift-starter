import * as sdkModule from '@augustdigital/sdk';
import { DEFAULT_RPC, DEV_API_PROXY_PATH, type StarterEnv } from '../config';

type AugustSDKClass = typeof sdkModule.default;
type SdkConfig = ConstructorParameters<AugustSDKClass>[0];

export function resolveSdkClass(mod: unknown): AugustSDKClass {
  const m = mod as { default?: AugustSDKClass & { default?: AugustSDKClass } };
  return m.default?.default ?? m.default ?? (mod as AugustSDKClass);
}

export function buildSdkConfig(env: StarterEnv, origin?: string): SdkConfig {
  const isCiOrPreview = env.CI === 'true' || env.VERCEL_ENV === 'preview';
  return {
    appName: 'upshift-starter',
    providers: { 1: env.VITE_RPC_ETHEREUM ?? DEFAULT_RPC.ethereum },
    solana: {
      rpcUrl: env.VITE_RPC_SOLANA ?? DEFAULT_RPC.solana,
      network: 'mainnet-beta',
      commitment: 'confirmed',
    },
    stellar: { network: 'mainnet' },
    monitoring: { env: 'DEV', curatorAlerts: { enabled: false } },
    analytics: { enabled: !isCiOrPreview },
    publicApiBaseUrl:
      env.DEV && origin ? `${origin}${DEV_API_PROXY_PATH}` : undefined,
  };
}

export function createSdk() {
  const AugustSDK = resolveSdkClass(sdkModule);
  return new AugustSDK(buildSdkConfig(import.meta.env, window.location.origin));
}
