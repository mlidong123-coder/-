
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
  const [scrollingNames, setScrollingNames] = useState<string[]>([]);
  
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state.participants.length > 0) {
      // 打乱初始顺序增加随机感
      setScrollingNames([...state.participants].sort(() => Math.random() - 0.5).map(p => p.name));
    }
  }, [state.participants]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentPrize = state.prizes.find(p => p.id === currentPrizeId);
  const alreadyWonCount = state.winners.filter(w => w.prizeId === currentPrizeId).length;
  const remainingCount = currentPrize ? currentPrize.totalCount - alreadyWonCount : 0;

  const startDraw = () => {
    if (isDrawing) return;
    if (!currentPrize) return alert('请先设置奖项');
    if (remainingCount <= 0) return alert('该奖项名额已满');
    
    setIsDrawing(true);
    setTempWinners([]);
    
    if (rollAudioRef.current) {
      rollAudioRef.current.loop = true;
      rollAudioRef.current.play().catch(() => {});
    }

    setTimeout(() => {
      const result = performDraw(state, currentPrizeId);
      if (result.error) {
        alert(result.error);
        setIsDrawing(false);
        if (rollAudioRef.current) rollAudioRef.current.pause();
        return;
      }

      const newWinners: Winner[] = result.winners.map(p => ({
        participantId: p.id,
        participantName: p.name,
        prizeId: currentPrizeId,
        prizeName: currentPrize!.name,
        drawTime: Date.now(),
      }));

      setTempWinners(result.winners);
      setIsDrawing(false);
      
      if (rollAudioRef.current) {
        rollAudioRef.current.pause();
        rollAudioRef.current.currentTime = 0;
      }
      if (winAudioRef.current) {
        winAudioRef.current.play().catch(() => {});
      }

      setState(prev => ({
        ...prev,
        winners: [...prev.winners, ...newWinners]
      }));
    }, 2500);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center">
      {/* 装饰灯笼 */}
      <div className="absolute top-0 left-10 lantern hidden lg:block">
        <div className="w-12 h-20 bg-red-600 rounded-lg border-2 border-yellow-500 flex flex-col items-center justify-around py-2 shadow-2xl">
          <div className="w-full h-1 bg-yellow-500"></div>
          <span className="text-yellow-400 font-festive text-sm leading-none">年<br/>会</span>
          <div className="w-full h-1 bg-yellow-500"></div>
        </div>
      </div>
      <div className="absolute top-0 right-10 lantern hidden lg:block" style={{ animationDelay: '0.5s' }}>
        <div className="w-12 h-20 bg-red-600 rounded-lg border-2 border-yellow-500 flex flex-col items-center justify-around py-2 shadow-2xl">
          <div className="w-full h-1 bg-yellow-500"></div>
          <span className="text-yellow-400 font-festive text-sm leading-none">盛<br/>典</span>
          <div className="w-full h-1 bg-yellow-500"></div>
        </div>
      </div>

      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 顶部标题 */}
      <header className="w-full max-w-7xl pt-8 px-6 flex justify-between items-end z-20">
        <div className="flex flex-col">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-yellow-600 to-yellow-300 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(252,211,77,0.5)] border-2 border-yellow-100 p-1">
              <div className="w-full h-full bg-red-800 rounded-full flex items-center justify-center text-yellow-400">
                <ICONS.Trophy />
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-black font-festive tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 text-glow-gold">
                2025 荣耀盛典
              </h1>
              <p className="text-yellow-600/80 font-bold uppercase tracking-tighter">ANNUAL GALA PRIZE DRAW</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div className="glass-panel px-4 py-2 rounded-xl text-xs text-yellow-500 border border-yellow-600/30">
            <div className="opacity-60">参会总数</div>
            <div className="text-xl font-bold">{state.participants.length} 人</div>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="group relative p-4 bg-yellow-600 hover:bg-yellow-500 rounded-full transition-all shadow-[0_0_15px_rgba(217,119,6,0.5)] overflow-hidden"
          >
            <div className="relative z-10 text-red-900 group-hover:rotate-90 transition-transform duration-500">
              <ICONS.Settings />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </button>
        </div>
      </header>

      {/* 抽奖主舞台 */}
      <main className="flex-1 w-full max-w-6xl flex flex-col items-center justify-center py-6 px-4 z-10">
        {/* 奖项切换器 */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {state.prizes.map(p => (
            <button
              key={p.id}
              onClick={() => !isDrawing && setCurrentPrizeId(p.id)}
              className={`px-6 py-2 rounded-full font-bold transition-all border-2 ${
                currentPrizeId === p.id 
                ? 'bg-yellow-500 text-red-900 border-yellow-200 shadow-[0_0_15px_rgba(252,211,77,0.4)] scale-110' 
                : 'bg-red-900/40 text-yellow-600 border-yellow-900/30 hover:bg-red-800/60'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* 核心展示区 (3D 风格) */}
        <div className="relative w-full max-w-4xl">
          {/* 背景光晕 */}
          <div className="absolute -inset-10 bg-yellow-500/10 blur-[100px] rounded-full"></div>
          
          <div className="gold-border-fancy relative bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden aspect-[21/9] flex items-center justify-center">
            {isDrawing ? (
              <div className="flex w-full h-full px-10 gap-4 overflow-hidden">
                {Array.from({ length: currentPrize?.drawBatch || 1 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-yellow-500/5 to-transparent border-x border-yellow-500/10">
                    <div className="h-28 overflow-hidden relative w-full">
                      <div className="slot-animation absolute inset-0 flex flex-col items-center">
                        {[...scrollingNames, ...scrollingNames].map((name, idx) => (
                          <div key={idx} className="h-28 flex items-center justify-center text-5xl font-black text-yellow-500/80 italic">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tempWinners.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-8 p-10 animate-[zoom-in_0.5s_ease-out]">
                {tempWinners.map(winner => (
                  <div key={winner.id} className="group relative">
                    <div className="absolute -inset-4 bg-yellow-400 opacity-20 group-hover:opacity-40 blur-xl transition rounded-full"></div>
                    <div className="relative flex flex-col items-center p-6 bg-gradient-to-b from-yellow-100 to-yellow-500 rounded-2xl shadow-2xl transform hover:scale-110 transition duration-300 min-w-[180px]">
                      <div className="text-red-900 text-xs font-bold mb-1 opacity-60">恭喜中奖</div>
                      <div className="text-red-800 text-5xl font-black font-festive">{winner.name}</div>
                      <div className="mt-2 w-8 h-1 bg-red-800/20 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-8xl font-festive text-yellow-600/10 select-none">福星高照</div>
                <div className="mt-4 text-yellow-500/40 tracking-[1em] font-bold">READY TO DRAW</div>
              </div>
            )}
          </div>

          {/* 底部信息台 */}
          <div className="mt-8 flex justify-between items-center px-6">
            <div className="text-yellow-600/80 font-bold">
              <span className="opacity-50">奖项状态: </span>
              <span className="text-yellow-400">{currentPrize?.name}</span> 
              <span className="mx-2">|</span>
              <span className="opacity-50">剩余名额: </span>
              <span className="text-yellow-400">{remainingCount} / {currentPrize?.totalCount}</span>
            </div>
            
            <button 
              onClick={startDraw}
              disabled={isDrawing || remainingCount <= 0}
              className={`group relative px-12 py-5 text-2xl font-black rounded-xl transition-all active:scale-95 ${
                isDrawing || remainingCount <= 0 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale' 
                : 'bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 text-red-950 shadow-[0_10px_30px_rgba(180,83,9,0.5)] hover:shadow-[0_15px_40px_rgba(252,211,77,0.4)]'
              }`}
            >
              <span className="relative z-10">{isDrawing ? '正在揭晓...' : remainingCount <= 0 ? '名额已满' : '立即抽奖'}</span>
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition duration-300 rounded-xl"></div>
            </button>
          </div>
        </div>
      </main>

      {/* 侧边获奖列表 (抽屉式设计) */}
      <div className="fixed bottom-0 right-0 p-6 z-20">
         <div className="glass-panel p-4 rounded-2xl max-h-[300px] w-[280px] overflow-y-auto border-yellow-600/20 shadow-2xl">
            <h3 className="text-yellow-400 font-bold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><ICONS.Trophy /> 获奖金榜</span>
              <span className="text-[10px] bg-yellow-600/20 px-2 py-0.5 rounded text-yellow-200">{state.winners.length}</span>
            </h3>
            {state.winners.length > 0 ? (
              <div className="space-y-2">
                {[...state.winners].reverse().map((w, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-red-900/30 rounded border border-white/5 group hover:bg-yellow-500/10 transition">
                    <span className="font-bold text-yellow-200">{w.participantName}</span>
                    <span className="text-[10px] text-yellow-600 px-1.5 py-0.5 rounded-sm bg-yellow-500/10">{w.prizeName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-white/10 text-sm italic">虚位以待...</div>
            )}
         </div>
      </div>

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
