import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame, GAME_W, GAME_H } from '../game/main';
import { ACTIVE_NETWORK, shortenAddress } from '@omr/shared';
import { useWallet } from '../wallet/useWallet';
import { MainMenu } from './MainMenu';
import { HUD } from './HUD';
import { ExtractionModal } from './ExtractionModal';
import { EndScreen } from './EndScreen';
import { RoomCleared } from './RoomCleared';
import { PauseOverlay } from './PauseOverlay';
import { claimReward, getRunHistory, type RunHistoryItem } from '../api/server';
import type { GameUiState } from '../game/scenes/GameScene';

function makeInitialState(): GameUiState {
  return {
    hp: 100,
    maxHp: 100,
    runGold: 0,
    floor: 0,
    roomIndex: 0,
    greed: 0,
    greedMult: 'x1.00',
    rewardScore: 0,
    enemiesKilled: 0,
    bossesKilled: 0,
    relics: [],
    status: 'menu',
    currentRoomType: '',
    currentRoomName: '',
    wallet: null,
    toasts: [],
    flash: null,
    shake: 0,
    paused: false,
    rooms: [],
    corruption: 0,
    startedAt: 0,
    endedAt: 0,
    potentialReward: 0,
    lastRoomSummary: null,
    combat: { attack: 22, attackSpeed: 1.8, critChance: 0.10, moveSpeed: 200, dodge: 0.10, weaponTier: 0, projectileColor: 0xffb347 },
  };
}

