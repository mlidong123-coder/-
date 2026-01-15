
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
  
  // 5x5 网格的滚动池
  const [gridPools, setGridPools] = useState<string[][]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化滚动名单池，确保每个格子都有足够的长序列进行循环滚动
  useEffect(() => {
    if (state.participants.length > 0) {
      const allNames = state.participants.map(p => p.name);
      const newPools = Array.from({ length: 25 }).map(() => {
        // 每个格子生成一个打乱的完整名单，并重复以防滚动过快看到空白
        let shuffled = [...allNames].sort(() => Math.random() - 0.5);
        // 如果名单太短，重复几次以增加视觉连续性
        while (shuffled.length < 20) {
          shuffled = [...shuffled, ...shuffled];
        }
        return shuffled;
      });
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
    // 基础速度 + 随机偏移，让 25 个格子看起来参差不齐
    const base = 0.2;
    const offset = (index % 7) * 0.05;
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

  // 获取结果网格配置：固定每排最多 5 个，根据数量调整大小
  const getResultsGridConfig = () => {
    const count = tempWinners.length;
    if (count <= 1) return { fontSize: 'text-9xl', cardSize: 'w-[400px] h-[240px]', padding: 'p-10' };
    if (count <= 4) return { fontSize: 'text-7xl', cardSize: 'w-[280px] h-[180px]', padding: 'p-8' };
    if (count <= 10) return { fontSize: 'text-5xl', cardSize: 'w-[180px] h-[120px]', padding: 'p-6' };
    return { fontSize: 'text-3xl', cardSize: 'w-[150px] h-[90px]', padding: 'p-4' };
  };

  const gridConfig = getResultsGridConfig();

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden">
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 装饰挂饰 */}
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
        
        {/* 奖项标题与左右切换 */}
        <div className="mb-6 flex items-center justify-center gap-8">
          <button onClick={() => navigatePrize('prev')} className="prize-nav-btn p-2">
            <ICONS.ArrowLeft />
          </button>
          <div className="text-center min-w-[340px]">
            <h2 className="text-7xl font-black font-festive text-yellow-500 drop-shadow-[0_0_15px_rgba(252,211,77,0.5)] leading-tight">
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

        {/* 抽奖核心展示区 */}
        <div className="relative w-full max-w-6xl h-[560px]">
          <div className="absolute -inset-1.5 border-gold-pro opacity-50 rounded-[2.5rem] pointer-events-none"></div>
          <div className="h-full w-full glass-dark border-gold-pro rounded-[2.5rem] overflow-hidden flex items-center justify-center relative">
            
            {isDrawing ? (
              // 5x5 滚动网格，显示大字体滚动姓名
              <div className="grid grid-cols-5 gap-3 w-full h-full p-6">
                {gridPools.map((pool, i) => (
                  <div key={i} className="flex-1 glass-dark rounded-2xl flex items-center justify-center overflow-hidden border border-yellow-500/10 bg-black/20">
                    <div className="h-full w-full relative">
                      <div 
                        className="animate-grid-scroll absolute inset-0 flex flex-col items-center"
                        style={{ '--scroll-speed': getScrollSpeed(i) } as any}
                      >
                        {[...pool, ...pool].map((name, idx) => (
                          <div key={idx} className="h-28 min-h-[112px] flex items-center justify-center text-5xl font-black text-yellow-500/30 italic drop-shadow-lg tracking-tighter">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tempWinners.length > 0 ? (
              // 中奖结果：每排最多 5 个，居中对齐
              <div className={`flex flex-wrap items-center justify-center gap-6 ${gridConfig.padding} w-full h-full overflow-y-auto scrollbar-hide`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
                  {tempWinners.map(winner => (
                    <div key={winner.id} className="relative group animate-[zoom-in_0.4s_ease-out] flex justify-center">
                      <div className="absolute -inset-6 bg-yellow-400 opacity-25 blur-[40px] rounded-full"></div>
                      <div className={`relative bg-gradient-to-b from-yellow-50 via-yellow-400 to-yellow-600 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.7)] border-4 border-yellow-100 flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 ${gridConfig.cardSize}`}>
                        <div className={`text-red-950 font-festive font-black leading-none drop-shadow-md ${gridConfig.fontSize}`}>
                          {winner.name}
                        </div>
                        {tempWinners.length <= 10 && (
                          <div className="mt-2 text-red-900 text-[10px] font-black tracking-widest uppercase opacity-60">Winner</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // 默认显示礼物盒
              <div className="flex flex-col items-center gap-8">
                <GiftBox />
                <div className="text-yellow-500/20 text-sm font-bold tracking-[1.5em] ml-[1.5em] uppercase animate-pulse">Ready to draw</div>
              </div>
            )}
          </div>
        </div>

        {/* 底部交互区 */}
        <div className="mt-10 flex items-center justify-center gap-10">
          
          {/* 抽取人数调节 */}
          <div className="flex items-center glass-dark rounded-2xl p-1 border-yellow-600/20">
             <button onClick={() => handleBatchChange(-1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">-</button>
             <div className="px-6 flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] text-yellow-600/50 font-bold uppercase">每次抽取</span>
                <span className="text-2xl font-black text-yellow-400">{currentPrize?.drawBatch || 0} <span className="text-xs">人</span></span>
             </div>
             <button onClick={() => handleBatchChange(1)} className="w-12 h-12 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-black text-2xl">+</button>
          </div>

          {/* 开始/停止主按钮 */}
          <button 
            onClick={startDraw}
            disabled={!isDrawing && (remainingCount <= 0 || state.participants.length === 0)}
            className={`btn-gold-3d px-24 py-6 rounded-[2rem] text-4xl font-black text-red-950 transition-all ${
              !isDrawing && remainingCount <= 0 ? 'grayscale pointer-events-none opacity-50' : 'hover:brightness-110'
            }`}
          >
            {isDrawing ? '停止' : '开始'}
          </button>

          {/* 已中奖统计与名单 */}
          <div className="flex items-center gap-4">
             <div className="glass-dark px-6 py-2 rounded-2xl border-yellow-600/20 text-center min-w-[120px]">
                <div className="text-[10px] text-yellow-600/50 font-bold uppercase">已中奖</div>
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

      {/* 侧边中奖名单抽屉 */}
      <aside className={`fixed right-6 top-32 w-72 z-40 transition-all duration-500 transform ${showWinnersList ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
         <div className="glass-dark rounded-[2rem] p-6 border-yellow-600/30 max-h-[65vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-yellow-600/10 pb-4">
               <h3 className="text-yellow-500 font-bold flex flex-col">
                 <span className="text-[10px] text-yellow-600/50 uppercase font-black tracking-widest">{currentPrize?.name}</span>
                 <span className="flex items-center gap-2 italic text-lg"><ICONS.Trophy /> 获奖名单</span>
               </h3>
               <button onClick={() => setShowWinnersList(false)} className="text-yellow-600 hover:text-yellow-400">
                 <ICONS.Back />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
               {[...allPrizeWinners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group hover:bg-yellow-500/10 transition-colors">
                     <div className="w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center text-yellow-400 font-bold border border-yellow-600/20">
                        {w.participantName.charAt(0)}
                     </div>
                     <div className="flex-1">
                        <div className="font-bold text-yellow-100 text-sm">{w.participantName}</div>
                        <div className="text-[10px] text-yellow-600 flex justify-between">
                           <span>幸运入选</span>
                           <span className="opacity-40">{new Date(w.drawTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                     </div>
                  </div>
               ))}
               {allPrizeWinners.length === 0 && (
                 <div className="text-center py-20 text-white/5 text-xs italic">虚位以待...</div>
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
