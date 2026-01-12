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
  
  // 달력 페이지 제어
  const [currentDate, setCurrentDate] = useState(new Date());

  // 조회 기능을 위한 상태
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<Application[] | null>(null);
  
  // 수정 기능을 위한 상태
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isAdjustingSlots, setIsAdjustingSlots] = useState(false);

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

  // 핸들러 함수들
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

  const handleAdjustSlots = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const industry = formData.get('adjust_industry') as Industry;
    const date = formData.get('adjust_date') as string;
    const slots = parseInt(formData.get('adjust_count') as string);

    if (!industry || !date || isNaN(slots)) return;

    const key = `${industry}_${date}`;
    setCustomSlots(prev => ({ ...prev, [key]: slots }));
    setIsAdjustingSlots(false);
    alert(`${industry} - ${date}의 총 좌석수가 ${slots}석으로 변경되었습니다.`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const results = apps.filter(app => app.applicant === searchName && app.phone === searchPhone);
    setSearchResults(results);
  };

  const deleteApp = (id: string) => {
    if (window.confirm('정말로 삭제하시겠습니까?')) {
      setApps(prevApps => prevApps.filter(app => app.id !== id));
    }
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingApp) return;
    const formData = new FormData(e.currentTarget);
    setApps(prevApps => prevApps.map(app => app.id === editingApp.id ? {
      ...app,
      company: formData.get('company') as string,
      applicant: formData.get('applicant') as string,
      phone: formData.get('phone') as string,
    } : app));
    setEditingApp(null);
    alert('수정이 완료되었습니다.');
  };

  const downloadCSV = () => {
    if (apps.length === 0) return alert('데이터가 없습니다.');
    const headers = ['산업군', '신청일자', '회사명', '신청자', '연락처', '신청시각'];
    const rows = [...apps].sort((a, b) => b.createdAt - a.createdAt).map(app => [
      app.industry, app.date, app.company, app.applicant, app.phone, new Date(app.createdAt).toLocaleString()
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `예약명단_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '1234') {
      setIsAdminAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  // --- 렌더링 헬퍼 ---
  
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 fade-in relative w-full">
      <button onClick={() => { setView('admin'); setAdminPassword(''); }} className="absolute top-6 right-6 p-3 text-gray-300 hover:text-gray-600 transition-colors" title="관리자">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </button>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">안전교육 신청 시스템</h1>
        <p className="text-gray-500">산업군을 선택하여 교육을 신청하세요.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl mb-16">
        {INDUSTRIES.map(industry => (
          <button key={industry} onClick={() => { setSelectedIndustry(industry); setCurrentDate(new Date()); setView('apply'); }}
            className="group h-48 bg-white rounded-3xl border-2 border-gray-100 flex flex-col items-center justify-center shadow-sm hover:shadow-xl hover:border-blue-500 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 mb-3 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <span className="text-xl font-bold text-gray-800">{industry}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { setView('search'); setSearchResults(null); setSearchName(''); setSearchPhone(''); }} className="w-full max-w-md py-4 bg-gray-100 text-gray-600 font-semibold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        교육신청 조회하기
      </button>
    </div>
  );

  const renderSearch = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 fade-in w-full">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <div className="flex items-center mb-8">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 className="text-2xl font-bold">교육신청 조회</h2>
        </div>
        <form onSubmit={handleSearch} className="space-y-4 mb-8">
          <input required value={searchName} onChange={(e) => setSearchName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="신청자명" />
          <input required value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="연락처 (010-0000-0000)" />
          <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all">조회하기</button>
        </form>
        {searchResults && (
          <div className="space-y-4 border-t pt-6">
            {searchResults.length > 0 ? searchResults.map(app => (
              <div key={app.id} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-blue-600">{app.industry}</span>
                  <span className="text-gray-400">{app.date}</span>
                </div>
                <div className="font-bold text-gray-800">{app.company}</div>
                <div className="text-sm text-gray-500">{app.applicant} | {app.phone}</div>
              </div>
            )) : <p className="text-center text-gray-400 py-8">조회된 결과가 없습니다.</p>}
          </div>
        )}
      </div>
    </div>
  );

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-4"></div>);
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = formatDate(new Date(year, month, d));
      const remaining = getRemainingSlots(dateStr, selectedIndustry!);
      const total = getTotalSlotsForDate(dateStr, selectedIndustry!);
      const past = isPastDate(year, month, d);
      const isFull = remaining === 0;
      days.push(
        <button key={dateStr} disabled={past || isFull} onClick={() => setSelectedDate(dateStr)}
          className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all min-h-[100px] justify-between ${
            past ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed' :
            isFull ? 'bg-red-50 border-red-100 text-red-300 cursor-not-allowed' :
            'bg-white border-blue-50 hover:border-blue-500 hover:shadow-md'
          }`}>
          <span className="text-sm font-bold self-start">{d}</span>
          {!past && <span className={`text-[11px] px-2 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{isFull ? '마감' : `${remaining}/${total}`}</span>}
        </button>
      );
    }
    return (
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl p-8 fade-in">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setView('home')} className="text-gray-500 hover:text-gray-800 flex items-center"><svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>뒤로</button>
          <div className="flex items-center gap-6">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
            <div className="text-center min-w-[120px]"><h2 className="text-2xl font-bold">{year}년 {month + 1}월</h2><span className="text-sm text-blue-600 font-bold">[{selectedIndustry}]</span></div>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
          <div className="w-12"></div>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-gray-400">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">{days}</div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (!isAdminAuthenticated) return (
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center fade-in mt-20">
        <h2 className="text-2xl font-bold mb-6">관리자 로그인</h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <input 
            type="password" 
            value={adminPassword} 
            onChange={(e) => setAdminPassword(e.target.value)} 
            className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-slate-400 transition-all" 
            placeholder="비밀번호 입력" 
            autoFocus 
          />
          <button type="submit" className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all">접속</button>
          <button type="button" onClick={() => setView('home')} className="text-sm text-gray-400 underline">돌아가기</button>
        </form>
      </div>
    );
    return (
      <div className="w-full max-w-6xl p-6 fade-in">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">신청 관리 센터</h2>
          <div className="flex gap-2">
            <button onClick={() => setIsAdjustingSlots(true)} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold">잔여석 조정</button>
            <button onClick={downloadCSV} className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold">엑셀 다운로드</button>
            <button onClick={() => { setView('home'); setIsAdminAuthenticated(false); setAdminPassword(''); }} className="px-4 py-2 bg-gray-200 rounded-xl font-bold">로그아웃</button>
          </div>
        </div>
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {INDUSTRIES.map(tab => (
            <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeAdminTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>{tab}</button>
          ))}
        </div>
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
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
                    <button onClick={() => setEditingApp(app)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg mr-2" title="수정"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onClick={() => deleteApp(app.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="삭제"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                  </td>
                </tr>
              ))}
              {apps.filter(a => a.industry === activeAdminTab).length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">신청 내역이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- 메인 렌더링 ---
  return (
    <div className="min-h-screen bg-[#f8fafc] w-full flex flex-col items-center">
      {view === 'home' && renderHome()}
      {view === 'search' && renderSearch()}
      {view === 'apply' && (
        <div className="flex flex-col items-center w-full px-6 py-12">
          {!selectedDate ? renderCalendar() : (
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 fade-in">
              <div className="flex items-center mb-6">
                <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 mr-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
                <div><h3 className="text-xl font-bold">{selectedDate} 신청</h3><p className="text-sm text-blue-600">[{selectedIndustry}] 잔여 {getRemainingSlots(selectedDate, selectedIndustry!)}석</p></div>
              </div>
              <form onSubmit={handleApply} className="space-y-4">
                <input required name="company" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="회사명" />
                <input required name="applicant" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="신청자명" />
                <input required name="phone" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="연락처 (010-0000-0000)" />
                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all">신청 완료</button>
              </form>
            </div>
          )}
        </div>
      )}
      {view === 'admin' && renderAdmin()}

      {/* 모달 레이어 (수정/조정) */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">신청 정보 수정</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <input required name="company" defaultValue={editingApp.company} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="회사명" />
              <input required name="applicant" defaultValue={editingApp.applicant} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="신청자명" />
              <input required name="phone" defaultValue={editingApp.phone} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="연락처" />
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setEditingApp(null)} className="flex-1 py-3 bg-gray-100 rounded-xl">취소</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">저장</button></div>
            </form>
          </div>
        </div>
      )}
      {isAdjustingSlots && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">잔여석 수동 조정</h3>
            <form onSubmit={handleAdjustSlots} className="space-y-4">
              <select required name="adjust_industry" className="w-full px-4 py-3 bg-gray-50 border rounded-xl">{INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</select>
              <input required type="date" name="adjust_date" className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
              <input required type="number" name="adjust_count" min="0" className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="총 좌석수 (예: 30)" />
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsAdjustingSlots(false)} className="flex-1 py-3 bg-gray-100 rounded-xl">취소</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">설정 저장</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);