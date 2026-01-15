
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
  const [showWinnersList, setShowWinnersList] = useState(false);
  const [tempWinners, setTempWinners] = useState<Participant[]>([]);
  const [rollingNames, setRollingNames] = useState<string[]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const rollingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrizeIndex = state.prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = state.prizes[currentPrizeIndex];
  const allPrizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - allPrizeWinners.length : 0;

  const navigatePrize = (dir: 'prev' | 'next') => {
    if (isDrawing) return;
    const count = state.prizes.length;
    let newIndex = dir === 'prev' ? currentPrizeIndex - 1 : currentPrizeIndex + 1;
    if (newIndex < 0) newIndex = count - 1;
    if (newIndex >= count) newIndex = 0;
    setCurrentPrizeId(state.prizes[newIndex].id);
    setTempWinners([]);
    setRollingNames([]);
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

    // 开启名字无序循环滚动
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
      if (rollAudioRef.current) rollAudioRef.current.pause();
      return;
    }

    setTempWinners(result.winners);
    setRollingNames([]);
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

  // 动态计算样式配置
  const getDisplayConfig = (count: number) => {
    if (count <= 1) return { fontSize: 'text-9xl', cardSize: 'w-[450px] h-[260px]' };
    if (count <= 4) return { fontSize: 'text-7xl', cardSize: 'w-[300px] h-[180px]' };
    if (count <= 10) return { fontSize: 'text-5xl', cardSize: 'w-[200px] h-[130px]' };
    return { fontSize: 'text-4xl', cardSize: 'w-[180px] h-[110px]' };
  };

  const currentConfig = getDisplayConfig(isDrawing ? rollingNames.length : tempWinners.length);

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden">
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      <header className="px-10 py-6 flex justify-end items-center z-20">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-4 glass-dark rounded-full text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30 shadow-lg"
        >
          <ICONS.Settings />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-10 pb-10 z-10 relative">
        
        <div className="mb-6 flex items-center justify-center gap-6 md:gap-12">
          <button onClick={() => navigatePrize('prev')} className="prize-nav-btn p-2">
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
          <button onClick={() => navigatePrize('next')} className="prize-nav-btn p-2">
            <ICONS.ArrowRight />
          </button>
        </div>

        <div className="relative w-full max-w-6xl min-h-[580px] h-[580px]">
          <div className="absolute -inset-1.5 border-gold-pro opacity-50 rounded-[2.5rem] pointer-events-none"></div>
          <div className="h-full w-full glass-dark border-gold-pro rounded-[2.5rem] overflow-hidden flex items-center justify-center relative shadow-2xl">
            
            {isDrawing ? (
              // 抽奖开始：名字按名单列表无序循环滚动显示
              <div className="w-full h-full flex items-center justify-center p-8 overflow-y-auto scrollbar-hide">
                <div className="flex flex-wrap justify-center content-center gap-8 max-w-full">
                  {rollingNames.map((name, i) => (
                    <div key={i} className="relative flex justify-center items-center">
                      <div className={`relative bg-black/40 rounded-[2.5rem] border-2 border-yellow-500/20 flex flex-col items-center justify-center ${currentConfig.cardSize}`}>
                        <div className={`text-yellow-500 font-festive font-black leading-none italic opacity-80 ${currentConfig.fontSize}`}>
                          {name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : tempWinners.length > 0 ? (
              // 抽奖停止：中奖区域一行最多5个平均分布，横向纵向居中
              <div className="w-full h-full flex items-center justify-center p-8 overflow-y-auto scrollbar-hide">
                <div className="flex flex-wrap justify-center content-center gap-8 max-w-full">
                  {tempWinners.map(winner => (
                    <div key={winner.id} className="relative animate-[zoom-in_0.5s_ease-out] flex justify-center items-center">
                      <div className="absolute -inset-10 bg-yellow-400 opacity-20 blur-[50px] rounded-full"></div>
                      <div className={`relative bg-gradient-to-b from-yellow-50 via-yellow-400 to-yellow-600 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-4 border-yellow-100 flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 ${currentConfig.cardSize}`}>
                        <div className={`text-red-950 font-festive font-black leading-none drop-shadow-xl text-center px-4 ${currentConfig.fontSize}`}>
                          {winner.name}
                        </div>
                        {tempWinners.length <= 15 && (
                          <div className="mt-3 text-red-900 text-[10px] font-black tracking-[0.4em] uppercase opacity-70">Lucky Winner</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-10">
                <GiftBox />
                <div className="text-yellow-500/20 text-sm font-bold tracking-[1.8em] ml-[1.8em] uppercase animate-pulse text-center">Ready to draw</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          <div className="flex items-center glass-dark rounded-2xl p-1 border-yellow-600/20">
             <button onClick={() => handleBatchChange(-1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">-</button>
             <div className="px-6 flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] text-yellow-600/50 font-bold uppercase tracking-widest text-center">每次抽取</span>
                <span className="text-2xl font-black text-yellow-400">{currentPrize?.drawBatch || 0} <span className="text-xs">人</span></span>
             </div>
             <button onClick={() => handleBatchChange(1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">+</button>
          </div>

          <button 
            onClick={startDraw}
            disabled={!isDrawing && (remainingCount <= 0 || state.participants.length === 0)}
            className={`btn-gold-3d px-20 md:px-28 py-5 md:py-7 rounded-[2.5rem] text-4xl font-black text-red-950 transition-all ${
              !isDrawing && (remainingCount <= 0 || state.participants.length === 0) ? 'grayscale pointer-events-none opacity-50' : 'hover:brightness-110 hover:scale-105 active:scale-95'
            }`}
          >
            {isDrawing ? '停止' : '开始'}
          </button>

          <div className="flex items-center gap-4">
             <div className="glass-dark px-6 py-2 rounded-2xl border-yellow-600/20 text-center min-w-[120px]">
                <div className="text-[10px] text-yellow-600/50 font-bold uppercase tracking-widest">已产生</div>
                <div className="text-2xl font-black text-yellow-400">{allPrizeWinners.length} <span className="text-xs">人</span></div>
             </div>
             <button 
                onClick={() => setShowWinnersList(!showWinnersList)}
                className="glass-dark p-4 rounded-2xl text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30 flex items-center gap-2 font-bold shadow-lg"
              >
                <ICONS.Trophy />
                <span className="text-sm">中奖名单</span>
             </button>
          </div>
        </div>
      </main>

      <aside className={`fixed right-6 top-32 w-80 z-40 transition-all duration-500 transform ${showWinnersList ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
         <div className="glass-dark rounded-[2.5rem] p-7 border-yellow-600/30 max-h-[70vh] flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-6 border-b border-yellow-600/10 pb-4">
               <h3 className="text-yellow-500 font-bold flex flex-col">
                 <span className="text-[10px] text-yellow-600/50 uppercase font-black tracking-widest">{currentPrize?.name}</span>
                 <span className="flex items-center gap-2 italic text-xl"><ICONS.Trophy /> 获奖名单</span>
               </h3>
               <button onClick={() => setShowWinnersList(false)} className="text-yellow-600 hover:text-yellow-400 transition-colors">
                 <ICONS.Back />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
               {[...allPrizeWinners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center gap-4 p-3.5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-yellow-500/10 transition-colors">
                     <div className="w-11 h-11 bg-yellow-600/20 rounded-full flex items-center justify-center text-yellow-400 font-bold border border-yellow-600/20">
                        {w.participantName.charAt(0)}
                     </div>
                     <div className="flex-1">
                        <div className="font-bold text-yellow-100 text-base">{w.participantName}</div>
                        <div className="text-[10px] text-yellow-600 flex justify-between mt-1">
                           <span className="font-bold uppercase tracking-wider">Glorious Entry</span>
                           <span className="opacity-40 tabular-nums">{new Date(w.drawTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                     </div>
                  </div>
               ))}
               {allPrizeWinners.length === 0 && (
                 <div className="text-center py-20 text-white/5 text-xs italic">尚未揭晓，敬请期待</div>
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
