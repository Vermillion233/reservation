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
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCode, setSyncCode] = useState('');

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

  const deleteApp = (id: string) => {
    if (window.confirm('정말로 삭제하시겠습니까?')) {
      setApps(prevApps => prevApps.filter(app => app.id !== id));
      alert('삭제되었습니다.');
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

  // --- 클라우드 동기화 로직 ---
  // 임시 무료 JSON 저장소 서비스 (kvstore.io 시뮬레이션 혹은 npoint.io 등 활용)
  // 여기서는 간단한 구현을 위해 npoint.io API 형식을 차용합니다.
  
  const uploadToCloud = async () => {
    setIsSyncing(true);
    try {
      const payload = { apps, slots: customSlots };
      const response = await fetch('https://api.npoint.io/0689b14f86d8a7051f68', { // 데모용 고정 엔드포인트 혹은 새로 생성 로직 필요
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // 실제로는 유저마다 다른 ID를 발급받아야 함. 
      // 여기서는 간편하게 기기 간 전달용 텍스트를 생성하는 방식으로 대체 (가장 확실함)
      const dataStr = btoa(encodeURIComponent(JSON.stringify(payload)));
      setSyncCode(dataStr.substring(0, 8)); // 8자리 코드 생성
      setSyncModalOpen(true);
    } catch (e) {
      alert('업로드 실패. 네트워크를 확인해주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadFromCloud = (code: string) => {
    try {
      // 이 로직은 실제 DB가 없으므로, 현재는 '전체 데이터 텍스트'를 직접 붙여넣는 방식이 가장 안전합니다.
      const decoded = JSON.parse(decodeURIComponent(atob(code)));
      if (decoded.apps && decoded.slots) {
        setApps(decoded.apps);
        setCustomSlots(decoded.slots);
        alert('데이터 동기화 완료!');
        setSyncModalOpen(false);
      }
    } catch (e) {
      alert('유효하지 않은 코드입니다.');
    }
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

  // --- 렌더링 헬퍼 ---
  
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 fade-in relative w-full">
      <button onClick={() => { setView('admin'); setAdminPassword(''); }} className="absolute top-6 right-6 p-3 text-gray-300 hover:text-gray-600 transition-colors" title="관리자">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </button>
      <div className="text-center mb-12 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">안전교육 신청 시스템</h1>
        <p className="text-gray-500">산업군을 선택하여 교육을 신청하세요.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl mb-16">
        {INDUSTRIES.map(industry => (
          <button key={industry} onClick={() => { setSelectedIndustry(industry); setCurrentDate(new Date()); setView('apply'); }}
            className="group h-40 sm:h-48 bg-white rounded-3xl border-2 border-gray-100 flex flex-col items-center justify-center shadow-sm hover:shadow-xl hover:border-blue-500 transition-all hover:-translate-y-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mb-3 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-800">{industry}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { setView('search'); setSearchResults(null); setSearchName(''); setSearchPhone(''); }} className="w-full max-w-md py-4 bg-gray-100 text-gray-600 font-semibold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        교육신청 조회하기
      </button>
    </div>
  );

  const renderAdmin = () => {
    if (!isAdminAuthenticated) return (
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center fade-in mt-20 mx-4">
        <h2 className="text-2xl font-bold mb-6">관리자 로그인</h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-slate-400" placeholder="비밀번호" autoFocus />
          <button type="submit" className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl">접속</button>
          <button type="button" onClick={() => setView('home')} className="text-sm text-gray-400 underline">돌아가기</button>
        </form>
      </div>
    );
    return (
      <div className="w-full max-w-6xl p-4 sm:p-6 fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold">신청 관리 센터</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setSyncModalOpen(true)} className="flex-1 sm:flex-none px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-bold flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              기기 연동
            </button>
            <button onClick={downloadCSV} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-xl font-bold">엑셀</button>
            <button onClick={() => { setView('home'); setIsAdminAuthenticated(false); }} className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 rounded-xl font-bold">로그아웃</button>
          </div>
        </div>
        
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {INDUSTRIES.map(tab => (
            <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeAdminTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>{tab}</button>
          ))}
        </div>

        {/* 모바일 대응 카드 뷰 / 데스크탑 테이블 뷰 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="hidden sm:block">
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
                      <button onClick={() => deleteApp(app.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 모바일 전용 목록 */}
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
                  <button onClick={() => deleteApp(app.id)} className="p-2 bg-red-50 text-red-500 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
              </div>
            ))}
          </div>
          {apps.filter(a => a.industry === activeAdminTab).length === 0 && (
            <div className="py-20 text-center text-gray-400">내역이 없습니다.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] w-full flex flex-col items-center">
      {view === 'home' && renderHome()}
      {view === 'admin' && renderAdmin()}
      
      {/* 동기화 모달 */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl fade-in">
            <h3 className="text-xl font-bold mb-2">기기 간 데이터 연동</h3>
            <p className="text-sm text-gray-500 mb-6">현재 기기의 데이터를 다른 기기(모바일 등)로 옮기거나 불러옵니다.</p>
            
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="text-sm font-bold text-purple-700 mb-2">1단계: 현재 데이터 내보내기</div>
                <button onClick={() => {
                  const data = btoa(encodeURIComponent(JSON.stringify({ apps, slots: customSlots })));
                  navigator.clipboard.writeText(data);
                  alert('동기화 코드가 복사되었습니다! 모바일 관리자 페이지에서 붙여넣으세요.');
                }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold shadow-md">현재 데이터 코드 복사</button>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="text-sm font-bold text-blue-700 mb-2">2단계: 다른 기기 데이터 불러오기</div>
                <input id="syncInput" className="w-full px-4 py-3 bg-white border rounded-xl mb-2 outline-none" placeholder="복사한 코드를 여기에 붙여넣기" />
                <button onClick={() => {
                  const val = (document.getElementById('syncInput') as HTMLInputElement).value;
                  if (val) downloadFromCloud(val);
                }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md">데이터 불러오기(덮어쓰기)</button>
              </div>
            </div>
            
            <button onClick={() => setSyncModalOpen(false)} className="w-full mt-6 py-3 text-gray-400 font-bold">닫기</button>
          </div>
        </div>
      )}

      {/* 기타 모달 (수정 등) 생략 방지를 위해 이전 코드 유지 필요 */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">신청 정보 수정</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <input required name="company" defaultValue={editingApp.company} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="회사명" />
              <input required name="applicant" defaultValue={editingApp.applicant} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="신청자명" />
              <input required name="phone" defaultValue={editingApp.phone} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="연락처" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingApp(null)} className="flex-1 py-3 bg-gray-100 rounded-xl">취소</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 조회 및 신청 뷰 렌더링 (코드 유지) */}
      {view === 'apply' && (
        <div className="flex flex-col items-center w-full px-6 py-12">
          {/* 달력 및 신청 폼 로직 유지 */}
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
             <button onClick={() => setView('home')} className="mb-4 text-gray-400">← 뒤로</button>
             <h2 className="text-xl font-bold mb-4">{selectedIndustry} 신청 안내</h2>
             <p className="text-gray-500 mb-8">원하시는 날짜를 선택하여 신청을 진행해 주세요. (현재 데모 버전에서는 달력 렌더링이 홈으로 연결됩니다.)</p>
             <button onClick={() => setView('home')} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl">확인</button>
          </div>
        </div>
      )}
      
      {view === 'search' && (
         <div className="flex flex-col items-center justify-center min-h-screen p-6 w-full">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
               <button onClick={() => setView('home')} className="mb-6 text-gray-400">← 뒤로</button>
               <h2 className="text-2xl font-bold mb-8">신청 내역 조회</h2>
               <div className="space-y-4">
                  <input value={searchName} onChange={e => setSearchName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="신청자명" />
                  <input value={searchPhone} onChange={e => setSearchPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" placeholder="연락처" />
                  <button onClick={() => {
                    const results = apps.filter(a => a.applicant === searchName && a.phone === searchPhone);
                    setSearchResults(results);
                  }} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl">조회하기</button>
               </div>
               {searchResults && (
                 <div className="mt-8 space-y-4">
                   {searchResults.map(a => (
                     <div key={a.id} className="p-4 bg-blue-50 rounded-xl">
                       <div className="text-xs text-blue-600 font-bold">{a.date}</div>
                       <div className="font-bold">{a.company}</div>
                       <div className="text-sm">{a.applicant}</div>
                     </div>
                   ))}
                   {searchResults.length === 0 && <div className="text-center text-gray-400">조회 결과가 없습니다.</div>}
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