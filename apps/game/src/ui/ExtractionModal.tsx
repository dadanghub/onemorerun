import type { GameUiState } from '../game/scenes/GameScene';
import { greedLabel, greedTier } from '@omr/shared';

export function ExtractionModal({
  state, onCashOut, onOneMoreRoom,
}: {
  state: GameUiState;
  onCashOut: () => void;
  onOneMoreRoom: () => void;
}) {
  const tier = greedTier(state.greed);
  const nextTier = greedTier(state.greed + 1);
  return (
    <div className="extract">
      <div className="card">
        <h2>EXTRACTION PORTAL</h2>
        <div className="floor">FLOOR {state.floor} · {tier.flavor.toUpperCase()}</div>
        <div className="stats">
          <div className="label">Run Gold</div><div className="v">{state.runGold.toLocaleString()}</div>
          <div className="label">Reward Score</div><div className="v">{state.rewardScore.toLocaleString()}</div>
          <div className="label">Greed</div><div className="v">{state.greedMult}</div>
          <div className="label">Enemies Slain</div><div className="v">{state.enemiesKilled}</div>
          <div className="label">Bosses Felled</div><div className="v">{state.bossesKilled}</div>
          <div className="label">Relics Held</div><div className="v">{state.relics.length}</div>
        </div>
        <div className="potential">{state.potentialReward.toFixed(2)} OMR</div>
        <div className="nextgreed">
          Next Greed Multiplier:&nbsp; <b style={{ color: 'var(--fire)' }}>{greedLabel(state.greed + 1)}</b>
        </div>
        <div className="row">
          <button className="btn cash" onClick={onCashOut}>💰 CASH OUT</button>
          <button className="btn more" onClick={onOneMoreRoom}>🔥 ONE MORE ROOM</button>
        </div>
      </div>
    </div>
  );
}
