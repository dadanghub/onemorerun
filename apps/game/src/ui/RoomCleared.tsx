import { useEffect, useState } from 'react';
import type { GameUiState } from '../game/scenes/GameScene';

/**
 * "Room Cleared" interstitial.
 *
 * Shown for ~2.5s after the player clears a non-extraction room, or until
 * they hit CONTINUE. This gives the run summary a beat to land and lets
 * the player consciously choose to keep going instead of being yanked
 * into the next room.
 */
export function RoomCleared({
  state, onContinue,
}: {
  state: GameUiState;
  onContinue: () => void;
}) {
  const summary = state.lastRoomSummary;
  const [autoIn, setAutoIn] = useState(2.5);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (pressed) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const remaining = Math.max(0, 2.5 - elapsed);
      setAutoIn(remaining);
      if (remaining <= 0) {
        handleContinue();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressed]);

  // SPACE / ENTER also continues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressed]);

  const handleContinue = () => {
    setPressed((p) => {
      if (p) return p;
      onContinue();
      return true;
    });
  };

  return (
    <div className="roomcleared">
      <div className="card">
        <div className="title">ROOM CLEARED</div>
        <div className="room-name">{summary?.name ?? `Room ${summary?.index ?? state.roomIndex}`}</div>
        <div className="stats">
          {summary && summary.enemiesKilledInRoom > 0 && (
            <>
              <div className="label">Enemies Slain</div>
              <div className="v">{summary.enemiesKilledInRoom}</div>
            </>
          )}
          {summary && summary.goldLootedInRoom > 0 && (
            <>
              <div className="label">Gold Looted</div>
              <div className="v" style={{ color: 'var(--gold)' }}>+{summary.goldLootedInRoom.toLocaleString()}</div>
            </>
          )}
          {summary && summary.relicsFoundInRoom > 0 && (
            <>
              <div className="label">Relics Found</div>
              <div className="v" style={{ color: 'var(--legendary)' }}>{summary.relicsFoundInRoom}</div>
            </>
          )}
          <div className="label">Run Gold</div>
          <div className="v" style={{ color: 'var(--gold)' }}>{state.runGold.toLocaleString()}</div>
          <div className="label">Greed</div>
          <div className="v" style={{ color: 'var(--fire)' }}>{state.greedMult}</div>
        </div>
        <button className="btn primary continue" onClick={handleContinue}>
          {pressed ? 'CONTINUING…' : `CONTINUE  ·  ${autoIn.toFixed(1)}s`}
        </button>
        <div className="footnote">
          SPACE or ENTER to continue  ·  Exit arrow ➜ to the next room
        </div>
      </div>
    </div>
  );
}
