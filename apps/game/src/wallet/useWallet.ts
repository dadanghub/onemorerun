/**
 * Ronin wallet hook.
 *
 * Uses the official `@sky-mavis/tanto-connect` SDK (EIP-6963 injected
 * provider). Docs:
 *   https://docs.skymavis.com/ronin/wallet/tutorials/connect-web
 *
 * Falls back gracefully if the wallet is not installed so the game is
 * always playable in guest mode.
 */
import { useCallback, useEffect, useState } from 'react';
import { ACTIVE_NETWORK, type ClaimPayload } from '@omr/shared';

declare global {
  interface Window {
    ronin?: any;
  }
}

export type WalletStatus = 'idle' | 'connecting' | 'connected' | 'wrong_network' | 'error';

interface WalletState {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  error: string | null;
  connecting: boolean;
}

let _connector: any = null;
let _address: string | null = null;
let _chainId: number | null = null;

async function getConnector() {
  if (_connector) return _connector;
  try {
    const mod: any = await import('@sky-mavis/tanto-connect');
    // The SDK exposes different connectors. We try the injected Ronin
    // wallet first (browser extension), then fall back to whatever else
    // is available.
    if (typeof mod.requestRoninWalletConnector === 'function') {
      try { _connector = await mod.requestRoninWalletConnector(); return _connector; } catch (e) { /* fall through */ }
    }
    if (typeof mod.requestRoninWalletConnectConnector === 'function') {
      try { _connector = await mod.requestRoninWalletConnectConnector(); return _connector; } catch (e) { /* fall through */ }
    }
    if (typeof mod.requestWaypointConnector === 'function') {
      try {
        _connector = await mod.requestWaypointConnector({
          providerConfigs: { clientId: 'one-more-run', chainId: ACTIVE_NETWORK.chainId },
        });
        return _connector;
      } catch (e) { /* fall through */ }
    }
    throw new Error('No Ronin connector available');
  } catch (e: any) {
    throw new Error(e?.message || 'Failed to load Ronin SDK');
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    status: 'idle', address: null, chainId: null, error: null, connecting: false,
  });

  // Try to silently reconnect on mount.
  useEffect(() => {
    (async () => {
      try {
        const c = await getConnector();
        const accounts = await c.getAccounts?.();
        if (Array.isArray(accounts) && accounts.length) {
          _address = accounts[0];
          _chainId = await c.getChainId?.() ?? null;
          setState({
            status: _chainId === ACTIVE_NETWORK.chainId ? 'connected' : 'wrong_network',
            address: _address, chainId: _chainId, error: null, connecting: false,
          });
        }
      } catch {
        // Wallet not installed; that's fine.
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }));
    try {
      const c = await getConnector();
      const result = await c.connect();
      _address = result?.account ?? null;
      _chainId = result?.chainId ?? (await c.getChainId?.()) ?? null;
      // If wrong network, ask the wallet to switch.
      if (_chainId && _chainId !== ACTIVE_NETWORK.chainId && typeof c.switchChain === 'function') {
        try {
          await c.switchChain(ACTIVE_NETWORK.chainId);
          _chainId = ACTIVE_NETWORK.chainId;
        } catch (e) {
          // user may have rejected; we still report connected
        }
      }
      setState({
        status: _chainId === ACTIVE_NETWORK.chainId ? 'connected' : 'wrong_network',
        address: _address, chainId: _chainId, error: null, connecting: false,
      });
    } catch (e: any) {
      // If provider not found, point user to install.
      const msg = String(e?.message || e);
      if (msg.includes('not') && msg.includes('found')) {
        try { window.open('https://wallet.roninchain.com', '_blank'); } catch {}
      }
      setState(s => ({ ...s, connecting: false, error: msg }));
    }
  }, []);

  const disconnect = useCallback(() => {
    _address = null;
    _chainId = null;
    setState({ status: 'idle', address: null, chainId: null, error: null, connecting: false });
  }, []);

  const sendClaim = useCallback(async (contractAddress: string, payload: ClaimPayload, signature: `0x${string}`): Promise<string> => {
    const c = await getConnector();
    if (!_address) throw new Error('Wallet not connected');
    // Encode the claim(...) call. We delegate the ABI encoding to viem if available.
    let encodeClaim: (c: string, p: ClaimPayload, sig: string) => `0x${string}`;
    try {
      const viem: any = await import('viem');
      const CLAIM_ABI = [{
        name: 'claim',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'runId',  type: 'bytes32' },
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce',  type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
      }];
      encodeClaim = (c, p, sig) => viem.encodeFunctionData({
        abi: CLAIM_ABI,
        functionName: 'claim',
        args: [p.runId, p.player, BigInt(Math.round(Number(p.amountOmr) * 1e18)), BigInt(p.nonce), BigInt(p.expiry), sig as `0x${string}`],
      });
    } catch {
      throw new Error('viem is required to send the claim transaction');
    }
    const data = encodeClaim(contractAddress, payload, signature);
    // The Tanto connector exposes sendTransaction on its provider.
    const provider = c?.provider ?? c;
    let txHash: string;
    if (typeof provider?.request === 'function') {
      txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: _address, to: contractAddress, data, value: '0x0' }],
      });
    } else if (typeof c?.sendTransaction === 'function') {
      txHash = await c.sendTransaction({ from: _address, to: contractAddress, data });
    } else {
      throw new Error('Connected wallet does not support sendTransaction');
    }
    return txHash;
  }, []);

  return {
    ...state,
    address: state.address,
    chainId: state.chainId,
    connecting: state.connecting,
    connect,
    disconnect,
    sendClaim,
  };
}
