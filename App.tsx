
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Prize, Winner, Participant } from './types';
import { DEFAULT_PRIZES, ICONS } from './constants';
import { loadState, saveState, performDraw } from './services/lotteryService';
import Settings from './components/Settings';

const GiftBox: React.FC = () => (
  <div className="relative w-48 h-48 animate-box-shake">
    <div className="absolute inset-0 bg-red-600 rounded-2xl shadow-2xl border-2 border-red-700"></div>
    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 bg-yellow-400 shadow-inner"></div>
    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 bg-yellow-400 shadow-inner"></div>
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center justify-center">
      <div className="w-16 h-16 border-8 border-yellow-400 rounded-full rotate-45 shadow-lg"></div>
      <div className="w-16 h-16 border-8 border-yellow-400 rounded-full -rotate-45 shadow-lg -ml-4"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = loadState();
    return saved || {
      participants: [],
      prizes: DEFAULT_PRIZES,
      winners: [],
      rigging: { forcedWinners: {}, blacklist: [] },
    };
  });

  const [currentPrizeId, setCurrentPrizeId] = useState<string>(state.prizes[0]?.id || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempWinners, setTempWinners] = useState<Participant[]>([]);
  const [rollingNames, setRollingNames] = useState<string[]>([]);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const rollingIntervalRef = useRef<number | null>(null);

  // 派生状态
  const currentPrizeIndex = state.prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = state.prizes[currentPrizeIndex];
  const allPrizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - allPrizeWinners.length : 0;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!isAudioInitialized) return;
    if (isDrawing) {
      bgMusicRef.current?.pause();
      if (rollAudioRef.current) {
        rollAudioRef.current.currentTime = 0;
        rollAudioRef.current.loop = true;
        rollAudioRef.current.play().catch(() => {});
      }
    }
  }, [isDrawing, isAudioInitialized]);

  const initAudio = () => {
    if (!isAudioInitialized) {
      setIsAudioInitialized(true);
      bgMusicRef.current?.play().catch(() => {});
    }
  };

  const navigatePrize = (dir: 'prev' | 'next') => {
    if (isDrawing) return;
    const count = state.prizes.length;
    let newIndex = dir === 'prev' ? currentPrizeIndex - 1 : currentPrizeIndex + 1;
    if (newIndex < 0) newIndex = count - 1;
    if (newIndex >= count) newIndex = 0;
    setCurrentPrizeId(state.prizes[newIndex].id);
    setTempWinners([]);
    setRollingNames([]);
  };

  const handleBatchChange = (delta: number) => {
    if (isDrawing || !currentPrize) return;
    const newBatch = Math.max(1, Math.min(remainingCount, currentPrize.drawBatch + delta));
    const updatedPrizes = state.prizes.map(p => 
      p.id === currentPrizeId ? { ...p, drawBatch: newBatch } : p
    );
    setState(prev => ({ ...prev, prizes: updatedPrizes }));
  };

  const startDraw = () => {
    initAudio();
    if (isDrawing) {
      handleStop();
      return;
    }
    if (!currentPrize || remainingCount <= 0 || state.participants.length === 0) return;
    
    setIsDrawing(true);
    setTempWinners([]);

    const batchSize = Math.min(currentPrize.drawBatch, remainingCount);
    rollingIntervalRef.current = window.setInterval(() => {
      const randomNames = Array.from({ length: batchSize }).map(() => {
        const randomIndex = Math.floor(Math.random() * state.participants.length);
        return state.participants[randomIndex].name;
      });
      setRollingNames(randomNames);
    }, 60);
  };

  const handleStop = () => {
    if (rollingIntervalRef.current) {
      clearInterval(rollingIntervalRef.current);
      rollingIntervalRef.current = null;
    }

    const result = performDraw(state, currentPrizeId);
    if (result.error) {
      alert(result.error);
      setIsDrawing(false);
      return;
    }

    setTempWinners(result.winners);
    setRollingNames([]);
    setIsDrawing(false);

    rollAudioRef.current?.pause();
    if (winAudioRef.current) {
      winAudioRef.current.currentTime = 0;
      winAudioRef.current.play().catch(() => {});
      setTimeout(() => {
        if (!isDrawing) bgMusicRef.current?.play().catch(() => {});
      }, 4500);
    }

    const newWinners: Winner[] = result.winners.map(p => ({
      participantId: p.id,
      participantName: p.name,
      prizeId: currentPrizeId,
      prizeName: currentPrize!.name,
      drawTime: Date.now(),
    }));

    setState(prev => ({
      ...prev,
      winners: [...prev.winners, ...newWinners]
    }));
  };

  const handleShowWinnersInMain = () => {
    if (allPrizeWinners.length === 0) {
      alert("当前奖项尚未产生中奖名单");
      return;
    }
    const winnersList = allPrizeWinners.map(w => ({
      id: w.participantId,
      name: w.participantName,
      department: '公司'
    }));
    setTempWinners(winnersList);
  };

  const renderSmartName = (name: string, baseFontSize: string) => {
    const symbols = /[ \-\(\)\[\]\/_]/;
    const match = name.match(symbols);
    
    let line1 = name;
    let line2 = "";

    if (match && match.index !== undefined) {
      line1 = name.substring(0, match.index);
      line2 = name.substring(match.index);
    } else if (name.length > 3) {
      line1 = name.substring(0, 3);
      line2 = name.substring(3);
    }

    if (!line2) return <span className={`${baseFontSize} font-song font-black`}>{line1}</span>;

    const sizeMap: Record<string, string> = {
      'text-9xl': 'text-8xl',
      'text-8xl': 'text-7xl',
      'text-7xl': 'text-6xl',
      'text-6xl': 'text-5xl',
      'text-5xl': 'text-4xl',
      'text-4xl': 'text-3xl',
      'text-3xl': 'text-2xl',
      'text-2xl': 'text-xl',
      'text-xl': 'text-lg',
      'text-lg': 'text-base',
    };

    const mainClass = sizeMap[baseFontSize] || baseFontSize;
    const subClass = sizeMap[mainClass] || 'text-lg';

    return (
      <div className="flex flex-col items-center justify-center leading-tight py-1 font-song">
        <span className={`${mainClass} font-black tracking-tight`}>{line1}</span>
        <span className={`${subClass} font-bold opacity-80 mt-1 italic`}>{line2}</span>
      </div>
    );
  };

  const getDisplayConfig = (count: number) => {
    if (count <= 1) return { fontSize: 'text-9xl', cardSize: 'w-[520px] h-[350px]' };
    if (count <= 4) return { fontSize: 'text-7xl', cardSize: 'w-[320px] h-[220px]' };
    if (count <= 5) return { fontSize: 'text-6xl', cardSize: 'w-[230px] h-[160px]' };
    if (count <= 10) return { fontSize: 'text-5xl', cardSize: 'w-[220px] h-[150px]' };
    if (count <= 15) return { fontSize: 'text-4xl', cardSize: 'w-[200px] h-[140px]' };
    if (count <= 25) return { fontSize: 'text-3xl', cardSize: 'w-[190px] h-[130px]' };
    return { fontSize: 'text-2xl', cardSize: 'w-[170px] h-[120px]' };
  };

  const currentConfig = getDisplayConfig(isDrawing ? rollingNames.length : tempWinners.length);

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden" onClick={initAudio}>
      <audio ref={bgMusicRef} src="节奏背景.mp3" loop />
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/music/preview/mixkit-glitchy-drum-and-bass-113.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      <header className="px-10 py-6 flex justify-end items-center z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
          className="p-4 glass-dark rounded-full text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30 shadow-lg"
        >
          <ICONS.Settings />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-10 pb-10 z-10 relative">
        <div className="mb-6 flex items-center justify-center gap-6 md:gap-12">
          <button onClick={(e) => { e.stopPropagation(); navigatePrize('prev'); }} className="prize-nav-btn p-2">
            <ICONS.ArrowLeft />
          </button>
          <div className="text-center min-w-[280px] md:min-w-[400px]">
            <h2 className="text-5xl md:text-7xl font-black font-festive text-yellow-500 drop-shadow-[0_0_15px_rgba(252,211,77,0.5)] leading-tight">
              {currentPrize?.name}
            </h2>
            <div className="mt-2 inline-block px-6 py-1 glass-dark rounded-full border-yellow-600/30 text-yellow-600/70 font-bold text-sm">
              奖池剩余: <span className="text-yellow-400">{remainingCount}</span> / {currentPrize?.totalCount}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); navigatePrize('next'); }} className="prize-nav-btn p-2">
            <ICONS.ArrowRight />
          </button>
        </div>

        <div className="relative w-full max-w-7xl min-h-[600px] h-[600px]">
          <div className="absolute -inset-2 border-gold-pro opacity-40 rounded-[3rem] pointer-events-none"></div>
          <div className="h-full w-full glass-dark border-gold-pro rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-[0_0_80px_rgba(0,0,0,0.9)] p-8">
            
            <div className="w-full h-full flex items-center justify-center overflow-y-auto scrollbar-hide">
              {isDrawing ? (
                <div className="flex flex-wrap justify-center content-center gap-6 w-full max-w-6xl">
                  {rollingNames.map((name, i) => (
                    <div key={i} className={`relative bg-black/50 rounded-[2.5rem] border-2 border-yellow-500/10 flex flex-col items-center justify-center shadow-inner ${currentConfig.cardSize}`}>
                      <div className="text-yellow-500 leading-tight italic opacity-60 text-center px-4 w-full">
                        {renderSmartName(name, currentConfig.fontSize)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : tempWinners.length > 0 ? (
                <div className="flex flex-wrap justify-center content-center gap-x-8 gap-y-8 w-full max-w-6xl py-6">
                  {tempWinners.map((winner, idx) => (
                    <div key={`${winner.id}-${idx}`} className="relative animate-[zoom-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)] flex justify-center items-center">
                      <div className="absolute -inset-10 bg-yellow-400 opacity-10 blur-[40px] rounded-full"></div>
                      <div className={`relative bg-gradient-to-br from-yellow-50 via-yellow-400 to-yellow-700 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_-4px_10px_rgba(0,0,0,0.2)] border-2 border-yellow-100 flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-2 ${currentConfig.cardSize}`}>
                        <div className="text-red-950 drop-shadow-md text-center px-4 w-full">
                          {renderSmartName(winner.name, currentConfig.fontSize)}
                        </div>
                        {tempWinners.length <= 15 && (
                          <div className="absolute bottom-4 text-red-900/40 text-[8px] font-black tracking-[0.4em] uppercase">Winner</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-10">
                  <GiftBox />
                  <div className="text-yellow-500/20 text-sm font-bold tracking-[2em] ml-[2em] uppercase animate-pulse text-center">Ready For Luck</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-14">
          <div className="flex items-center glass-dark rounded-3xl p-1.5 border-yellow-600/20 shadow-xl">
             <button onClick={(e) => { e.stopPropagation(); handleBatchChange(-1); }} className="w-14 h-14 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-2xl transition-colors font-black text-3xl">-</button>
             <div className="px-8 flex flex-col items-center min-w-[150px]">
                <span className="text-[11px] text-yellow-600/50 font-black uppercase tracking-[0.1em] text-center mb-1">一次抽取人数</span>
                <span className="text-3xl font-black text-yellow-400 leading-none">{currentPrize?.drawBatch || 0}</span>
             </div>
             <button onClick={(e) => { e.stopPropagation(); handleBatchChange(1); }} className="w-14 h-14 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-2xl transition-colors font-black text-3xl">+</button>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); startDraw(); }}
            disabled={!isDrawing && (remainingCount <= 0 || state.participants.length === 0)}
            className={`btn-gold-3d px-24 md:px-32 py-6 md:py-8 rounded-[3rem] text-4xl font-black text-red-950 transition-all ${
              !isDrawing && (remainingCount <= 0 || state.participants.length === 0) ? 'grayscale opacity-50 pointer-events-none' : 'hover:brightness-110 hover:scale-105 active:scale-95'
            }`}
          >
            {isDrawing ? '停止' : '开始'}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); handleShowWinnersInMain(); }}
            className="group flex items-center glass-dark px-10 py-3 rounded-3xl border-yellow-600/20 shadow-xl hover:bg-yellow-500/10 transition-all active:scale-95 text-left"
          >
             <div className="mr-6">
                <div className="text-[11px] text-yellow-600/50 font-black uppercase tracking-[0.1em] mb-1 group-hover:text-yellow-400 transition-colors">已中奖人数</div>
                <div className="text-3xl font-black text-yellow-400 leading-none">{allPrizeWinners.length}</div>
             </div>
             <div className="w-px h-10 bg-yellow-600/20 mr-6"></div>
             <div className="flex flex-col items-center text-yellow-500 group-hover:scale-110 transition-transform">
                <ICONS.Trophy />
                <span className="text-[10px] font-black mt-1 uppercase">中奖名单</span>
             </div>
          </button>
        </div>
      </main>

      {showSettings && (
        <Settings 
          state={state} 
          updateState={setState} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

export default App;
