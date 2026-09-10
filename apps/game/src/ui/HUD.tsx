import type { GameUiState } from '../game/scenes/GameScene';

const TIER_NAMES = ['Bone', 'Iron', 'Steel', 'Silver', 'Gold', 'Mythic', 'Legendary'];
const TIER_COLORS = ['#c8b790', '#c8b790', '#e8e8ee', '#5fb6ff', '#ffb347', '#b86bff', '#ff8a1a'];

export function HUD({ state }: { state: GameUiState }) {
  const hpPct = Math.max(0, Math.min(1, state.hp / Math.max(1, state.maxHp)));
  const greedHigh = state.greed >= 3;
  const tier = state.combat.weaponTier;
  const tierName = TIER_NAMES[Math.min(tier, TIER_NAMES.length - 1)];
  const tierColor = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const dps = state.combat.attack * state.combat.attackSpeed;
  return (
    <div className="dom-hud">
      <div className="top-left">
        <div className="bar">
          <span className="label">HP</span>
          <div className="fill"><div className="hp" style={{ width: `${hpPct * 100}%` }} /></div>
          <span className="v">{Math.round(state.hp)} / {state.maxHp}</span>
        </div>
        <div className="chip gold">
          <span className="label">GOLD</span>
          <span className="v">{state.runGold.toLocaleString()}</span>
        </div>
        <div className="chip" style={{ borderColor: tierColor, color: tierColor }}>
          <span className="label">WEAPON</span>
          <span className="v">{tierName}</span>
        </div>
      </div>
      <div className="top-right">
        <div className="chip floor">
          <span className="label">FLOOR</span>
          <span className="v">{state.floor}</span>
        </div>
        <div className={`chip greed ${greedHigh ? 'high' : ''}`}>
          <span className="label">GREED</span>
          <span className="v">{state.greedMult}</span>
        </div>
        {state.currentRoomName && (
          <div className="chip" style={{ color: '#c8b790' }}>
            <span className="label">ROOM</span>
            <span className="v">{state.currentRoomName}</span>
          </div>
        )}
      </div>
      <div className="stats-card">
        <div className="row">
          <span className="k">ATK</span>
          <span className="v" style={{ color: tierColor }}>{state.combat.attack.toFixed(1)}</span>
        </div>
        <div className="row">
          <span className="k">APS</span>
          <span className="v">{state.combat.attackSpeed.toFixed(1)}</span>
        </div>
        <div className="row">
          <span className="k">DPS</span>
          <span className="v">{dps.toFixed(1)}</span>
        </div>
        <div className="row">
          <span className="k">CRIT</span>
          <span className="v">{Math.round(state.combat.critChance * 100)}%</span>
        </div>
        <div className="row">
          <span className="k">SPD</span>
          <span className="v">{state.combat.moveSpeed}</span>
        </div>
        <div className="row">
          <span className="k">DODGE</span>
          <span className="v">{Math.round(state.combat.dodge * 100)}%</span>
        </div>
      </div>
      {state.relics.length > 0 && (
        <div className="relics">
          {state.relics.slice(-6).map((r, i) => (
            <div className="relic" key={i}>
              <span className={`dot ${r.rarity}`} />
              <span className="name">{r.name}</span>
            </div>
          ))}
          {state.relics.length > 6 && (
            <div className="relic" style={{ opacity: 0.6 }}>
              <span className="v">+{state.relics.length - 6} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
