
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [showWinnersList, setShowWinnersList] = useState(false);
  const [tempWinners, setTempWinners] = useState<Participant[]>([]);
  
  const [gridPools, setGridPools] = useState<string[][]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state.participants.length > 0) {
      const newPools = Array.from({ length: 25 }).map(() => 
        [...state.participants].sort(() => Math.random() - 0.5).map(p => p.name)
      );
      setGridPools(newPools);
    }
  }, [state.participants]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrizeIndex = state.prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = state.prizes[currentPrizeIndex];
  const allPrizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - allPrizeWinners.length : 0;

  const getScrollSpeed = (index: number) => {
    const base = 0.25;
    const offset = (index % 5) * 0.04;
    return `${base + offset}s`;
  };

  const navigatePrize = (dir: 'prev' | 'next') => {
    if (isDrawing) return;
    const count = state.prizes.length;
    let newIndex = dir === 'prev' ? currentPrizeIndex - 1 : currentPrizeIndex + 1;
    if (newIndex < 0) newIndex = count - 1;
    if (newIndex >= count) newIndex = 0;
    setCurrentPrizeId(state.prizes[newIndex].id);
    setTempWinners([]);
    setShowWinnersList(false);
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
    if (isDrawing) {
      handleStop();
      return;
    }
    if (!currentPrize || remainingCount <= 0 || state.participants.length === 0) return;
    
    setIsDrawing(true);
    setTempWinners([]);
    
    if (rollAudioRef.current) {
      rollAudioRef.current.loop = true;
      rollAudioRef.current.play().catch(() => {});
    }
  };

  const handleStop = () => {
    const result = performDraw(state, currentPrizeId);
    if (result.error) {
      alert(result.error);
      setIsDrawing(false);
      if (rollAudioRef.current) rollAudioRef.current.pause();
      return;
    }

    setTempWinners(result.winners);
    setIsDrawing(false);
    
    if (rollAudioRef.current) {
      rollAudioRef.current.pause();
      rollAudioRef.current.currentTime = 0;
    }
    if (winAudioRef.current) {
      winAudioRef.current.play().catch(() => {});
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

  // 动态计算结果展示的网格布局
  const getResultsGridConfig = () => {
    const count = tempWinners.length;
    if (count <= 1) return { cols: 'grid-cols-1', padding: 'p-10', fontSize: 'text-9xl', cardSize: 'min-w-[320px] py-16' };
    if (count <= 4) return { cols: 'grid-cols-2', padding: 'p-8', fontSize: 'text-7xl', cardSize: 'min-w-[240px] py-12' };
    if (count <= 9) return { cols: 'grid-cols-3', padding: 'p-6', fontSize: 'text-5xl', cardSize: 'min-w-[180px] py-8' };
    if (count <= 15) return { cols: 'grid-cols-5', padding: 'p-4', fontSize: 'text-3xl', cardSize: 'min-w-[140px] py-4' };
    return { cols: 'grid-cols-6', padding: 'p-2', fontSize: 'text-2xl', cardSize: 'min-w-[120px] py-3' };
  };

  const gridConfig = getResultsGridConfig();

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden">
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 背景装饰 */}
      <div className="absolute top-0 left-20 lantern-box hidden lg:block">
        <div className="w-16 h-24 bg-red-700 border-2 border-yellow-500 rounded-lg shadow-2xl flex items-center justify-center">
          <span className="text-yellow-400 font-festive text-xl">福</span>
        </div>
      </div>
      <div className="absolute top-0 right-20 lantern-box hidden lg:block" style={{animationDelay: '1s'}}>
        <div className="w-16 h-24 bg-red-700 border-2 border-yellow-500 rounded-lg shadow-2xl flex items-center justify-center">
          <span className="text-yellow-400 font-festive text-xl">瑞</span>
        </div>
      </div>

      <header className="px-10 py-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-gradient-to-b from-yellow-300 to-yellow-600 rounded-full border-4 border-yellow-100 shadow-xl">
            <div className="w-12 h-12 bg-red-900 rounded-full flex items-center justify-center text-yellow-300">
               <ICONS.Trophy />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black font-festive text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg tracking-widest">
              2025 辉煌盛典
            </h1>
            <p className="text-yellow-600/60 text-[10px] font-bold tracking-[0.3em] uppercase">Annual Gala Prize Draw</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-4 glass-dark rounded-full text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30"
        >
          <ICONS.Settings />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-10 pb-10 z-10 relative">
        
        {/* 奖项切换 */}
        <div className="mb-6 flex items-center justify-center gap-12">
          <button onClick={() => navigatePrize('prev')} className="prize-nav-btn">
            <ICONS.ArrowLeft />
          </button>
          <div className="text-center min-w-[300px]">
            <h2 className="text-7xl font-black font-festive text-yellow-500 drop-shadow-[0_0_15px_rgba(252,211,77,0.5)]">
              {currentPrize?.name}
            </h2>
            <div className="mt-4 inline-block px-6 py-2 glass-dark rounded-full border-yellow-600/30 text-yellow-600/70 font-bold text-sm">
              奖池剩余: <span className="text-yellow-400">{remainingCount}</span> / {currentPrize?.totalCount}
            </div>
          </div>
          <button onClick={() => navigatePrize('next')} className="prize-nav-btn">
            <ICONS.ArrowRight />
          </button>
        </div>

        {/* 抽奖网格/展示区 */}
        <div className="relative w-full max-w-6xl h-[560px]">
          <div className="absolute -inset-1.5 border-gold-pro opacity-50 rounded-[2.5rem] pointer-events-none"></div>
          <div className="h-full w-full glass-dark border-gold-pro rounded-[2.5rem] overflow-hidden flex items-center justify-center relative">
            
            {isDrawing ? (
              <div className="grid grid-cols-5 gap-3 w-full h-full p-8">
                {gridPools.map((pool, i) => (
                  <div key={i} className="flex-1 glass-dark rounded-2xl flex items-center justify-center overflow-hidden border border-yellow-500/10">
                    <div className="h-full w-full relative">
                      <div 
                        className="animate-grid-scroll absolute inset-0 flex flex-col items-center"
                        style={{ '--scroll-speed': getScrollSpeed(i) } as any}
                      >
                        {[...pool, ...pool].map((name, idx) => (
                          <div key={idx} className="h-24 min-h-[96px] flex items-center justify-center text-4xl font-black text-yellow-500/30 italic drop-shadow-sm">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tempWinners.length > 0 ? (
              <div className={`grid gap-4 ${gridConfig.cols} ${gridConfig.padding} w-full h-full content-center justify-center overflow-y-auto scrollbar-hide`}>
                {tempWinners.map(winner => (
                  <div key={winner.id} className="relative group animate-[zoom-in_0.35s_ease-out] flex justify-center">
                    <div className="absolute -inset-4 bg-yellow-400 opacity-20 blur-[30px] rounded-full"></div>
                    <div className={`relative bg-gradient-to-b from-yellow-50 via-yellow-400 to-yellow-600 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] border-2 border-yellow-100 flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 ${gridConfig.cardSize}`}>
                      <div className={`text-red-950 font-festive font-black leading-none drop-shadow-md ${gridConfig.fontSize}`}>
                        {winner.name}
                      </div>
                      {tempWinners.length <= 15 && (
                        <div className="mt-1 text-red-900 text-[9px] font-black tracking-widest uppercase opacity-60">Lucky Winner</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8">
                <GiftBox />
                <div className="text-yellow-500/20 text-sm font-bold tracking-[1.5em] ml-[1.5em] uppercase animate-pulse">Ready to open</div>
              </div>
            )}
          </div>
        </div>

        {/* 控制区 */}
        <div className="mt-10 flex items-center justify-center gap-10">
          
          <div className="flex items-center glass-dark rounded-2xl p-1 border-yellow-600/20">
             <button onClick={() => handleBatchChange(-1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">-</button>
             <div className="px-6 flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] text-yellow-600/50 font-bold uppercase">每次抽取</span>
                <span className="text-2xl font-black text-yellow-400">{currentPrize?.drawBatch || 0} <span className="text-xs">人</span></span>
             </div>
             <button onClick={() => handleBatchChange(1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">+</button>
          </div>

          <button 
            onClick={startDraw}
            disabled={!isDrawing && (remainingCount <= 0 || state.participants.length === 0)}
            className={`btn-gold-3d px-24 py-6 rounded-[2rem] text-3xl font-black text-red-950 transition-all ${
              !isDrawing && remainingCount <= 0 ? 'grayscale pointer-events-none opacity-50' : 'hover:brightness-110'
            }`}
          >
            {isDrawing ? '停止' : '开始'}
          </button>

          <div className="flex items-center gap-4">
             <div className="glass-dark px-6 py-2 rounded-2xl border-yellow-600/20 text-center min-w-[120px]">
                <div className="text-[10px] text-yellow-600/50 font-bold uppercase">已产生</div>
                <div className="text-2xl font-black text-yellow-400">{allPrizeWinners.length} <span className="text-xs">人</span></div>
             </div>
             <button 
                onClick={() => setShowWinnersList(!showWinnersList)}
                className="glass-dark p-4 rounded-2xl text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30 flex items-center gap-2 font-bold"
              >
                <ICONS.Trophy />
                <span className="text-sm">中奖名单</span>
             </button>
          </div>
        </div>
      </main>

      {/* 当前奖项名单抽屉 */}
      <aside className={`fixed right-6 top-32 w-72 z-40 transition-all duration-500 transform ${showWinnersList ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
         <div className="glass-dark rounded-[2rem] p-6 border-yellow-600/30 max-h-[65vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-yellow-600/10 pb-4">
               <h3 className="text-yellow-500 font-bold flex flex-col">
                 <span className="text-xs text-yellow-600/50 uppercase font-black tracking-widest">{currentPrize?.name}</span>
                 <span className="flex items-center gap-2 italic"><ICONS.Trophy /> 获奖名单</span>
               </h3>
               <button onClick={() => setShowWinnersList(false)} className="text-yellow-600 hover:text-yellow-400">
                 <ICONS.Back />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
               {[...allPrizeWinners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group hover:bg-yellow-500/10 transition-colors animate-[slide-in-right_0.2s_ease-out]">
                     <div className="w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center text-yellow-400 font-bold border border-yellow-600/20">
                        {w.participantName.charAt(0)}
                     </div>
                     <div className="flex-1">
                        <div className="font-bold text-yellow-100 text-sm">{w.participantName}</div>
                        <div className="text-[10px] text-yellow-600 flex justify-between">
                           <span>荣耀入选</span>
                           <span className="opacity-40">{new Date(w.drawTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                     </div>
                  </div>
               ))}
               {allPrizeWinners.length === 0 && (
                 <div className="text-center py-20 text-white/5 text-xs italic">尚未揭晓...</div>
               )}
            </div>
         </div>
      </aside>

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
