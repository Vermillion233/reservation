import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// --- 데이터 모델 ---
type Industry = '건설업' | '제조업' | '서비스업' | '공공기관';

interface Application {
  id: string;
  date: string; // YYYY-MM-DD
  industry: Industry;
  company: string;
  applicant: string;
  phone: string;
  createdAt: number;
}

const DEFAULT_SLOTS = 30;
const INDUSTRIES: Industry[] = ['건설업', '제조업', '서비스업', '공공기관'];

// --- 공용 클라우드 저장소 (npoint.io 활용) ---
// 이 URL이 PC와 모바일의 공용 데이터 통로가 됩니다.
const CLOUD_STORAGE_URL = 'https://api.npoint.io/0689b14f86d8a7051f68'; 

// --- 유틸리티 ---
const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isPastDate = (year: number, month: number, day: number): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(year, month, day);
  return target < today;
};

const App = () => {
  const [view, setView] = useState<'home' | 'apply' | 'admin' | 'search'>('home');
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [customSlots, setCustomSlots] = useState<Record<string, number>>({}); 
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<Industry>('건설업');
  const [adminMode, setAdminMode] = useState<'list' | 'slots'>('list');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<Application[] | null>(null);
  
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // 로컬 스토리지 로드
  useEffect(() => {
    try {
      const savedApps = localStorage.getItem('app_bookings');
      const savedSlots = localStorage.getItem('app_custom_slots_v3'); 
      if (savedApps) setApps(JSON.parse(savedApps));
      if (savedSlots) setCustomSlots(JSON.parse(savedSlots));
    } catch (e) {
      console.error("Storage load error", e);
    }
  }, []);

  // 로컬 스토리지 저장
  useEffect(() => {
    localStorage.setItem('app_bookings', JSON.stringify(apps));
    localStorage.setItem('app_custom_slots_v3', JSON.stringify(customSlots));
  }, [apps, customSlots]);

  // 잔여석 계산
  const getRemainingSlots = (dateStr: string, industry: Industry) => {
    const key = `${industry}_${dateStr}`;
    const totalForDate = customSlots[key] ?? DEFAULT_SLOTS;
    const bookedCount = apps.filter(a => a.date === dateStr && a.industry === industry).length;
    return Math.max(0, totalForDate - bookedCount);
  };

  const getTotalSlotsForDate = (dateStr: string, industry: Industry) => {
    const key = `${industry}_${dateStr}`;
    return customSlots[key] ?? DEFAULT_SLOTS;
  };

  // --- 원터치 클라우드 동기화 (병합 방식) ---
  const handleGlobalSync = async () => {
    setIsSyncing(true);
    try {
      // 1. 서버 데이터 시도
      let cloudApps: Application[] = [];
      let cloudSlots: Record<string, number> = {};

      const res = await fetch(CLOUD_STORAGE_URL);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const cloudData = JSON.parse(text);
          cloudApps = cloudData.apps || [];
          cloudSlots = cloudData.slots || {};
        }
      }

      // 2. 스마트 병합 (ID 기반 중복 제거)
      const mergedApps = [...apps];
      cloudApps.forEach((cApp) => {
        if (!mergedApps.find(a => a.id === cApp.id)) {
          mergedApps.push(cApp);
        }
      });

      // 3. 정원 설정 병합 (두 기기 중 값이 있는 쪽 우선, 충돌 시 최신 로컬 데이터 우선)
      const mergedSlots = { ...cloudSlots, ...customSlots };

      // 4. 합쳐진 데이터를 서버에 다시 업로드
      const updateRes = await fetch(CLOUD_STORAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: mergedApps, slots: mergedSlots, lastSynced: Date.now() })
      });

      if (!updateRes.ok) throw new Error("Update failed");

      // 5. 로컬 상태 업데이트
      setApps(mergedApps);
      setCustomSlots(mergedSlots);
      
      alert('동기화 성공! 다른 기기의 데이터와 현재 기기의 데이터를 하나로 합쳤습니다.');
    } catch (e) {
      console.error(e);
      alert('동기화 실패: 서버 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate || !selectedIndustry) return;
    const formData = new FormData(e.currentTarget);
    const newApp: Application = {
      id: Math.random().toString(36).substr(2, 9),
      date: selectedDate,
      industry: selectedIndustry,
      company: formData.get('company') as string,
      applicant: formData.get('applicant') as string,
      phone: formData.get('phone') as string,
      createdAt: Date.now(),
    };
    if (getRemainingSlots(selectedDate, selectedIndustry) <= 0) return alert('마감되었습니다.');
    setApps(prev => [...prev, newApp]);
    alert('신청이 완료되었습니다.');
    setSelectedDate(null);
    setView('home');
  };

  // --- 렌더링 파트 ---

  const renderCalendar = (mode: 'apply' | 'admin-slots') => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    const targetIndustry = mode === 'apply' ? selectedIndustry! : activeAdminTab;

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-1 sm:p-2"></div>);
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = formatDate(new Date(year, month, d));
      const remaining = getRemainingSlots(dateStr, targetIndustry);
      const total = getTotalSlotsForDate(dateStr, targetIndustry);
      const past = isPastDate(year, month, d);
      const isFull = remaining === 0;
      
      days.push(
        <button key={dateStr} 
          disabled={mode === 'apply' && (past || isFull)} 
          onClick={() => {
            if (mode === 'apply') setSelectedDate(dateStr);
            else {
              const newTotal = prompt(`${dateStr} [${targetIndustry}]의 총 정원을 설정하세요:`, String(total));
              if (newTotal && !isNaN(Number(newTotal))) {
                setCustomSlots(prev => ({ ...prev, [`${targetIndustry}_${dateStr}`]: Number(newTotal) }));
              }
            }
          }}
          className={`flex flex-col items-center p-2 sm:p-3 rounded-xl border-2 transition-all min-h-[70px] sm:min-h-[90px] justify-between ${
            mode === 'apply' && past ? 'bg-gray-50 border-gray-50 text-gray-300 cursor-not-allowed' :
            mode === 'apply' && isFull ? 'bg-red-50 border-red-100 text-red-300 cursor-not-allowed' :
            'bg-white border-blue-50 hover:border-blue-500 hover:shadow-md'
          }`}>
          <span className="text-xs sm:text-sm font-bold self-start">{d}</span>
          <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isFull ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {mode === 'admin-slots' ? `정원 ${total}` : (isFull ? '마감' : `${remaining}/${total}`)}
          </span>
        </button>
      );
    }
    return (
      <div className="w-full max-w-5xl bg-white rounded-[2rem] shadow-xl p-4 sm:p-8 fade-in">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => mode === 'apply' ? setView('home') : setAdminMode('list')} className="p-2 text-gray-400 hover:text-gray-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div className="flex items-center gap-6">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
            <div className="text-center">
              <h2 className="text-2xl font-black text-gray-900">{year}년 {month + 1}월</h2>
              <span className="text-xs text-blue-600 font-black tracking-widest uppercase">{targetIndustry} {mode === 'admin-slots' && 'LIMIT SETTING'}</span>
            </div>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
          <div className="w-10"></div>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4 text-center text-xs font-black text-gray-300 uppercase tracking-tighter">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{days}</div>
        {mode === 'admin-slots' && <p className="mt-6 text-center text-xs text-gray-400 font-medium">※ 날짜를 클릭하여 해당 산업군의 예약 정원을 변경하세요.</p>}
      </div>
    );
  };

  const renderAdmin = () => {
    if (!isAdminAuthenticated) return (
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-10 text-center fade-in mt-20 mx-4">
        <h2 className="text-2xl font-black mb-8 text-gray-900">관리자 모드</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (adminPassword === '1234') setIsAdminAuthenticated(true); else alert('비밀번호가 일치하지 않습니다.'); }} className="space-y-4">
          <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-50 rounded-2xl text-center text-xl tracking-[0.5em] outline-none focus:border-blue-500 transition-all" placeholder="PASSWORD" autoFocus />
          <button type="submit" className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-lg hover:bg-black transition-all">접속하기</button>
          <button type="button" onClick={() => setView('home')} className="text-sm text-gray-400 font-bold hover:text-gray-600 pt-2">홈으로 돌아가기</button>
        </form>
      </div>
    );

    if (adminMode === 'slots') return <div className="w-full flex flex-col items-center px-4 py-8">{renderCalendar('admin-slots')}</div>;

    return (
      <div className="w-full max-w-6xl p-4 sm:p-6 fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div>
            <h2 className="text-3xl font-black text-gray-900">신청 관리 센터</h2>
            <p className="text-sm text-gray-500 font-bold">전체 {apps.length}건의 데이터가 관리 중입니다.</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button onClick={handleGlobalSync} className="flex-1 sm:flex-none px-6 py-3 bg-purple-600 text-white rounded-2xl font-black shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              클라우드 동기화
            </button>
            <button onClick={() => setAdminMode('slots')} className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700">정원 설정</button>
            <button onClick={() => { setView('home'); setIsAdminAuthenticated(false); }} className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200">로그아웃</button>
          </div>
        </div>
        
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {INDUSTRIES.map(tab => (
            <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`px-8 py-4 rounded-[1.5rem] font-black whitespace-nowrap transition-all ${activeAdminTab === tab ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white text-gray-400 border-2 border-transparent hover:border-gray-100'}`}>{tab}</button>
          ))}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-gray-50/50 border-b text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Company</th><th className="px-8 py-5">Name</th><th className="px-8 py-5">Contact</th><th className="px-8 py-5 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {apps.filter(a => a.industry === activeAdminTab).sort((a,b) => b.createdAt - a.createdAt).map(app => (
                  <tr key={app.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-8 py-5 font-black text-blue-600">{app.date}</td>
                    <td className="px-8 py-5 font-bold text-gray-900">{app.company}</td>
                    <td className="px-8 py-5 font-medium text-gray-700">{app.applicant}</td>
                    <td className="px-8 py-5 text-gray-400 text-sm">{app.phone}</td>
                    <td className="px-8 py-5 text-center">
                      <button onClick={() => setEditingApp(app)} className="p-2.5 text-blue-400 hover:bg-blue-100 rounded-xl mr-2 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                      <button onClick={() => { if(confirm('이 신청 내역을 삭제할까요?')) setApps(apps.filter(x => x.id !== app.id)); }} className="p-2.5 text-red-400 hover:bg-red-100 rounded-xl transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {apps.filter(a => a.industry === activeAdminTab).length === 0 && <div className="py-24 text-center text-gray-300 font-bold">아직 신청 내역이 없습니다.</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] w-full flex flex-col items-center font-sans overflow-x-hidden">
      {/* 동기화 중 오버레이 */}
      {isSyncing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[999] flex flex-col items-center justify-center fade-in">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl font-black text-purple-700">데이터 동기화 중...</h3>
          <p className="text-sm text-gray-400 mt-2">서버와 연결하여 기기 간 데이터를 합치고 있습니다.</p>
        </div>
      )}

      {view === 'home' && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 fade-in relative w-full">
          <button onClick={() => { setView('admin'); setAdminPassword(''); }} className="absolute top-8 right-8 p-4 text-gray-200 hover:text-gray-400 transition-all scale-125">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </button>
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 tracking-tight">안전교육 신청</h1>
            <p className="text-gray-400 font-bold text-lg">산업군을 선택하여 교육을 예약하세요.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl mb-20 px-4">
            {INDUSTRIES.map(industry => (
              <button key={industry} onClick={() => { setSelectedIndustry(industry); setCurrentDate(new Date()); setView('apply'); }}
                className="group h-44 sm:h-52 bg-white rounded-[2.5rem] border-2 border-gray-50 flex flex-col items-center justify-center shadow-sm hover:shadow-2xl hover:border-blue-500 transition-all hover:-translate-y-2">
                <div className="w-16 h-16 mb-4 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all scale-110">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <span className="text-xl font-black text-gray-800 tracking-tight">{industry}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setView('search'); setSearchResults(null); }} className="w-full max-w-md py-5 bg-white border-2 border-gray-100 text-gray-500 font-black rounded-3xl hover:bg-gray-50 transition-all shadow-md flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            조회하기
          </button>
        </div>
      )}

      {view === 'apply' && (
        <div className="flex flex-col items-center w-full px-4 sm:px-6 py-12">
          {!selectedDate ? renderCalendar('apply') : (
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-10 fade-in">
              <button onClick={() => setSelectedDate(null)} className="mb-6 text-gray-400 font-bold flex items-center gap-2 hover:text-gray-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg> 날짜 다시 선택</button>
              <h3 className="text-3xl font-black mb-1 text-gray-900">{selectedDate}</h3>
              <p className="text-sm text-blue-600 font-black mb-10 tracking-widest uppercase">{selectedIndustry} (REMAINING: {getRemainingSlots(selectedDate, selectedIndustry!)}석)</p>
              <form onSubmit={handleApply} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300 uppercase ml-2 tracking-widest">Company Name</label>
                  <input required name="company" className="w-full px-5 py-5 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:bg-white focus:border-blue-500 outline-none transition-all font-bold" placeholder="회사명을 입력하세요" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300 uppercase ml-2 tracking-widest">Applicant Name</label>
                  <input required name="applicant" className="w-full px-5 py-5 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:bg-white focus:border-blue-500 outline-none transition-all font-bold" placeholder="신청자 성함을 입력하세요" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300 uppercase ml-2 tracking-widest">Phone Number</label>
                  <input required name="phone" className="w-full px-5 py-5 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:bg-white focus:border-blue-500 outline-none transition-all font-bold" placeholder="연락처를 입력하세요" />
                </div>
                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl hover:bg-blue-700 transition-all mt-4 text-lg">신청 등록</button>
              </form>
            </div>
          )}
        </div>
      )}

      {view === 'admin' && renderAdmin()}

      {/* 수정 모달 */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black mb-8">내역 수정</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setApps(apps.map(a => a.id === editingApp.id ? { ...a, company: f.get('c') as string, applicant: f.get('a') as string, phone: f.get('p') as string } : a));
              setEditingApp(null);
              alert('수정되었습니다.');
            }} className="space-y-5">
              <input required name="c" defaultValue={editingApp.company} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl outline-none focus:border-blue-500 font-bold" />
              <input required name="a" defaultValue={editingApp.applicant} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl outline-none focus:border-blue-500 font-bold" />
              <input required name="p" defaultValue={editingApp.phone} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl outline-none focus:border-blue-500 font-bold" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingApp(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-gray-500">취소</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'search' && (
         <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 w-full fade-in">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10">
               <button onClick={() => setView('home')} className="mb-8 text-gray-400 font-bold flex items-center gap-2 hover:text-gray-900"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg> 돌아가기</button>
               <h2 className="text-3xl font-black mb-10 text-gray-900">신청 내역 조회</h2>
               <div className="space-y-5">
                  <input value={searchName} onChange={e => setSearchName(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-50 rounded-3xl outline-none focus:border-blue-500 transition-all font-bold" placeholder="신청자 이름" />
                  <input value={searchPhone} onChange={e => setSearchPhone(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-50 rounded-3xl outline-none focus:border-blue-500 transition-all font-bold" placeholder="연락처 뒤 4자리 또는 전체" />
                  <button onClick={() => {
                    setSearchResults(apps.filter(a => a.applicant === searchName && (a.phone === searchPhone || a.phone.endsWith(searchPhone))));
                  }} className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl shadow-xl mt-4">조회하기</button>
               </div>
               {searchResults && (
                 <div className="mt-10 space-y-4">
                   {searchResults.map(a => (
                     <div key={a.id} className="p-6 bg-blue-50 rounded-[1.5rem] border-2 border-blue-100">
                       <div className="text-[10px] text-blue-600 font-black mb-1 uppercase tracking-widest">{a.date} ({a.industry})</div>
                       <div className="font-black text-gray-900 text-xl mb-1">{a.company}</div>
                       <div className="text-sm text-gray-500 font-medium">{a.applicant} | {a.phone}</div>
                     </div>
                   ))}
                   {searchResults.length === 0 && <div className="text-center text-gray-300 py-16 font-bold">검색 결과가 없습니다.</div>}
                 </div>
               )}
            </div>
         </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);