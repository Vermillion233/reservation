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
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // 로컬 스토리지 로드
  useEffect(() => {
    const savedApps = localStorage.getItem('app_bookings');
    const savedSlots = localStorage.getItem('app_custom_slots_v2'); 
    if (savedApps) setApps(JSON.parse(savedApps));
    if (savedSlots) setCustomSlots(JSON.parse(savedSlots));
  }, []);

  // 로컬 스토리지 저장
  useEffect(() => {
    localStorage.setItem('app_bookings', JSON.stringify(apps));
  }, [apps]);

  useEffect(() => {
    localStorage.setItem('app_custom_slots_v2', JSON.stringify(customSlots));
  }, [customSlots]);

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

  // 병합 동기화 로직 (Merge)
  const mergeData = (code: string) => {
    try {
      const incoming = JSON.parse(decodeURIComponent(atob(code)));
      if (!incoming.apps || !incoming.slots) throw new Error();

      // 1. 신청 내역 병합 (ID 중복 제거)
      const combinedApps = [...apps, ...incoming.apps];
      const uniqueApps = combinedApps.filter((app, index, self) =>
        index === self.findIndex((t) => t.id === app.id)
      );

      // 2. 정원 설정 병합 (값이 다를 경우 더 큰 값이나 최신 값 선택 - 여기선 수동 설정 우선)
      const mergedSlots = { ...customSlots, ...incoming.slots };

      setApps(uniqueApps);
      setCustomSlots(mergedSlots);
      
      const newCount = uniqueApps.length - apps.length;
      alert(`동기화 성공!\n새로운 신청 내역 ${newCount}건이 추가되었습니다.`);
      setSyncModalOpen(false);
    } catch (e) {
      alert('유효하지 않은 코드입니다. 코드를 다시 확인해주세요.');
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

    if (getRemainingSlots(selectedDate, selectedIndustry) <= 0) {
      alert('해당 날짜는 이미 마감되었습니다.');
      return;
    }

    setApps(prev => [...prev, newApp]);
    alert('신청이 완료되었습니다.');
    setSelectedDate(null);
    setSelectedIndustry(null);
    setView('home');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '1234') {
      setIsAdminAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
      setAdminPassword('');
    }
  };

  // --- 렌더링 파트 ---

  const renderCalendar = (mode: 'apply' | 'admin-slots' = 'apply') => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-1 sm:p-2"></div>);
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = formatDate(new Date(year, month, d));
      const targetIndustry = mode === 'apply' ? selectedIndustry! : activeAdminTab;
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
              const newTotal = prompt(`${dateStr} [${targetIndustry}]의 총 정원을 입력하세요:`, String(total));
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
          <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {mode === 'admin-slots' ? `정원: ${total}` : (isFull ? '마감' : `${remaining}/${total}`)}
          </span>
        </button>
      );
    }
    return (
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl p-4 sm:p-8 fade-in">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => mode === 'apply' ? setView('home') : setAdminMode('list')} className="text-gray-400 hover:text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>뒤로
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
            <div className="text-center min-w-[120px]">
              <h2 className="text-xl font-bold">{year}년 {month + 1}월</h2>
              <span className="text-xs text-blue-600 font-bold">[{mode === 'apply' ? selectedIndustry : activeAdminTab}]</span>
            </div>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
          <div className="w-10"></div>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-gray-400">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{days}</div>
        {mode === 'admin-slots' && <p className="mt-4 text-center text-sm text-gray-400">※ 날짜를 클릭하면 해당 일자의 정원을 변경할 수 있습니다.</p>}
      </div>
    );
  };

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 fade-in relative w-full">
      <button onClick={() => { setView('admin'); setAdminPassword(''); }} className="absolute top-6 right-6 p-3 text-gray-300 hover:text-gray-600 transition-colors" title="관리자">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </button>
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">안전교육 신청 시스템</h1>
        <p className="text-gray-500">산업군을 선택하여 교육을 신청하세요.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl mb-16 px-4">
        {INDUSTRIES.map(industry => (
          <button key={industry} onClick={() => { setSelectedIndustry(industry); setCurrentDate(new Date()); setView('apply'); }}
            className="group h-40 sm:h-48 bg-white rounded-3xl border-2 border-gray-100 flex flex-col items-center justify-center shadow-sm hover:shadow-xl hover:border-blue-500 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 mb-3 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-800">{industry}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { setView('search'); setSearchResults(null); setSearchName(''); setSearchPhone(''); }} className="w-full max-w-md py-4 bg-gray-100 text-gray-600 font-semibold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mx-4">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        교육신청 조회하기
      </button>
    </div>
  );

  const renderAdmin = () => {
    if (!isAdminAuthenticated) return (
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center fade-in mt-20 mx-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">관리자 로그인</h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-blue-500" placeholder="비밀번호" autoFocus />
          <button type="submit" className="w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition-colors">접속</button>
          <button type="button" onClick={() => setView('home')} className="text-sm text-gray-400 underline">돌아가기</button>
        </form>
      </div>
    );

    if (adminMode === 'slots') return (
      <div className="w-full flex flex-col items-center px-4 py-8">
        {renderCalendar('admin-slots')}
      </div>
    );

    return (
      <div className="w-full max-w-6xl p-4 sm:p-6 fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">신청 관리 센터</h2>
            <p className="text-sm text-gray-400">총 {apps.length}건의 신청 내역이 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setSyncModalOpen(true)} className="flex-1 sm:flex-none px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-bold flex items-center justify-center gap-1 border border-purple-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
              병합 동기화
            </button>
            <button onClick={() => setAdminMode('slots')} className="flex-1 sm:flex-none px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold border border-blue-200">정원 설정</button>
            <button onClick={() => { setView('home'); setIsAdminAuthenticated(false); }} className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">종료</button>
          </div>
        </div>
        
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {INDUSTRIES.map(tab => (
            <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeAdminTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>{tab}</button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                <tr><th className="px-6 py-4">교육일자</th><th className="px-6 py-4">회사명</th><th className="px-6 py-4">신청자</th><th className="px-6 py-4">연락처</th><th className="px-6 py-4 text-center">작업</th></tr>
              </thead>
              <tbody className="divide-y">
                {apps.filter(a => a.industry === activeAdminTab).sort((a,b) => b.createdAt - a.createdAt).map(app => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-blue-600">{app.date}</td>
                    <td className="px-6 py-4">{app.company}</td>
                    <td className="px-6 py-4">{app.applicant}</td>
                    <td className="px-6 py-4 text-gray-600">{app.phone}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setEditingApp(app)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg mr-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                      <button onClick={() => { if(confirm('삭제하시겠습니까?')) setApps(apps.filter(x => x.id !== app.id)); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y">
            {apps.filter(a => a.industry === activeAdminTab).sort((a,b) => b.createdAt - a.createdAt).map(app => (
              <div key={app.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs text-blue-600 font-bold mb-1">{app.date}</div>
                  <div className="font-bold text-gray-800">{app.company}</div>
                  <div className="text-sm text-gray-500">{app.applicant} | {app.phone}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingApp(app)} className="p-2 bg-blue-50 text-blue-500 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                  <button onClick={() => { if(confirm('삭제하시겠습니까?')) setApps(apps.filter(x => x.id !== app.id)); }} className="p-2 bg-red-50 text-red-500 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
              </div>
            ))}
          </div>
          {apps.filter(a => a.industry === activeAdminTab).length === 0 && (
            <div className="py-20 text-center text-gray-400">신청 내역이 없습니다.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] w-full flex flex-col items-center font-sans">
      {view === 'home' && renderHome()}
      
      {view === 'apply' && (
        <div className="flex flex-col items-center w-full px-4 sm:px-6 py-8 sm:py-12">
          {!selectedDate ? renderCalendar('apply') : (
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 fade-in">
              <div className="flex items-center mb-6">
                <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 mr-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
                <div><h3 className="text-xl font-bold">{selectedDate} 신청</h3><p className="text-sm text-blue-600">[{selectedIndustry}] 잔여 {getRemainingSlots(selectedDate, selectedIndustry!)}석</p></div>
              </div>
              <form onSubmit={handleApply} className="space-y-4">
                <input required name="company" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="회사명" />
                <input required name="applicant" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="신청자명" />
                <input required name="phone" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="연락처 (010-0000-0000)" />
                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all">신청 완료</button>
              </form>
            </div>
          )}
        </div>
      )}

      {view === 'admin' && renderAdmin()}

      {/* 스마트 병합 모달 */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl fade-in">
            <h3 className="text-xl font-bold mb-2 text-gray-800">기기 간 데이터 병합</h3>
            <p className="text-sm text-gray-500 mb-6">PC와 모바일의 데이터를 하나로 합칩니다. 중복 데이터는 자동으로 제거됩니다.</p>
            
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="text-sm font-bold text-purple-700 mb-2">1단계: 이 기기의 데이터 코드 복사</div>
                <button onClick={() => {
                  const data = btoa(encodeURIComponent(JSON.stringify({ apps, slots: customSlots })));
                  navigator.clipboard.writeText(data);
                  alert('코드가 복사되었습니다! 상대 기기에 붙여넣으세요.');
                }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold shadow-md hover:bg-purple-700">현재 데이터 코드 복사</button>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="text-sm font-bold text-blue-700 mb-2">2단계: 상대 기기의 코드 붙여넣기</div>
                <input id="syncInput" className="w-full px-4 py-3 bg-white border rounded-xl mb-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="상대 기기에서 복사한 코드" />
                <button onClick={() => {
                  const val = (document.getElementById('syncInput') as HTMLInputElement).value;
                  if (val) mergeData(val);
                  else alert('코드를 입력해주세요.');
                }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700">데이터 병합하기</button>
              </div>
            </div>
            
            <button onClick={() => setSyncModalOpen(false)} className="w-full mt-6 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors">닫기</button>
          </div>
        </div>
      )}

      {/* 수정 및 조회 로직은 이전과 동일하게 유지 */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">신청 정보 수정</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setApps(apps.map(a => a.id === editingApp.id ? { ...a, company: f.get('c') as string, applicant: f.get('a') as string, phone: f.get('p') as string } : a));
              setEditingApp(null);
              alert('수정되었습니다.');
            }} className="space-y-4">
              <input required name="c" defaultValue={editingApp.company} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="회사명" />
              <input required name="a" defaultValue={editingApp.applicant} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="신청자명" />
              <input required name="p" defaultValue={editingApp.phone} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="연락처" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingApp(null)} className="flex-1 py-3 bg-gray-100 rounded-xl">취소</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'search' && (
         <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 w-full fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8">
               <button onClick={() => setView('home')} className="mb-6 text-gray-400 flex items-center hover:text-gray-600"><svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>뒤로</button>
               <h2 className="text-2xl font-bold mb-8">신청 내역 조회</h2>
               <div className="space-y-4">
                  <input value={searchName} onChange={e => setSearchName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="신청자명" />
                  <input value={searchPhone} onChange={e => setSearchPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="연락처" />
                  <button onClick={() => {
                    const results = apps.filter(a => a.applicant === searchName && a.phone === searchPhone);
                    setSearchResults(results);
                  }} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">조회하기</button>
               </div>
               {searchResults && (
                 <div className="mt-8 space-y-4">
                   {searchResults.map(a => (
                     <div key={a.id} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                       <div className="text-xs text-blue-600 font-bold">{a.date} ({a.industry})</div>
                       <div className="font-bold">{a.company}</div>
                       <div className="text-sm">{a.applicant} | {a.phone}</div>
                     </div>
                   ))}
                   {searchResults.length === 0 && <div className="text-center text-gray-400 py-8">조회 결과가 없습니다.</div>}
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