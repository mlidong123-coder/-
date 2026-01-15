
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化滚动名单
  useEffect(() => {
    if (state.participants.length > 0) {
      setScrollingNames(state.participants.map(p => p.name));
    }
  }, [state.participants]);

  // 同步状态到 localStorage
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
    
    // 播放滚动音效
    if (rollAudioRef.current) {
      rollAudioRef.current.loop = true;
      rollAudioRef.current.play().catch(() => {});
    }

    // 模拟抽奖时间
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
    }, 3000);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center p-4">
      {/* 隐藏音轨组件 */}
      <audio ref={bgAudioRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" loop />
      <audio ref={rollAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3" />
      <audio ref={winAudioRef} src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" />

      {/* 顶部状态栏 */}
      <header className="w-full flex justify-between items-center p-4 max-w-6xl">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-200">
            <ICONS.Trophy />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-festive text-yellow-400">至尊抽奖</h1>
            <p className="text-xs text-red-200">总人数: {state.participants.length} | 已中奖: {state.winners.length}</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition shadow-xl border border-white/20"
        >
          <ICONS.Settings />
        </button>
      </header>

      {/* 主抽奖区 */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl py-12">
        <div className="text-center mb-8">
          <select 
            className="bg-red-800/50 text-yellow-300 text-3xl font-bold font-festive border-none focus:ring-0 cursor-pointer text-center p-2 rounded-xl mb-2"
            value={currentPrizeId}
            onChange={(e) => setCurrentPrizeId(e.target.value)}
          >
            {state.prizes.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="text-yellow-500/80 font-medium">
            ( 总名额: {currentPrize?.totalCount} | 剩余: {remainingCount} | 单次抽取: {currentPrize?.drawBatch} )
          </div>
        </div>

        {/* 动态显示区域 */}
        <div className="relative w-full aspect-[2/1] bg-black/30 backdrop-blur-sm rounded-[3rem] border-8 border-yellow-600 shadow-2xl flex items-center justify-center overflow-hidden">
          {/* 装饰边框 */}
          <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-yellow-500 opacity-50"></div>
          <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-yellow-500 opacity-50"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-yellow-500 opacity-50"></div>
          <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-yellow-500 opacity-50"></div>

          {isDrawing ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full h-full p-12 overflow-hidden">
              {Array.from({ length: currentPrize?.drawBatch || 1 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-full h-24 overflow-hidden relative border-y border-yellow-500/30">
                    <div className="scrolling-list absolute inset-0 flex flex-col items-center">
                      {[...scrollingNames, ...scrollingNames].map((name, idx) => (
                        <div key={idx} className="h-24 flex items-center justify-center text-4xl font-bold text-white/80">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tempWinners.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-6 p-8">
              {tempWinners.map(winner => (
                <div key={winner.id} className="animate-bounce flex flex-col items-center">
                  <div className="text-7xl md:text-8xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] font-festive">
                    {winner.name}
                  </div>
                  <div className="text-lg text-white/60 mt-2">恭喜中奖</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-6xl md:text-8xl font-festive text-white/20 animate-pulse">
              准备就绪
            </div>
          )}
        </div>

        {/* 抽奖按钮 */}
        <button 
          onClick={startDraw}
          disabled={isDrawing || remainingCount <= 0}
          className={`mt-12 px-16 py-6 text-3xl font-black rounded-full shadow-[0_10px_0_0_#92400e] active:shadow-none active:translate-y-[10px] transition-all transform hover:scale-105 ${
            isDrawing || remainingCount <= 0 
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
            : 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-red-900 border-4 border-yellow-300'
          }`}
        >
          {isDrawing ? '正在抽取...' : remainingCount <= 0 ? '名额已满' : '开始抽奖'}
        </button>
      </main>

      {/* 底部中奖名单 */}
      <footer className="w-full max-w-6xl mt-12 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 mb-8">
        <h3 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
          <ICONS.Trophy /> 本场获奖名单 ({state.winners.length})
        </h3>
        {state.winners.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...state.winners].reverse().map((w, i) => (
              <div key={i} className="bg-red-900/40 p-3 rounded-xl border border-white/10 flex flex-col items-center">
                <span className="text-yellow-200 font-bold">{w.participantName}</span>
                <span className="text-[10px] text-white/50">{w.prizeName}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/20 italic">暂无中奖记录</div>
        )}
      </footer>

      {/* 弹窗 */}
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
