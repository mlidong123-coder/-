
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
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const rollingIntervalRef = useRef<number | null>(null);

  // Define derived variables to resolve "Cannot find name" errors
  const currentPrizeIndex = state.prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = state.prizes[currentPrizeIndex];
  const allPrizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - state.winners.filter(w => w.prizeId === currentPrizeId).length : 0;

  useEffect(() => {
    saveState(state);
  }, [state]);

  // 核心音效控制逻辑
  useEffect(() => {
    if (!isAudioInitialized) return;

    if (isDrawing) {
      // 开始抽奖：暂停BGM，播放劲爆抽奖乐
      bgMusicRef.current?.pause();
      if (rollAudioRef.current) {
        rollAudioRef.current.currentTime = 0;
        rollAudioRef.current.loop = true;
        rollAudioRef.current.play().catch(() => {});
      }
    } else {
      // 停止抽奖：由 handleStop 处理特定音效切换逻辑
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
    initAudio(); // 确保用户点击后音频初始化
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

    // 音效切换逻辑
    rollAudioRef.current?.pause();
    if (winAudioRef.current) {
      winAudioRef.current.currentTime = 0;
      winAudioRef.current.play().catch(() => {});
      
      // 中奖音效持续约3秒后，切回BGM
      setTimeout(() => {
        if (!isDrawing) {
          bgMusicRef.current?.play().catch(() => {});
        }
      }, 3000);
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

  /**
   * 智能分行渲染逻辑
   * 1. 优先寻找符号 [ , -, (, /, _, 空格]
   * 2. 无符号则超过3个字换行
   */
  const renderSmartName = (name: string, baseFontSize: string) => {
    const symbols = /[ \-\(\)\[\]\/_]/;
    const match = name.match(symbols);
    
    let line1 = name;
    let line2 = "";

    if (match && match.index !== undefined) {
      line1 = name.substring(0, match.index);
      line2 = name.substring(match.index); // 保留符号在第二行
    } else if (name.length > 3) {
      line1 = name.substring(0, 3);
      line2 = name.substring(3);
    }

    if (!line2) return <span className={baseFontSize}>{line1}</span>;

    // 字号缩放映射
    const subSizeMap: Record<string, string> = {
      'text-9xl': 'text-5xl',
      'text-7xl': 'text-4xl',
      'text-5xl': 'text-2xl',
      'text-4xl': 'text-xl',
    };
    const mainSizeMap: Record<string, string> = {
      'text-9xl': 'text-8xl',
      'text-7xl': 'text-6xl',
      'text-5xl': 'text-4xl',
      'text-4xl': 'text-3xl',
    };

    const mainClass = mainSizeMap[baseFontSize] || baseFontSize;
    const subClass = subSizeMap[baseFontSize] || 'text-sm';

    return (
      <div className="flex flex-col items-center justify-center leading-tight py-2">
        <span className={`${mainClass} font-black tracking-tight`}>{line1}</span>
        <span className={`${subClass} font-bold opacity-80 mt-1 italic`}>{line2}</span>
      </div>
    );
  };

  const getDisplayConfig = (count: number) => {
    if (count <= 1) return { fontSize: 'text-9xl', cardSize: 'w-[480px] h-[320px]' };
    if (count <= 4) return { fontSize: 'text-7xl', cardSize: 'w-[320px] h-[220px]' };
    if (count <= 10) return { fontSize: 'text-5xl', cardSize: 'w-[230px] h-[160px]' };
    return { fontSize: 'text-4xl', cardSize: 'w-[200px] h-[140px]' };
  };

  const currentConfig = getDisplayConfig(isDrawing ? rollingNames.length : tempWinners.length);

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden" onClick={initAudio}>
      {/* 劲爆音频源 - 全部采用纯音乐库 */}
      <audio ref={bgMusicRef} src="https://assets.mixkit.co/music/preview/mixkit-techno-vibe-147.mp3" loop />
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/music/preview/mixkit-glitchy-drum-and-bass-113.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3" />

      <header className="px-10 py-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
           <div className={`w-3 h-3 rounded-full ${isAudioInitialized ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
           <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Audio Link {isAudioInitialized ? 'Live' : 'Standby'}</span>
        </div>
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
          <div className="h-full w-full glass-dark border-gold-pro rounded-[3rem] overflow-hidden flex items-center justify-center relative shadow-[0_0_80px_rgba(0,0,0,0.9)]">
            
            {isDrawing ? (
              // 抽奖过程
              <div className="w-full h-full flex items-center justify-center p-10 overflow-y-auto scrollbar-hide">
                <div className="flex flex-wrap justify-center content-center gap-8 max-w-full">
                  {rollingNames.map((name, i) => (
                    <div key={i} className="relative flex justify-center items-center">
                      <div className={`relative bg-black/50 rounded-[2.5rem] border-2 border-yellow-500/10 flex flex-col items-center justify-center shadow-inner ${currentConfig.cardSize}`}>
                        <div className="text-yellow-500 font-festive leading-tight italic opacity-60 text-center px-4 w-full">
                          {renderSmartName(name, currentConfig.fontSize)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : tempWinners.length > 0 ? (
              // 抽奖结果：一行最多5个，平均分布
              <div className="w-full h-full flex items-center justify-center p-10 overflow-y-auto scrollbar-hide">
                <div className="flex flex-wrap justify-center content-center gap-x-10 gap-y-12 max-w-full">
                  {tempWinners.map(winner => (
                    <div key={winner.id} className="relative animate-[zoom-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)] flex justify-center items-center">
                      <div className="absolute -inset-12 bg-yellow-400 opacity-20 blur-[60px] rounded-full"></div>
                      <div className={`relative bg-gradient-to-br from-yellow-50 via-yellow-400 to-yellow-700 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.8),inset_0_-8px_20px_rgba(0,0,0,0.2)] border-4 border-yellow-100 flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-2 ${currentConfig.cardSize}`}>
                        <div className="text-red-950 font-festive drop-shadow-lg text-center px-6 w-full">
                          {renderSmartName(winner.name, currentConfig.fontSize)}
                        </div>
                        {tempWinners.length <= 10 && (
                          <div className="absolute bottom-6 text-red-900/50 text-[9px] font-black tracking-[0.5em] uppercase">Champion</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // 待机状态
              <div className="flex flex-col items-center gap-10">
                <GiftBox />
                <div className="text-yellow-500/20 text-sm font-bold tracking-[2em] ml-[2em] uppercase animate-pulse text-center">Ready For Luck</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-14">
          <div className="flex items-center glass-dark rounded-3xl p-1.5 border-yellow-600/20 shadow-xl">
             <button onClick={(e) => { e.stopPropagation(); handleBatchChange(-1); }} className="w-14 h-14 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-2xl transition-colors font-black text-3xl">-</button>
             <div className="px-8 flex flex-col items-center min-w-[120px]">
                <span className="text-[11px] text-yellow-600/50 font-black uppercase tracking-[0.3em] text-center mb-1">Batch</span>
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

          <div className="flex items-center gap-5">
             <div className="glass-dark px-8 py-3 rounded-3xl border-yellow-600/20 text-center min-w-[140px] shadow-xl">
                <div className="text-[11px] text-yellow-600/50 font-black uppercase tracking-[0.3em] mb-1">Winners</div>
                <div className="text-3xl font-black text-yellow-400 leading-none">{allPrizeWinners.length}</div>
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); initAudio(); setShowWinnersList(!showWinnersList); }}
                className="glass-dark p-5 rounded-3xl text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30 flex items-center gap-3 font-black shadow-2xl"
              >
                <ICONS.Trophy />
                <span className="text-sm tracking-widest uppercase">List</span>
             </button>
          </div>
        </div>
      </main>

      {/* 侧边中奖名单 */}
      <aside className={`fixed right-8 top-32 w-80 z-40 transition-all duration-700 cubic-bezier(0.23, 1, 0.32, 1) transform ${showWinnersList ? 'translate-x-0 opacity-100' : 'translate-x-[150%] opacity-0'}`}>
         <div className="glass-dark rounded-[3rem] p-8 border-yellow-600/30 max-h-[75vh] flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between mb-8 border-b border-yellow-600/10 pb-5">
               <h3 className="text-yellow-500 font-bold flex flex-col">
                 <span className="text-[10px] text-yellow-600/50 uppercase font-black tracking-[0.5em] mb-1">{currentPrize?.name}</span>
                 <span className="flex items-center gap-3 italic text-2xl font-festive"><ICONS.Trophy /> 龙虎榜</span>
               </h3>
               <button onClick={(e) => { e.stopPropagation(); setShowWinnersList(false); }} className="text-yellow-600 hover:text-yellow-400 transition-colors">
                 <ICONS.Back />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pr-2">
               {[...allPrizeWinners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-yellow-500/10 transition-all duration-300">
                     <div className="w-12 h-12 bg-yellow-600/20 rounded-full flex items-center justify-center text-yellow-400 font-black border border-yellow-600/20 text-xl font-festive">
                        {w.participantName.charAt(0)}
                     </div>
                     <div className="flex-1">
                        <div className="font-black text-yellow-100 text-lg leading-none">{w.participantName}</div>
                        <div className="text-[9px] text-yellow-600/60 flex justify-between mt-2 font-black uppercase tracking-widest">
                           <span>Lucky Winner</span>
                           <span className="tabular-nums">{new Date(w.drawTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                     </div>
                  </div>
               ))}
               {allPrizeWinners.length === 0 && (
                 <div className="text-center py-24 text-white/5 text-xs italic uppercase tracking-[1em]">Empty</div>
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
