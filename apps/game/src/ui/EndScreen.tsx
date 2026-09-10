import type { GameUiState } from '../game/scenes/GameScene';
import { shortenAddress, ACTIVE_NETWORK } from '@omr/shared';

interface LastClaim { txHash?: string; omr: number; dev: boolean; runId: string }

export function EndScreen({
  state, onPlayAgain, onClaim, claiming, claimError, walletAddress, lastClaim,
}: {
  state: GameUiState;
  onPlayAgain: () => void;
  onClaim: () => void;
  claiming: boolean;
  claimError: string | null;
  walletAddress: string | null;
  lastClaim: LastClaim | null;
}) {
  const extracted = state.status === 'cashed_out';
  return (
    <div className={`endscreen ${extracted ? 'extracted' : ''}`}>
      <div className="card">
        <h2>{extracted ? 'EXTRACTION COMPLETE' : 'YOU GOT GREEDY'}</h2>
        <div className="stats">
          <div className="label">Floor Reached</div><div className="v">{state.floor}</div>
          <div className="label">Enemies Killed</div><div className="v">{state.enemiesKilled}</div>
          <div className="label">Bosses Defeated</div><div className="v">{state.bossesKilled}</div>
          <div className="label">Max Greed</div><div className="v">{state.greedMult}</div>
          <div className="label">Run Gold</div><div className="v">{state.runGold.toLocaleString()}</div>
          <div className="label">Reward Score</div><div className="v">{state.rewardScore.toLocaleString()}</div>
          <div className="label">{extracted ? 'Reward' : 'Lost Potential'}</div>
          <div className="v" style={{ color: extracted ? 'var(--gold)' : 'var(--blood)' }}>
            {(extracted ? state.potentialReward : computeLostPotential(state)).toFixed(2)} OMR
          </div>
        </div>
        <div className="footnote">
          Crypto Taken From Wallet:&nbsp; <span className="safe">0</span>
        </div>

        {extracted && !lastClaim && (
          <div className="btn-row">
            {!walletAddress && (
              <div className="footnote" style={{ marginTop: 0 }}>
                Connect your Ronin wallet to claim {state.potentialReward.toFixed(2)} OMR.
              </div>
            )}
            <button className="btn primary" onClick={onClaim} disabled={claiming || !walletAddress}>
              {claiming ? 'CLAIMING…' : `CLAIM ${state.potentialReward.toFixed(2)} OMR TO RONIN`}
            </button>
            {claimError && <div style={{ color: 'var(--blood)', fontSize: 12 }}>{claimError}</div>}
            <button className="btn ghost" onClick={onPlayAgain}>ONE MORE RUN?</button>
          </div>
        )}

        {lastClaim && (
          <div className="btn-row">
            <div className="footnote" style={{ marginTop: 0, color: 'var(--gold)' }}>
              {lastClaim.dev ? '🧪 TEST REWARD — no on-chain transaction' : '✅ REWARD CLAIMED'}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--gold)' }}>
              +{lastClaim.omr.toFixed(2)} OMR
            </div>
            {lastClaim.txHash && (
              <a
                href={`${ACTIVE_NETWORK.explorer}/tx/${lastClaim.txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--ink-1)', fontSize: 12 }}
              >
                View on Explorer →
              </a>
            )}
            <button className="btn ghost" onClick={onPlayAgain}>ONE MORE RUN?</button>
          </div>
        )}

        {!extracted && (
          <div className="btn-row">
            <button className="btn primary" onClick={onPlayAgain}>ONE MORE RUN?</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Reproduce approximate potential reward at moment of death from stats
function computeLostPotential(state: GameUiState): number {
  // Match the formula in GameScene.computePotentialReward
  let score = 0;
  score += state.floor * 1.0;
  score += state.enemiesKilled * 0.6;
  score += state.bossesKilled * 25;
  // approximate greed mult (we lost it on death)
  return Math.max(0, Math.floor((score / 10) * 1.0 * 100) / 100);
}
