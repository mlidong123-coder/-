
import React, { useState } from 'react';
import { AppState, Participant, Prize } from '../types';
import { ICONS } from '../constants';

interface SettingsProps {
  state: AppState;
  updateState: (newState: AppState) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState, onClose }) => {
  const [activeTab, setActiveTab] = useState<'names' | 'prizes' | 'rigging'>('names');
  const [rawNames, setRawNames] = useState(state.participants.map(p => p.name).join('\n'));

  const handleImportNames = () => {
    const names = rawNames.split('\n').map(n => n.trim()).filter(Boolean);
    const newParticipants: Participant[] = names.map((name, index) => ({
      id: `u-${Date.now()}-${index}`,
      name,
      department: '公司',
    }));
    updateState({ ...state, participants: newParticipants });
    alert(`🎉 成功录入 ${newParticipants.length} 名参会人员`);
  };

  const handleAddPrize = () => {
    const newPrize: Prize = {
      id: `p-${Date.now()}`,
      name: '新奖项',
      totalCount: 5,
      drawBatch: 1,
    };
    updateState({ ...state, prizes: [...state.prizes, newPrize] });
  };

  const updatePrize = (id: string, field: keyof Prize, value: string | number) => {
    const updatedPrizes = state.prizes.map(p => p.id === id ? { ...p, [field]: value } : p);
    updateState({ ...state, prizes: updatedPrizes });
  };

  const toggleBlacklist = (userId: string) => {
    const isBlacklisted = state.rigging.blacklist.includes(userId);
    const newBlacklist = isBlacklisted 
      ? state.rigging.blacklist.filter(id => id !== userId)
      : [...state.rigging.blacklist, userId];
    updateState({ ...state, rigging: { ...state.rigging, blacklist: newBlacklist } });
  };

  const toggleForced = (prizeId: string, userId: string) => {
    const currentForced = state.rigging.forcedWinners[prizeId] || [];
    const isForced = currentForced.includes(userId);
    const newForced = isForced
      ? currentForced.filter(id => id !== userId)
      : [...currentForced, userId];
    
    updateState({
      ...state,
      rigging: {
        ...state.rigging,
        forcedWinners: { ...state.rigging.forcedWinners, [prizeId]: newForced }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center backdrop-blur-xl p-4 md:p-10">
      <div className="w-full max-w-6xl h-full bg-red-950 border-2 border-yellow-600/40 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        {/* 标题 */}
        <div className="p-8 border-b border-yellow-600/10 flex justify-between items-center bg-gradient-to-r from-black/40 to-transparent">
          <div>
            <h2 className="text-3xl font-black font-festive text-yellow-500 tracking-widest">抽奖系统配置后台</h2>
            <p className="text-yellow-700 text-xs font-bold uppercase mt-1">Management Control Panel</p>
          </div>
          <button onClick={onClose} className="p-3 bg-yellow-600/10 hover:bg-yellow-600/20 rounded-full text-yellow-500 transition-all">
            <ICONS.Back />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* 侧边导航 */}
          <nav className="w-64 bg-black/30 border-r border-yellow-600/10 p-6 flex flex-col gap-3">
             {[
               { id: 'names', label: '名单录入', icon: <ICONS.User /> },
               { id: 'prizes', label: '奖项配置', icon: <ICONS.Trophy /> },
               { id: 'rigging', label: '内定策略', icon: <ICONS.Settings /> }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                   activeTab === tab.id 
                   ? 'bg-yellow-600 text-red-950 shadow-lg' 
                   : 'text-yellow-600/40 hover:bg-white/5 hover:text-yellow-500'
                 }`}
               >
                 <span className="scale-75">{tab.icon}</span>
                 {tab.label}
               </button>
             ))}
             
             <div className="mt-auto pt-6 border-t border-yellow-600/10">
                <button 
                  onClick={() => confirm('确定要重置所有抽奖进度吗？') && updateState({ ...state, winners: [] })}
                  className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all text-xs font-bold"
                >
                  重置中奖记录
                </button>
             </div>
          </nav>

          {/* 内容面板 */}
          <main className="flex-1 overflow-y-auto p-10 bg-black/10">
            {activeTab === 'names' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-2">
                   <div>
                      <h3 className="text-xl font-bold text-yellow-500">导入参会人员</h3>
                      <p className="text-white/30 text-xs">每行输入一个姓名，系统将自动识别并分配 ID。</p>
                   </div>
                   <div className="text-yellow-600/60 font-mono text-sm">TOTAL: {state.participants.length}</div>
                </div>
                <textarea
                  className="w-full h-[450px] bg-black/40 border border-yellow-600/20 rounded-3xl p-8 text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all font-mono text-lg leading-relaxed shadow-inner"
                  value={rawNames}
                  onChange={(e) => setRawNames(e.target.value)}
                  placeholder="请输入姓名..."
                />
                <button 
                  onClick={handleImportNames}
                  className="w-full py-5 bg-gradient-to-b from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-red-950 font-black rounded-2xl shadow-xl transition-all text-xl tracking-widest"
                >
                  确认导入并同步数据
                </button>
              </div>
            )}

            {activeTab === 'prizes' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-yellow-500 mb-6">奖项阶梯设置</h3>
                <div className="grid grid-cols-1 gap-4">
                  {state.prizes.map(prize => (
                    <div key={prize.id} className="bg-black/40 p-6 rounded-3xl border border-yellow-600/10 flex flex-col md:flex-row gap-8 items-center hover:border-yellow-600/40 transition-all">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] text-yellow-600/40 uppercase font-black tracking-widest">Prize Name</label>
                        <input 
                          className="w-full bg-transparent border-b border-yellow-600/20 px-0 py-2 text-2xl font-black text-yellow-400 focus:outline-none focus:border-yellow-500" 
                          value={prize.name} 
                          onChange={(e) => updatePrize(prize.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="flex gap-8">
                        <div className="w-32 space-y-2 text-center">
                          <label className="text-[10px] text-yellow-600/40 uppercase font-black tracking-widest">Total</label>
                          <input 
                            type="number" 
                            className="w-full bg-red-900/10 border border-yellow-600/20 rounded-xl px-4 py-2 text-center text-xl text-yellow-400 focus:outline-none" 
                            value={prize.totalCount} 
                            onChange={(e) => updatePrize(prize.id, 'totalCount', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-32 space-y-2 text-center">
                          <label className="text-[10px] text-yellow-600/40 uppercase font-black tracking-widest">Batch</label>
                          <input 
                            type="number" 
                            className="w-full bg-red-900/10 border border-yellow-600/20 rounded-xl px-4 py-2 text-center text-xl text-yellow-400 focus:outline-none" 
                            value={prize.drawBatch} 
                            onChange={(e) => updatePrize(prize.id, 'drawBatch', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => updateState({ ...state, prizes: state.prizes.filter(p => p.id !== prize.id) })}
                        className="p-3 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-2xl transition-all"
                      >
                        <ICONS.Back />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={handleAddPrize}
                    className="w-full border-2 border-dashed border-yellow-600/20 py-10 rounded-3xl text-yellow-600 hover:bg-yellow-600/5 transition-all flex items-center justify-center gap-4 text-lg font-bold"
                  >
                    <span className="text-3xl">+</span> 添加新奖项层级
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'rigging' && (
              <div className="space-y-6">
                <div className="bg-yellow-600/5 p-6 rounded-3xl border border-yellow-600/20 mb-8">
                   <h3 className="text-yellow-500 font-bold mb-2">内定逻辑说明</h3>
                   <ul className="text-xs text-yellow-700/80 space-y-1">
                      <li>• <b>屏蔽：</b> 被选中的人员将从整个奖池剔除，无论如何都不会中奖。</li>
                      <li>• <b>奖项内定：</b> 当抽取该奖项时，系统会优先填补这些人员（只要他们还未中过奖）。</li>
                   </ul>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {state.participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                      <span className="font-bold text-yellow-200 group-hover:text-yellow-400">{p.name}</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => toggleBlacklist(p.id)}
                          className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter transition-all ${state.rigging.blacklist.includes(p.id) ? 'bg-red-600 text-white' : 'bg-red-950/20 text-red-500/40 hover:bg-red-900/40'}`}
                        >
                          黑名单
                        </button>
                        {state.prizes.map(prize => (
                          <button 
                            key={prize.id}
                            onClick={() => toggleForced(prize.id, p.id)}
                            className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter transition-all ${(state.rigging.forcedWinners[prize.id] || []).includes(p.id) ? 'bg-yellow-600 text-red-950' : 'bg-yellow-950/10 text-yellow-600/30 hover:bg-yellow-950/20'}`}
                          >
                            {prize.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
        
        {/* 底部确认栏 */}
        <div className="p-8 border-t border-yellow-600/10 flex justify-end gap-6 bg-black/40">
           <button 
              onClick={onClose}
              className="px-12 py-3 bg-yellow-600 hover:bg-yellow-500 text-red-950 font-black rounded-xl transition-all shadow-lg"
           >
             保存设置并返回
           </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
