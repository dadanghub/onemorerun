/**
 * Pause overlay. Shown when the Phaser scene is paused. ESC resumes.
 */
export function PauseOverlay({
  onResume, onMainMenu,
}: {
  onResume: () => void;
  onMainMenu: () => void;
}) {
  return (
    <div className="pauseoverlay">
      <div className="card">
        <div className="title">PAUSED</div>
        <div className="row">
          <button className="btn primary" onClick={onResume}>▶ RESUME</button>
        </div>
        <div className="footnote">ESC to resume · your run is safe</div>
      </div>
    </div>
  );
}
