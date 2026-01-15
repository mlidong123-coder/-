
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
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
          <h2 className="text-3xl font-bold text-yellow-500">后台设置</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <ICONS.Back />
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setActiveTab('names')}
            className={`px-4 py-2 rounded-lg transition ${activeTab === 'names' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            名单管理
          </button>
          <button 
            onClick={() => setActiveTab('prizes')}
            className={`px-4 py-2 rounded-lg transition ${activeTab === 'prizes' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            奖项设置
          </button>
          <button 
            onClick={() => setActiveTab('rigging')}
            className={`px-4 py-2 rounded-lg transition ${activeTab === 'rigging' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            内定 & 屏蔽
          </button>
        </div>

        {activeTab === 'names' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">输入参会人员姓名，每行一个姓名：</p>
            <textarea
              className="w-full h-64 bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={rawNames}
              onChange={(e) => setRawNames(e.target.value)}
              placeholder="张三&#10;李四&#10;王五..."
            />
            <button 
              onClick={handleImportNames}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl transition shadow-lg"
            >
              保存并重新导入人员名单
            </button>
          </div>
        )}

        {activeTab === 'prizes' && (
          <div className="space-y-4">
            {state.prizes.map(prize => (
              <div key={prize.id} className="bg-white/5 p-4 rounded-xl border border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">奖项名称</label>
                  <input 
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white" 
                    value={prize.name} 
                    onChange={(e) => updatePrize(prize.id, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">总名额</label>
                  <input 
                    type="number" 
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white" 
                    value={prize.totalCount} 
                    onChange={(e) => updatePrize(prize.id, 'totalCount', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">单次抽取人数</label>
                  <input 
                    type="number" 
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white" 
                    value={prize.drawBatch} 
                    onChange={(e) => updatePrize(prize.id, 'drawBatch', parseInt(e.target.value) || 0)}
                  />
                </div>
                <button 
                  onClick={() => updateState({ ...state, prizes: state.prizes.filter(p => p.id !== prize.id) })}
                  className="bg-red-900/40 hover:bg-red-800 text-red-200 px-3 py-1 rounded"
                >
                  删除
                </button>
              </div>
            ))}
            <button 
              onClick={handleAddPrize}
              className="w-full border-2 border-dashed border-white/20 hover:border-yellow-500/50 text-gray-400 py-3 rounded-xl transition"
            >
              + 添加新奖项
            </button>
          </div>
        )}

        {activeTab === 'rigging' && (
          <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h3 className="text-xl font-bold mb-4 text-yellow-400">操作说明</h3>
              <p className="text-sm text-gray-300">
                1. 选中“不中奖”：该人员永远不会被抽中。<br/>
                2. 选中“指定奖项”：在该奖项抽取时，程序会优先确保选中的人员中奖（只要还有名额）。
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.participants.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex gap-2 text-xs">
                    <button 
                      onClick={() => toggleBlacklist(p.id)}
                      className={`px-2 py-1 rounded transition ${state.rigging.blacklist.includes(p.id) ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}
                    >
                      不中奖
                    </button>
                    {state.prizes.map(prize => (
                      <button 
                        key={prize.id}
                        onClick={() => toggleForced(prize.id, p.id)}
                        className={`px-2 py-1 rounded transition ${(state.rigging.forcedWinners[prize.id] || []).includes(p.id) ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-400'}`}
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

        <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
          <button 
            onClick={() => {
              if (confirm('确定要清空所有中奖记录吗？')) {
                updateState({ ...state, winners: [] });
              }
            }}
            className="text-red-400 hover:text-red-300 text-sm mr-auto"
          >
            清空中奖记录
          </button>
          <button 
            onClick={onClose}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-8 py-2 rounded-xl transition"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
