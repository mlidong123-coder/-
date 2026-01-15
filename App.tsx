
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Prize, Winner, Participant } from './types';
import { DEFAULT_PRIZES, ICONS } from './constants';
import { loadState, saveState, performDraw } from './services/lotteryService';
import Settings from './components/Settings';

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
  const [scrollingPool, setScrollingPool] = useState<string[]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state.participants.length > 0) {
      // 预生成一个打乱的池子用于显示动画
      const pool = [...state.participants].sort(() => Math.random() - 0.5).map(p => p.name);
      setScrollingPool(pool);
    }
  }, [state.participants]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrize = state.prizes.find(p => p.id === currentPrizeId);
  const prizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - prizeWinners.length : 0;

  const startDraw = () => {
    if (isDrawing || !currentPrize || remainingCount <= 0) return;
    
    setIsDrawing(true);
    setTempWinners([]);
    
    if (rollAudioRef.current) {
      rollAudioRef.current.loop = true;
      rollAudioRef.current.play().catch(() => {});
    }

    // 模拟抽奖耗时，增强仪式感
    setTimeout(() => {
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
    }, 2000);
  };

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden bg-center bg-cover">
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 装饰灯笼 */}
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

      {/* 顶栏 */}
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
            <div className="flex items-center gap-2 mt-1">
              <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
              <p className="text-yellow-600 text-xs font-bold uppercase tracking-widest">Company Annual Gala Draw</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="glass-dark px-6 py-2 rounded-2xl border-yellow-600/20">
             <div className="text-[10px] text-yellow-600/70 font-bold uppercase">Participants</div>
             <div className="text-2xl font-black text-yellow-400 leading-none">{state.participants.length} <span className="text-xs">人</span></div>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-4 glass-dark rounded-full text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30"
          >
            <ICONS.Settings />
          </button>
        </div>
      </header>

      {/* 抽奖主区 */}
      <main className="flex-1 flex flex-col items-center justify-center px-10 pb-10 z-10">
        {/* 奖项导航 */}
        <div className="flex gap-4 mb-8">
          {state.prizes.map(p => (
            <button
              key={p.id}
              onClick={() => !isDrawing && setCurrentPrizeId(p.id)}
              className={`px-8 py-2.5 rounded-full font-bold transition-all ${
                currentPrizeId === p.id 
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-red-950 shadow-[0_0_20px_rgba(252,211,77,0.4)] scale-110 border-2 border-yellow-200' 
                : 'bg-red-950/40 text-yellow-600 border border-yellow-900/30 hover:bg-red-900/40'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* 核心展示盒 */}
        <div className="relative w-full max-w-5xl h-[400px]">
          <div className="absolute -inset-4 bg-yellow-500/5 blur-[80px] rounded-full"></div>
          <div className="absolute -inset-1 border-gold-pro opacity-30 rounded-3xl pointer-events-none"></div>
          
          <div className="h-full w-full glass-dark border-gold-pro rounded-3xl overflow-hidden flex flex-col">
            {/* 盒内顶部条 */}
            <div className="h-14 bg-gradient-to-r from-yellow-600/20 via-transparent to-yellow-600/20 flex items-center justify-between px-10 border-b border-yellow-600/10">
               <span className="text-yellow-600 font-bold tracking-widest text-sm">WINNER LIST</span>
               <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-600"></div>
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
               </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
              {isDrawing ? (
                <div className="flex gap-6 w-full h-full">
                  {Array.from({ length: currentPrize?.drawBatch || 1 }).map((_, i) => (
                    <div key={i} className="flex-1 glass-dark rounded-2xl flex items-center justify-center overflow-hidden border border-yellow-500/10">
                      <div className="h-full w-full relative">
                         <div className="animate-scroll absolute inset-0 flex flex-col items-center">
                            {[...scrollingPool, ...scrollingPool].map((name, idx) => (
                              <div key={idx} className="h-full min-h-[150px] flex items-center justify-center text-5xl font-black text-yellow-500/80 italic tracking-tighter">
                                {name}
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : tempWinners.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-10">
                  {tempWinners.map(winner => (
                    <div key={winner.id} className="relative group animate-[zoom-in_0.4s_ease-out]">
                      <div className="absolute -inset-8 bg-yellow-400 opacity-30 blur-3xl rounded-full animate-pulse"></div>
                      <div className="relative bg-gradient-to-b from-yellow-200 to-yellow-600 p-8 rounded-3xl shadow-2xl transform hover:scale-105 transition-transform min-w-[220px] text-center">
                        <div className="text-red-900 text-xs font-black uppercase mb-2 tracking-widest border-b border-red-950/10 pb-2">Lucky Winner</div>
                        <div className="text-red-950 text-7xl font-festive font-black drop-shadow-sm">{winner.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center group">
                  <div className="text-[120px] font-festive text-yellow-600/5 select-none leading-none group-hover:text-yellow-600/10 transition-colors">荣耀之巅</div>
                  <div className="text-yellow-500/40 text-sm font-bold tracking-[1.5em] mt-4 ml-[1.5em]">CLICK START TO DRAW</div>
                </div>
              )}
            </div>
          </div>

          {/* 状态统计 */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-8">
             <div className="glass-dark px-8 py-3 rounded-2xl border-yellow-600/20 flex flex-col items-center">
                <span className="text-[10px] text-yellow-600/50 font-bold">REMAINING</span>
                <span className="text-xl font-black text-yellow-400">{remainingCount} <span className="text-xs">/ {currentPrize?.totalCount}</span></span>
             </div>
             <button 
                onClick={startDraw}
                disabled={isDrawing || remainingCount <= 0}
                className={`btn-gold-3d px-16 py-4 rounded-2xl text-2xl font-black text-red-950 transition-all ${
                  isDrawing || remainingCount <= 0 ? 'grayscale pointer-events-none opacity-50' : 'hover:brightness-110'
                }`}
              >
                {isDrawing ? '揭晓中...' : remainingCount <= 0 ? '已抽完' : '开始抽奖'}
             </button>
             <div className="glass-dark px-8 py-3 rounded-2xl border-yellow-600/20 flex flex-col items-center">
                <span className="text-[10px] text-yellow-600/50 font-bold">BATCH SIZE</span>
                <span className="text-xl font-black text-yellow-400">{currentPrize?.drawBatch} <span className="text-xs">人/抽</span></span>
             </div>
          </div>
        </div>
      </main>

      {/* 实时获奖侧边栏 (模仿 17iu8 的动态显示) */}
      <aside className="fixed right-6 top-32 w-64 z-20">
         <div className="glass-dark rounded-3xl p-5 border-yellow-600/20 max-h-[60vh] flex flex-col shadow-2xl">
            <h3 className="text-yellow-500 font-bold mb-4 flex items-center justify-between border-b border-yellow-600/10 pb-2">
               <span className="flex items-center gap-2 text-sm"><ICONS.Trophy /> 获奖金榜</span>
               <span className="text-[10px] bg-yellow-600/20 px-2 py-0.5 rounded-full text-yellow-300">{state.winners.length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
               {[...state.winners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group hover:bg-yellow-500/10 transition-colors animate-[slide-in-right_0.3s_ease-out]">
                     <div className="w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center text-yellow-400 font-bold border border-yellow-600/20">
                        {w.participantName.charAt(0)}
                     </div>
                     <div>
                        <div className="font-bold text-yellow-100 text-sm">{w.participantName}</div>
                        <div className="text-[10px] text-yellow-600">{w.prizeName}</div>
                     </div>
                  </div>
               ))}
               {state.winners.length === 0 && (
                 <div className="text-center py-20 text-white/10 text-xs italic">虚位以待...</div>
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