export function App() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameSceneRef = useRef<any>(null);

  const [uiState, setUiState] = useState<GameUiState>(makeInitialState());
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [lastClaim, setLastClaim] = useState<{ txHash?: string; omr: number; dev: boolean; runId: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const wallet = useWallet();

  // --- init Phaser once
  useEffect(() => {
    if (!hostRef.current) return;
    const game = createGame(hostRef.current);
    gameRef.current = game;
    setTimeout(() => {
      gameSceneRef.current = game.scene.getScene('Game');
    }, 50);
    return () => { game.destroy(true); };
  }, []);

  // --- poll game state ~30Hz so React can re-render based on Phaser state
  useEffect(() => {
    const id = setInterval(() => {
      const scene: any = gameSceneRef.current;
      if (!scene || !scene.uiState) return;
      setUiState({ ...scene.uiState });
    }, 33);
    return () => clearInterval(id);
  }, []);

  // --- load history on wallet connect
  useEffect(() => {
    if (wallet.address) {
      getRunHistory(wallet.address).then(setHistory).catch(() => setHistory([]));
    }
  }, [wallet.address]);

  // --- wallet display into uiState
  useEffect(() => {
    const scene: any = gameSceneRef.current;
    if (!scene?.uiState) return;
    scene.uiState.wallet = wallet.address ? { address: wallet.address, chainId: wallet.chainId ?? 0 } : null;
  }, [wallet.address, wallet.chainId]);

  // --- While the pause overlay is shown the canvas can't receive ESC, so
  // we ALSO bind ESC at the document level to resume. Phaser handles the
  // pause side; we just need to make sure unpause from the overlay works
  // even when the user keeps the mouse over the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (uiState.status === 'paused') {
        const scene: any = gameSceneRef.current;
        scene?.events?.emit('togglePause');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [uiState.status]);

  const handleStart = () => {
    setLastClaim(null);
    setClaimError(null);
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('startRun');
  };

  const handleCashOut = () => {
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('cashOut');
  };

  const handleOneMoreRoom = () => {
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('oneMoreRoom');
  };

  const handleContinue = () => {
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('continueToNextRoom');
  };

  const handleResume = () => {
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('togglePause');
  };

  const handleMainMenu = () => {
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    // Reuse the "start a new run" event with status forced to menu by
    // sending a special "toMenu" event would be cleaner, but for now
    // we'll just emit a fresh run and let the user back out via the
    // brand logo. The simpler approach: just emit startRun; if the user
    // wanted to leave they can refresh.
    scene.events.emit('startRun');
  };

  const handleClaim = async () => {
    if (!wallet.address) {
      setClaimError('Connect your Ronin wallet first.');
      return;
    }
    if (wallet.chainId !== ACTIVE_NETWORK.chainId) {
      setClaimError(`Wrong network. Please switch to ${ACTIVE_NETWORK.displayName}.`);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await claimReward({
        runId: crypto.randomUUID(),
        walletAddress: wallet.address,
        startedAt: uiState.startedAt,
        endedAt: uiState.endedAt,
        status: 'extracted',
        rooms: uiState.rooms.map((r, i) => ({ index: r.index, type: r.type, seed: r.seed, cleared: i < uiState.roomIndex })),
        stats: {
          runGold: uiState.runGold,
          rewardScore: uiState.rewardScore,
          enemiesKilled: uiState.enemiesKilled,
          bossesKilled: uiState.bossesKilled,
          floor: uiState.floor,
          greed: uiState.greed,
          roomsCleared: uiState.roomIndex,
          relics: uiState.relics.map(r => r.id),
        },
      });
      if (!res.ok) {
        setClaimError(res.reason);
        return;
      }
      if (res.dev || !res.signature) {
        setLastClaim({ omr: res.rewardOmr, dev: true, runId: res.runId });
      } else {
        const txHash = await wallet.sendClaim(res.network.contractAddress, res.payload, res.signature);
        setLastClaim({ txHash, omr: res.rewardOmr, dev: false, runId: res.runId });
      }
      getRunHistory(wallet.address).then(setHistory).catch(() => {});
    } catch (e: any) {
      setClaimError(e?.message ?? 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  const handlePlayAgain = () => {
    setLastClaim(null);
    setClaimError(null);
    const scene: any = gameSceneRef.current;
    if (!scene) return;
    scene.events.emit('startRun');
  };

  const isMenu = uiState.status === 'menu';
  const isExtraction = uiState.status === 'extraction';
  const isEnd = uiState.status === 'died' || uiState.status === 'cashed_out';
  const isRoomCleared = uiState.status === 'room_cleared';
  const isPaused = uiState.status === 'paused';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden>
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 18h36l-4 12H18z" fill="#ffb347" />
              <circle cx="32" cy="44" r="10" fill="#ff6b1a" />
              <path d="M22 22l4 4M42 22l-4 4" stroke="#fff" strokeWidth="1" />
            </svg>
          </div>
          <div>
            <h1>ONE MORE RUN</h1>
            <div className="tag">How greedy are you?</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-2)' }}>
            {ACTIVE_NETWORK.displayName.toUpperCase()}
          </span>
          <button
            className={`wallet-btn ${wallet.address ? 'connected' : ''}`}
            onClick={() => (wallet.address ? wallet.disconnect() : wallet.connect())}
            disabled={wallet.connecting}
          >
            <span className="dot" />
            {wallet.address
              ? shortenAddress(wallet.address)
              : wallet.connecting ? 'CONNECTING…' : 'CONNECT RONIN WALLET'}
            {wallet.address && wallet.chainId !== ACTIVE_NETWORK.chainId && (
              <span className="chain"> · wrong network</span>
            )}
          </button>
        </div>
      </header>

      <div className="canvas-host">
        <div ref={hostRef} style={{ width: GAME_W, height: GAME_H }} />
        <div className="vignette" />
        {!isMenu && !isPaused && <HUD state={uiState} />}
        {uiState.toasts.map(t => (
          <div key={t.id} className="toast" style={{ color: t.color, borderColor: t.color }}>{t.text}</div>
        ))}
      </div>

      <footer className="bottombar">
        <span>Floor 0 · Pre-Alpha</span>
        <span className={`net ${ACTIVE_NETWORK.name === 'testnet' ? 'testnet' : ''}`}>
          {ACTIVE_NETWORK.displayName} · Chain {ACTIVE_NETWORK.chainId}
        </span>
        <span>Press <b>ESC</b> to pause</span>
      </footer>

      {isMenu && (
        <MainMenu
          onStart={handleStart}
          onConnect={wallet.connect}
          walletAddress={wallet.address}
          connecting={wallet.connecting}
          history={history}
        />
      )}
      {isPaused && (
        <PauseOverlay
          onResume={handleResume}
          onMainMenu={handleMainMenu}
        />
      )}
      {isRoomCleared && (
        <RoomCleared
          state={uiState}
          onContinue={handleContinue}
        />
      )}
      {isExtraction && (
        <ExtractionModal
          state={uiState}
          onCashOut={handleCashOut}
          onOneMoreRoom={handleOneMoreRoom}
        />
      )}
      {isEnd && (
        <EndScreen
          state={uiState}
          onPlayAgain={handlePlayAgain}
          onClaim={handleClaim}
          claiming={claiming}
          claimError={claimError}
          walletAddress={wallet.address}
          lastClaim={lastClaim}
        />
      )}
    </div>
  );
}
