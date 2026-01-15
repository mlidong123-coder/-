
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
  const [rawNames, setRawNames] = useState(state.participants.map(p => `${p.name}`).join('\n'));

  const handleImportNames = () => {
    const names = rawNames.split('\n').map(n => n.trim()).filter(Boolean);
    const newParticipants: Participant[] = names.map((name, index) => ({
      id: `u-${Date.now()}-${index}`,
      name,
      department: '公司',
    }));
    updateState({ ...state, participants: newParticipants });
    alert(`成功导入 ${newParticipants.length} 人`);
  };

  const handleAddPrize = () => {
    const newPrize: Prize = {
      id: `p-${Date.now()}`,
      name: '新奖项',
      totalCount: 10,
      drawBatch: 5,
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
    <div className="fixed inset-0 bg-black/80 z-[100] backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-red-950/90 border-2 border-yellow-600/50 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col h-[85vh]">
        {/* 标题栏 */}
        <div className="p-6 border-b border-yellow-600/20 flex justify-between items-center bg-gradient-to-r from-red-900/50 to-transparent">
          <h2 className="text-3xl font-black font-festive text-yellow-500 tracking-wider">系统后台配置</h2>
          <button onClick={onClose} className="p-2 hover:bg-yellow-500/10 rounded-full text-yellow-600 transition">
            <ICONS.Back />
          </button>
        </div>

        {/* 侧边栏/导航 */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 bg-black/20 p-4 border-r border-yellow-600/10 space-y-2">
            {[
              { id: 'names', label: '名单管理' },
              { id: 'prizes', label: '奖项设置' },
              { id: 'rigging', label: '内定策略' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-4 py-3 rounded-xl font-bold transition ${
                  activeTab === tab.id 
                  ? 'bg-yellow-600 text-red-900 shadow-lg' 
                  : 'text-yellow-600/60 hover:bg-white/5 hover:text-yellow-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="mt-10 pt-10 border-t border-yellow-600/10">
               <button 
                  onClick={() => confirm('确定清空所有中奖记录？') && updateState({ ...state, winners: [] })}
                  className="text-red-500 text-xs px-4 hover:underline"
               >
                 重置中奖记录
               </button>
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'names' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="text-yellow-500 font-bold">参会人员导入 (每行一个姓名)</label>
                  <span className="text-xs text-white/30">当前共计: {state.participants.length} 人</span>
                </div>
                <textarea
                  className="w-full h-[400px] bg-black/40 border border-yellow-600/20 rounded-2xl p-6 text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition font-mono"
                  value={rawNames}
                  onChange={(e) => setRawNames(e.target.value)}
                  placeholder="请输入姓名..."
                />
                <button 
                  onClick={handleImportNames}
                  className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-red-950 font-black rounded-xl shadow-lg transition"
                >
                  保存并同步名单
                </button>
              </div>
            )}

            {activeTab === 'prizes' && (
              <div className="space-y-4">
                {state.prizes.map(prize => (
                  <div key={prize.id} className="bg-black/20 p-5 rounded-2xl border border-yellow-600/10 flex flex-col md:flex-row gap-6 items-end group hover:border-yellow-600/40 transition">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] text-yellow-600/50 uppercase font-bold tracking-widest">奖项名称</label>
                      <input 
                        className="w-full bg-red-900/10 border-b border-yellow-600/20 px-0 py-2 text-xl font-bold text-yellow-400 focus:outline-none focus:border-yellow-500" 
                        value={prize.name} 
                        onChange={(e) => updatePrize(prize.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-24 space-y-2">
                      <label className="text-[10px] text-yellow-600/50 uppercase font-bold tracking-widest">总数</label>
                      <input 
                        type="number" 
                        className="w-full bg-red-900/10 border-b border-yellow-600/20 px-0 py-2 text-xl text-yellow-400 focus:outline-none" 
                        value={prize.totalCount} 
                        onChange={(e) => updatePrize(prize.id, 'totalCount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-24 space-y-2">
                      <label className="text-[10px] text-yellow-600/50 uppercase font-bold tracking-widest">单抽</label>
                      <input 
                        type="number" 
                        className="w-full bg-red-900/10 border-b border-yellow-600/20 px-0 py-2 text-xl text-yellow-400 focus:outline-none" 
                        value={prize.drawBatch} 
                        onChange={(e) => updatePrize(prize.id, 'drawBatch', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <button 
                      onClick={() => updateState({ ...state, prizes: state.prizes.filter(p => p.id !== prize.id) })}
                      className="text-red-900 bg-red-500/20 hover:bg-red-500 p-2 rounded-lg transition"
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button 
                  onClick={handleAddPrize}
                  className="w-full border-2 border-dashed border-yellow-600/20 py-6 rounded-2xl text-yellow-600 hover:bg-yellow-600/10 transition flex items-center justify-center gap-2"
                >
                  + 新增奖项配置
                </button>
              </div>
            )}

            {activeTab === 'rigging' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5 hover:border-yellow-600/30 transition">
                    <span className="font-bold text-yellow-200">{p.name}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => toggleBlacklist(p.id)}
                        className={`text-[10px] px-2 py-1 rounded transition ${state.rigging.blacklist.includes(p.id) ? 'bg-red-600 text-white' : 'bg-red-900/20 text-red-500/50 hover:bg-red-900/40'}`}
                      >
                        屏蔽
                      </button>
                      {state.prizes.map(prize => (
                        <button 
                          key={prize.id}
                          onClick={() => toggleForced(prize.id, p.id)}
                          className={`text-[10px] px-2 py-1 rounded transition ${(state.rigging.forcedWinners[prize.id] || []).includes(p.id) ? 'bg-yellow-600 text-red-900' : 'bg-yellow-900/10 text-yellow-600/40 hover:bg-yellow-900/20'}`}
                        >
                          {prize.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
