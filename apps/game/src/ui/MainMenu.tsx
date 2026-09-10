import type { RunHistoryItem } from '../api/server';
import { shortenAddress } from '@omr/shared';

export function MainMenu({
  onStart, onConnect, walletAddress, connecting, history,
}: {
  onStart: () => void;
  onConnect: () => void;
  walletAddress: string | null;
  connecting: boolean;
  history: RunHistoryItem[];
}) {
  return (
    <div className="modal">
      <div className="card">
        <h1>ONE MORE RUN</h1>
        <div className="tag">HOW  GREEDY  ARE  YOU?</div>
        <div className="btn-row">
          <button className="btn primary" onClick={onStart}>▶ PLAY (GUEST)</button>
          {walletAddress ? (
            <button className="btn" onClick={onStart}>▶ PLAY AS {shortenAddress(walletAddress)}</button>
          ) : (
            <button className="btn" onClick={onConnect} disabled={connecting}>
              {connecting ? 'CONNECTING…' : '🔗 CONNECT RONIN WALLET'}
            </button>
          )}
        </div>
        {history.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--ink-2)', textTransform: 'uppercase', marginBottom: 8 }}>
              Recent Runs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflow: 'auto' }}>
              {history.slice(0, 6).map(h => (
                <div key={h.runId} style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: 8, fontSize: 12,
                  padding: '4px 6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #1c2036', borderRadius: 4,
                }}>
                  <span style={{ color: 'var(--ink-2)' }}>{new Date(h.endedAt).toLocaleString()}</span>
                  <span>Floor {h.stats.floor}</span>
                  <span style={{ color: h.status === 'extracted' ? '#ffb347' : '#c2362d' }}>{h.status.toUpperCase()}</span>
                  <span style={{ color: '#ffb347' }}>{h.rewardOmr.toFixed(2)} OMR</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="menu-footer">v0.1 · Pre-Alpha · Saigon Testnet</div>
      </div>
    </div>
  );
}
