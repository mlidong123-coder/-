
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Prize, Winner, Participant } from './types';
import { DEFAULT_PRIZES, ICONS } from './constants';
import { loadState, saveState, performDraw } from './services/lotteryService';
import Settings from './components/Settings';

const GiftBox: React.FC = () => (
  <div className="relative w-48 h-48 animate-box-shake">
    {/* 礼物盒主体 */}
    <div className="absolute inset-0 bg-red-600 rounded-lg shadow-2xl border-2 border-red-700"></div>
    {/* 黄色丝带 - 横向 */}
    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-8 bg-yellow-400 shadow-md"></div>
    {/* 黄色丝带 - 纵向 */}
    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 bg-yellow-400 shadow-md"></div>
    {/* 顶部的蝴蝶结 */}
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
      <div className="w-12 h-12 border-4 border-yellow-400 rounded-full rotate-45"></div>
      <div className="w-12 h-12 border-4 border-yellow-400 rounded-full -rotate-45"></div>
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
  const [scrollingPool, setScrollingPool] = useState<string[]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state.participants.length > 0) {
      const pool = [...state.participants].sort(() => Math.random() - 0.5).map(p => p.name);
      setScrollingPool(pool);
    }
  }, [state.participants]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrizeIndex = state.prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = state.prizes[currentPrizeIndex];
  const prizeWinners = state.winners.filter(w => w.prizeId === currentPrizeId);
  const remainingCount = currentPrize ? currentPrize.totalCount - prizeWinners.length : 0;

  const navigatePrize = (dir: 'prev' | 'next') => {
    if (isDrawing) return;
    const count = state.prizes.length;
    let newIndex = dir === 'prev' ? currentPrizeIndex - 1 : currentPrizeIndex + 1;
    if (newIndex < 0) newIndex = count - 1;
    if (newIndex >= count) newIndex = 0;
    setCurrentPrizeId(state.prizes[newIndex].id);
    setTempWinners([]); // 切换奖项时清除之前的展示
  };

  const startDraw = () => {
    if (isDrawing) {
      // 停止逻辑
      handleStop();
      return;
    }
    if (!currentPrize || remainingCount <= 0) return;
    
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

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden">
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 装饰 */}
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
            <p className="text-yellow-600 text-xs font-bold tracking-widest">ANNUAL GALA PRIZE DRAW</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-4 glass-dark rounded-full text-yellow-500 hover:bg-yellow-500 hover:text-red-950 transition-all border-yellow-600/30"
        >
          <ICONS.Settings />
        </button>
      </header>

      {/* 抽奖主区 */}
      <main className="flex-1 flex flex-col items-center justify-center px-10 pb-10 z-10 relative">
        
        {/* 左右箭头切换奖项 */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2 z-30">
          <button 
            onClick={() => navigatePrize('prev')}
            className="text-white/30 hover:text-yellow-500 transition-colors p-4"
          >
            <ICONS.ArrowLeft />
          </button>
        </div>
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-30">
          <button 
            onClick={() => navigatePrize('next')}
            className="text-white/30 hover:text-yellow-500 transition-colors p-4"
          >
            <ICONS.ArrowRight />
          </button>
        </div>

        {/* 奖项名称展示 */}
        <div className="mb-10 text-center">
          <h2 className="text-6xl font-black font-festive text-yellow-500 drop-shadow-lg animate-pulse">
            {currentPrize?.name}
          </h2>
          <div className="mt-4 px-6 py-2 glass-dark rounded-full border-yellow-600/30 text-yellow-600/70 font-bold">
            剩余: <span className="text-yellow-400">{remainingCount}</span> / {currentPrize?.totalCount}
          </div>
        </div>

        {/* 核心展示区 */}
        <div className="relative w-full max-w-5xl h-[450px]">
          <div className="absolute -inset-1 border-gold-pro opacity-40 rounded-3xl pointer-events-none"></div>
          <div className="h-full w-full glass-dark border-gold-pro rounded-3xl overflow-hidden flex items-center justify-center relative">
            
            {isDrawing ? (
              // 5x5 滚动网格
              <div className="grid grid-cols-5 gap-4 w-full h-full p-8">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className="flex-1 glass-dark rounded-xl flex items-center justify-center overflow-hidden border border-yellow-500/5">
                    <div className="h-full w-full relative">
                      <div 
                        className="animate-grid-scroll absolute inset-0 flex flex-col items-center"
                        style={{ animationDuration: `${0.2 + (i % 5) * 0.05}s` }}
                      >
                        {[...scrollingPool, ...scrollingPool].map((name, idx) => (
                          <div key={idx} className="h-20 min-h-[80px] flex items-center justify-center text-xl font-black text-yellow-500/30 italic">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tempWinners.length > 0 ? (
              // 中奖结果显示
              <div className="flex flex-wrap items-center justify-center gap-8 p-10">
                {tempWinners.map(winner => (
                  <div key={winner.id} className="relative group animate-[zoom-in_0.4s_ease-out]">
                    <div className="absolute -inset-8 bg-yellow-400 opacity-20 blur-3xl rounded-full"></div>
                    <div className="relative bg-gradient-to-b from-yellow-200 to-yellow-600 p-8 rounded-3xl shadow-2xl transform hover:scale-105 transition-transform min-w-[200px] text-center border-4 border-yellow-100">
                      <div className="text-red-950 text-6xl font-festive font-black drop-shadow-md">{winner.name}</div>
                      <div className="mt-2 text-red-900 text-xs font-bold tracking-widest">幸运中奖者</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // 初始礼物盒状态
              <div className="flex flex-col items-center gap-6">
                <GiftBox />
                <div className="text-yellow-500/30 text-sm font-bold tracking-[1em] mt-4 ml-[1em] uppercase">准备开启好运</div>
              </div>
            )}
          </div>
        </div>

        {/* 抽奖按钮 */}
        <div className="mt-14">
           <button 
              onClick={startDraw}
              disabled={!isDrawing && (remainingCount <= 0 || scrollingPool.length === 0)}
              className={`btn-gold-3d px-20 py-5 rounded-2xl text-3xl font-black text-red-950 transition-all ${
                !isDrawing && remainingCount <= 0 ? 'grayscale pointer-events-none opacity-50' : 'hover:brightness-110'
              }`}
            >
              {isDrawing ? '停止' : remainingCount <= 0 ? '已抽完' : '开始抽奖'}
           </button>
        </div>
      </main>

      {/* 实时获奖列表 */}
      <aside className="fixed right-6 top-32 w-64 z-20">
         <div className="glass-dark rounded-3xl p-5 border-yellow-600/20 max-h-[60vh] flex flex-col shadow-2xl">
            <h3 className="text-yellow-500 font-bold mb-4 flex items-center justify-between border-b border-yellow-600/10 pb-2">
               <span className="flex items-center gap-2 text-sm"><ICONS.Trophy /> 获奖金榜</span>
               <span className="text-[10px] bg-yellow-600/20 px-2 py-0.5 rounded-full text-yellow-300">{state.winners.length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
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
