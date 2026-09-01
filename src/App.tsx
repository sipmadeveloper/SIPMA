/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  User as UserType,
  StudentProfile,
  Application,
  ParentData,
  SchoolOrigin,
  AddressData,
  DocumentItem,
  School,
  AuditLog,
  Announcement,
  SystemSettings,
  UserRole,
  VerificationStatus,
} from './types/sipma';
import { storageService } from './services/storageService';
import { Navbar } from './components/layout/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { StudentDashboard } from './components/student/StudentDashboard';
import { SchoolDashboard } from './components/admin-school/SchoolDashboard';
import { CentralDashboard } from './components/admin-central/CentralDashboard';
import { PrintBuktiPendaftaran } from './components/student/PrintBuktiPendaftaran';
import { AdminProfileModal } from './components/common/AdminProfileModal';
import { AppSplashScreen } from './components/common/LoadingScreen';
import { CheckCircle2, Clock, XCircle, Search, X, Printer, MapPin, School as SchoolIcon, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { formatDistanceIndonesian } from './utils/geo';
import { exportApplicantsToExcel } from './utils/excelExport';
import { updateAppFavicon } from './utils/favicon';
import { useFeedback } from './context/FeedbackContext';
import {
  AppRoute,
  CentralTab,
  getInitialRoute,
  hashToRoute,
  navigateToRoute,
} from './utils/router';

type ViewMode = 'landing' | 'login' | 'register' | 'app' | 'print_preview';

export default function App() {
  const { showAlert, showToast, showLoading, hideLoading } = useFeedback();
  const [isAppInitialLoading, setIsAppInitialLoading] = useState<boolean>(true);

  // Initialize currentUser from storage synchronously
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    return storageService.getCurrentUser();
  });

  // Initialize route from current URL hash and localStorage
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const user = storageService.getCurrentUser();
    return getInitialRoute(user?.role);
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const user = storageService.getCurrentUser();
    const initialRoute = getInitialRoute(user?.role);
    return initialRoute.viewMode;
  });

  const [printRegNumber, setPrintRegNumber] = useState<string | null>(() => {
    const user = storageService.getCurrentUser();
    const initialRoute = getInitialRoute(user?.role);
    return initialRoute.printRegNumber || null;
  });

  // Centralized Navigation Handler
  const navigate = useCallback((target: Partial<AppRoute> | ViewMode) => {
    let nextRoute: AppRoute;
    if (typeof target === 'string') {
      if (target === 'app') {
        const user = storageService.getCurrentUser();
        nextRoute = {
          viewMode: 'app',
          centralTab: user?.role === 'admin_pusat' ? (currentRoute.centralTab || 'overview') : undefined,
          schoolTab: user?.role === 'admin_sekolah' ? (currentRoute.schoolTab || 'overview') : undefined,
          studentTab: user?.role === 'calon_murid' ? (currentRoute.studentTab || 'overview') : undefined,
        };
      } else {
        nextRoute = { viewMode: target };
      }
    } else {
      nextRoute = {
        ...currentRoute,
        ...target,
      };
    }

    setCurrentRoute(nextRoute);
    setViewMode(nextRoute.viewMode);
    if (nextRoute.printRegNumber !== undefined) {
      setPrintRegNumber(nextRoute.printRegNumber || null);
    }
    navigateToRoute(nextRoute);
  }, [currentRoute]);

  const updateViewMode = useCallback((newMode: ViewMode) => {
    navigate(newMode);
  }, [navigate]);

  // Handle browser back/forward and hash changes
  useEffect(() => {
    const handleLocationChange = () => {
      const user = storageService.getCurrentUser();
      const parsed = hashToRoute(window.location.hash, user?.role);
      setCurrentRoute(parsed);
      setViewMode(parsed.viewMode);
      if (parsed.printRegNumber) {
        setPrintRegNumber(parsed.printRegNumber);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Initial URL sync if hash is not set
    if (!window.location.hash) {
      navigateToRoute(currentRoute, true);
    }

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // App Data State - Initialize synchronously to prevent empty/undefined state on initial render
  const [schools, setSchools] = useState<School[]>(() => storageService.getSchools());
  const [applications, setApplications] = useState<Application[]>(() => storageService.getApplications());
  const [students, setStudents] = useState<Record<string, StudentProfile>>(() => storageService.getStudentsMap());
  const [parents, setParents] = useState<Record<string, ParentData>>(() => storageService.getParentsMap());
  const [schoolOrigins, setSchoolOrigins] = useState<Record<string, SchoolOrigin>>(() => storageService.getSchoolOriginsMap());
  const [addresses, setAddresses] = useState<Record<string, AddressData>>(() => storageService.getAddressesMap());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => storageService.getDocuments());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => storageService.getAuditLogs());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => storageService.getAnnouncements());
  const [settings, setSettings] = useState<SystemSettings>(() => storageService.getSettings());

  // Search Status Modal State
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchResultApp, setSearchResultApp] = useState<Application | null>(null);
  const [searchResultStudent, setSearchResultStudent] = useState<StudentProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Load all initial data from storageService
  const refreshData = useCallback(() => {
    const schList = storageService.getSchools();
    const appList = storageService.getApplications();
    const stuMap = storageService.getStudentsMap();
    const parMap = storageService.getParentsMap();
    const oriMap = storageService.getSchoolOriginsMap();
    const addrMap = storageService.getAddressesMap();
    const docList = storageService.getDocuments();
    const logList = storageService.getAuditLogs();
    const ancList = storageService.getAnnouncements();
    const setObj = storageService.getSettings();

    setSchools(schList);
    setApplications(appList);
    setStudents(stuMap);
    setParents(parMap);
    setSchoolOrigins(oriMap);
    setAddresses(addrMap);
    setDocuments(docList);
    setAuditLogs(logList);
    setAnnouncements(ancList);
    setSettings(setObj);
  }, []);

  useEffect(() => {
    refreshData();
    const user = storageService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    const unsubscribe = storageService.subscribe(() => {
      refreshData();
    });

    // Initial Splash Screen loading timer to allow data synchronization
    const timer = setTimeout(() => {
      setIsAppInitialLoading(false);
    }, 600);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [refreshData]);

  // Sync Favicon and Document Title dynamically with central admin settings
  useEffect(() => {
    updateAppFavicon(settings?.app_logo);
    if (settings?.app_name) {
      document.title = `${settings.app_name} - ${settings.app_tagline || 'Sistem Penerimaan Murid Madrasah'}`;
    }
  }, [settings?.app_logo, settings?.app_name, settings?.app_tagline]);

  // Auth actions
  const handleLogin = (email: string, role: UserRole) => {
    showLoading('Memuat sesi akun Anda...');
    setTimeout(() => {
      const users = storageService.getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (user) {
        user.role = role;
        localStorage.setItem('sipma_users', JSON.stringify(users));
        setCurrentUser(user);
        storageService.setCurrentUser(user);
      } else {
        // Fallback for new verified registration
        const newUser: UserType = {
          user_id: `USR-${Date.now()}`,
          email,
          name: email.split('@')[0],
          role,
          phone: '081234567890',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        users.push(newUser);
        localStorage.setItem('sipma_users', JSON.stringify(users));
        setCurrentUser(newUser);
        storageService.setCurrentUser(newUser);
      }

      updateViewMode('app');
      refreshData();
      hideLoading();
      showToast(`Selamat datang di portal PPDB Madrasah!`, 'success');
    }, 400);
  };

  const handleLogout = () => {
    showLoading('Keluar dari sistem...');
    setTimeout(() => {
      setCurrentUser(null);
      storageService.setCurrentUser(null);
      updateViewMode('landing');
      hideLoading();
      showToast('Anda telah berhasil keluar dari akun.', 'info');
    }, 300);
  };

  // Status Search from Landing Page
  const handleCheckStatus = (query: string) => {
    if (!query) return;
    showLoading('Mencari data pendaftaran...');
    setTimeout(() => {
      hideLoading();
      const q = (query || '').toLowerCase().trim();
      let matchedApp = applications.find(
        (a) => (a.registration_number?.toLowerCase() || '') === q
      );

      if (!matchedApp) {
        const studentList = Object.values(students) as StudentProfile[];
        const matchedStudent = studentList.find(
          (s) =>
            (s.nik || '') === q ||
            (s.nisn || '') === q ||
            (s.name?.toLowerCase() || '').includes(q)
        );
        if (matchedStudent) {
          matchedApp = applications.find(
            (a) => a.registration_number === matchedStudent.registration_number
          );
        }
      }

      if (matchedApp) {
        setSearchResultApp(matchedApp);
        setSearchResultStudent(students[matchedApp.registration_number] || null);
        setSearchModalOpen(true);
      } else {
        showAlert(
          'Data Tidak Ditemukan',
          `Nomor pendaftaran atau NIK "${query}" tidak ditemukan dalam sistem. Pastikan Anda memasukkan nomor pendaftaran (misal: SIPMA-MAN01-000001) atau NIK yang benar saat mendaftar.`,
          'warning'
        );
      }
    }, 350);
  };

  // Verification from admin
  const handleVerify = (regNumber: string, status: VerificationStatus, notes: string) => {
    showLoading('Menyimpan status verifikasi berkas...');
    setTimeout(() => {
      if (status !== 'menunggu') {
        storageService.verifyApplication(regNumber, status, notes, currentUser?.email || 'admin@madrasah.sch.id');
      }
      refreshData();
      hideLoading();
      showToast('Status verifikasi berkas pendaftar berhasil diperbarui.', 'success');
    }, 300);
  };

  // Selection update
  const handleUpdateSelection = (regNumber: string, status: 'lulus' | 'tidak_lulus' | 'menunggu') => {
    showLoading('Memperbarui status seleksi akhir...');
    setTimeout(() => {
      storageService.updateSelectionStatus(regNumber, status, currentUser?.email || 'admin@madrasah.sch.id');
      refreshData();
      hideLoading();
      showToast('Status seleksi pendaftar berhasil diperbarui.', 'success');
    }, 300);
  };

  const handleBulkSelection = (updates: { regNumber: string; status: 'lulus' | 'tidak_lulus' }[]) => {
    showLoading(`Menyimpan kelulusan ${updates.length} calon murid...`);
    setTimeout(() => {
      updates.forEach((u) => {
        storageService.updateSelectionStatus(u.regNumber, u.status, currentUser?.email || 'admin@madrasah.sch.id');
      });
      refreshData();
      hideLoading();
      showToast(`Status seleksi masal untuk ${updates.length} pendaftar berhasil disimpan!`, 'success');
    }, 450);
  };

  // School profile update & delete
  const handleSaveSchool = (updatedSchool: School) => {
    showLoading('Menyimpan data madrasah...');
    setTimeout(() => {
      storageService.saveSchool(updatedSchool);
      refreshData();
      hideLoading();
      showToast('Profil madrasah dan kuota zonasi berhasil disimpan!', 'success');
    }, 350);
  };

  const handleDeleteSchool = (schoolId: string) => {
    showLoading('Menghapus data madrasah...');
    setTimeout(() => {
      const res = storageService.deleteSchool(schoolId);
      refreshData();
      hideLoading();
      if (res.success) {
        showAlert('Madrasah Dihapus', res.message, 'success');
      } else {
        showAlert('Gagal Menghapus', res.message, 'error');
      }
    }, 300);
  };

  // Applicant Deletion
  const handleDeleteApplicant = (regNumber: string) => {
    showLoading('Menghapus data pendaftar...');
    setTimeout(() => {
      const res = storageService.deleteApplication(regNumber);
      refreshData();
      hideLoading();
      if (res.success) {
        showAlert('Pendaftar Dihapus', res.message, 'success');
      } else {
        showAlert('Gagal Menghapus', res.message, 'error');
      }
    }, 350);
  };

  // Announcements
  const handleAddAnnouncement = (anc: Announcement) => {
    showLoading('Menyimpan pengumuman...');
    setTimeout(() => {
      storageService.saveAnnouncement(anc);
      refreshData();
      hideLoading();
      showToast('Pengumuman baru berhasil diterbitkan.', 'success');
    }, 300);
  };

  const handleDeleteAnnouncement = (id: string) => {
    showLoading('Menghapus pengumuman...');
    setTimeout(() => {
      storageService.deleteAnnouncement(id);
      refreshData();
      hideLoading();
      showToast('Pengumuman berhasil dihapus.', 'info');
    }, 300);
  };

  // System settings
  const handleSaveSettings = (newSettings: SystemSettings) => {
    showLoading('Menyimpan konfigurasi sistem...');
    setTimeout(() => {
      storageService.saveSettings(newSettings);
      setSettings(newSettings);
      refreshData();
      hideLoading();
      showToast('Pengaturan sistem dan database berhasil disimpan!', 'success');
    }, 400);
  };

  // Export Excel (.xlsx) rapi & terstruktur
  const handleExportExcel = () => {
    showLoading('Mempersiapkan ekspor data Excel (.xlsx)...');
    setTimeout(() => {
      let targetApps = applications;
      let schoolTitle = 'Seluruh Satuan Pendidikan Madrasah';

      if (currentUser?.role === 'admin_sekolah' && currentSchool) {
        targetApps = applications.filter(
          (a) => a.school_id === currentSchool.school_id || !a.school_id
        );
        schoolTitle = currentSchool.school_name;
      }

      exportApplicantsToExcel(
        targetApps,
        students,
        parents,
        schoolOrigins,
        addresses,
        schools,
        {
          schoolName: schoolTitle,
        }
      );
      hideLoading();
      showToast('Berkas Excel pendaftar berhasil diunduh.', 'success');
    }, 400);
  };

  // Print single proof
  const handleViewPrint = (regNumber: string) => {
    navigate({ viewMode: 'print_preview', printRegNumber: regNumber });
  };

  // Get active school for current user with fallback
  const currentSchool =
    schools.find((s) => s.school_id === currentUser?.school_id) ||
    schools[0] ||
    storageService.getSchools()[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/25 to-teal-50/30 flex flex-col font-sans selection:bg-emerald-600 selection:text-white text-slate-800">
      {/* App Splash Screen on initial boot / sync */}
      {isAppInitialLoading && (
        <AppSplashScreen settings={settings} />
      )}

      {/* Navbar on app/auth pages (LandingPage has its own dedicated navigation header) */}
      {viewMode !== 'print_preview' && viewMode !== 'landing' && (
        <Navbar
          currentUser={currentUser}
          currentSchool={currentSchool}
          settings={settings}
          onLogout={handleLogout}
          onNavigateHome={() => updateViewMode(currentUser ? 'app' : 'landing')}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      )}

      {/* Main Views */}
      <main className="flex-1">
        {/* ================= 1. LANDING PAGE ================= */}
        {viewMode === 'landing' && (
          <LandingPage
            schools={schools}
            announcements={announcements}
            settings={settings}
            onNavigateToLogin={() => updateViewMode('login')}
            onNavigateToRegister={() => updateViewMode('register')}
            onCheckStatus={handleCheckStatus}
          />
        )}

        {/* ================= 2. LOGIN PAGE ================= */}
        {viewMode === 'login' && (
          <LoginPage
            settings={settings}
            onLogin={handleLogin}
            onNavigateToRegister={() => updateViewMode('register')}
            onNavigateToHome={() => updateViewMode('landing')}
          />
        )}

        {/* ================= 3. REGISTER PAGE ================= */}
        {viewMode === 'register' && (
          <RegisterPage
            settings={settings}
            onRegisterSuccess={(email, regNumber) => {
              handleLogin(email, 'calon_murid');
            }}
            onNavigateToLogin={() => updateViewMode('login')}
            onNavigateToHome={() => updateViewMode('landing')}
          />
        )}

        {/* ================= 4. AUTHENTICATED APP PORTAL ================= */}
        {viewMode === 'app' && currentUser && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Calon Murid Dashboard */}
            {currentUser.role === 'calon_murid' && (
              (() => {
                const regNum = currentUser.registration_number || 'REG-20260825-001';
                const student: StudentProfile = students[regNum] || {
                  student_id: 'STD-DEFAULT',
                  user_id: currentUser.user_id,
                  registration_number: regNum,
                  nik: '3171012345670001',
                  nisn: '0081234567',
                  name: currentUser.name,
                  birth_place: 'Jakarta',
                  birth_date: '2010-05-14',
                  gender: 'L',
                  religion: 'Islam',
                  family_card_number: '3171012345670001',
                  child_order: 1,
                  total_siblings: 2,
                  family_status: 'Anak Kandung',
                  phone: '081234567890',
                  email: currentUser.email,
                };
                const app: Application = applications.find((a) => a.registration_number === regNum) || {
                  application_id: 'APP-DEFAULT',
                  registration_number: regNum,
                  user_id: currentUser.user_id,
                  student_id: student.student_id,
                  school_id: currentUser.school_id || 'SCH-MAN1',
                  admission_year: '2026',
                  pathway: 'zonasi',
                  distance_km: 1.25,
                  max_distance_km: 5.0,
                  zoning_status: 'memenuhi',
                  verification_status: 'menunggu',
                  selection_status: 'menunggu',
                  final_status: 'draft',
                  step_completed: 1,
                  is_locked: false,
                  latitude: -6.175392,
                  longitude: 106.827153,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                const parent = parents[regNum];
                const schoolOrigin = schoolOrigins[regNum];
                const address = addresses[regNum];
                const school =
                  schools.find((s) => s.school_id === app.school_id) ||
                  schools[0] ||
                  storageService.getSchools()[0];

                return (
                  <StudentDashboard
                    student={student}
                    application={app}
                    parent={parent}
                    schoolOrigin={schoolOrigin}
                    address={address}
                    school={school}
                    announcements={announcements}
                    onRefresh={refreshData}
                    activeTab={currentRoute.studentTab || 'overview'}
                    onTabChange={(tab) => navigate({ studentTab: tab })}
                  />
                );
              })()
            )}

            {/* Admin Sekolah Dashboard */}
            {currentUser.role === 'admin_sekolah' && (
              <SchoolDashboard
                school={currentSchool}
                applications={applications}
                students={students}
                parents={parents}
                schoolOrigins={schoolOrigins}
                addresses={addresses}
                documents={documents}
                onVerify={handleVerify}
                onUpdateSelection={handleUpdateSelection}
                onBulkSelection={handleBulkSelection}
                onSaveSchool={handleSaveSchool}
                onViewPrint={handleViewPrint}
                onExportCsv={handleExportExcel}
                onExportExcel={handleExportExcel}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onDeleteApplicant={handleDeleteApplicant}
                activeTab={currentRoute.schoolTab || 'overview'}
                onTabChange={(tab) => navigate({ schoolTab: tab })}
              />
            )}

            {/* Admin Pusat Dashboard */}
            {currentUser.role === 'admin_pusat' && (
              <CentralDashboard
                schools={schools}
                applications={applications}
                students={students}
                parents={parents}
                schoolOrigins={schoolOrigins}
                addresses={addresses}
                documents={documents}
                auditLogs={auditLogs}
                announcements={announcements}
                settings={settings}
                onSaveSchool={handleSaveSchool}
                onDeleteSchool={handleDeleteSchool}
                onSaveSettings={handleSaveSettings}
                onAddAnnouncement={handleAddAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
                onVerify={handleVerify}
                onViewPrint={handleViewPrint}
                onExportCsv={handleExportExcel}
                onExportExcel={handleExportExcel}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onDeleteApplicant={handleDeleteApplicant}
                onRefreshData={refreshData}
                activeTab={(currentRoute.centralTab as CentralTab) || 'overview'}
                onTabChange={(tab) => navigate({ centralTab: tab })}
              />
            )}
          </div>
        )}

        {/* ================= 5. PRINT PREVIEW STANDALONE ================= */}
        {viewMode === 'print_preview' && printRegNumber && (
          <div className="max-w-4xl mx-auto py-6 px-3 sm:px-4">
            {(() => {
              const allApps = storageService.getApplications();
              const allStudents = storageService.getStudentsMap();
              const allParents = storageService.getParentsMap();
              const allOrigins = storageService.getSchoolOriginsMap();
              const allAddresses = storageService.getAddressesMap();
              const allSchools = storageService.getSchools();

              const app =
                applications.find((a) => a.registration_number === printRegNumber) ||
                allApps.find((a) => a.registration_number === printRegNumber) ||
                (currentUser && currentUser.registration_number === printRegNumber
                  ? {
                      application_id: 'APP-CURR',
                      registration_number: printRegNumber,
                      school_id: currentUser.school_id || 'SCH-MAN1',
                      pathway: 'zonasi' as const,
                      distance_km: 1.2,
                      max_distance_km: 5.0,
                      zoning_status: 'memenuhi' as const,
                      verification_status: 'menunggu' as const,
                      selection_status: 'menunggu' as const,
                      final_status: 'draft' as const,
                      created_at: new Date().toISOString(),
                    }
                  : null);

              const student =
                students[printRegNumber] ||
                allStudents[printRegNumber] ||
                (currentUser && currentUser.registration_number === printRegNumber
                  ? {
                      registration_number: printRegNumber,
                      name: currentUser.name,
                      nik: '3171012345670001',
                      nisn: '-',
                      gender: 'L' as const,
                      religion: 'Islam',
                      phone: currentUser.phone,
                      email: currentUser.email,
                    }
                  : null);

              const parent = parents[printRegNumber] || allParents[printRegNumber] || null;
              const schoolOrigin = schoolOrigins[printRegNumber] || allOrigins[printRegNumber] || null;
              const address = addresses[printRegNumber] || allAddresses[printRegNumber] || null;
              const targetSchoolId = app?.school_id || currentUser?.school_id;
              const school =
                schools.find((s) => s.school_id === targetSchoolId) ||
                allSchools.find((s) => s.school_id === targetSchoolId) ||
                schools[0] ||
                allSchools[0];

              if (!app || !student) {
                return (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto">
                    <p className="text-sm font-semibold text-slate-700">Data pendaftaran dengan nomor <strong>{printRegNumber}</strong> tidak ditemukan.</p>
                    <button
                      type="button"
                      onClick={() => updateViewMode(currentUser ? 'app' : 'landing')}
                      className="block mx-auto mt-4 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Kembali ke Beranda
                    </button>
                  </div>
                );
              }

              return (
                <PrintBuktiPendaftaran
                  application={app}
                  student={student}
                  parent={parent}
                  schoolOrigin={schoolOrigin}
                  address={address}
                  school={school}
                  onBack={() => updateViewMode(currentUser ? 'app' : 'landing')}
                />
              );
            })()}
          </div>
        )}
      </main>

      {/* ================= STATUS SEARCH QUICK MODAL ================= */}
      {searchModalOpen && searchResultApp && searchResultStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Hasil Pengecekan Pendaftaran</h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                  Nama Calon Peserta Didik
                </div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {searchResultStudent.name}
                </div>
                <div className="text-slate-600 font-mono text-[11px]">
                  No. Pendaftaran: <strong>{searchResultApp.registration_number}</strong> | NIK: {searchResultStudent.nik}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-500 font-semibold text-[11px]">Jalur Pendaftaran:</div>
                  <div className="font-bold text-slate-900 uppercase mt-0.5">
                    Jalur {searchResultApp.pathway}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-500 font-semibold text-[11px]">Jarak ke Madrasah:</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {formatDistanceIndonesian(searchResultApp.distance_km)}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500 font-semibold text-[11px]">Status Verifikasi Berkas:</div>
                <div className="font-bold text-slate-900 capitalize">
                  {searchResultApp.verification_status ? searchResultApp.verification_status.replace('_', ' ') : 'Menunggu'}
                </div>
                {searchResultApp.verification_notes && (
                  <div className="text-amber-800 text-[11px] bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                    Catatan: {searchResultApp.verification_notes}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500 font-semibold text-[11px]">Status Akhir / Kelulusan:</div>
                <div className="text-sm font-black uppercase text-emerald-700">
                  {searchResultApp.final_status ? searchResultApp.final_status.replace('_', ' ') : 'Proses'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  handleViewPrint(searchResultApp.registration_number);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Bukti Pendaftaran</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Profile & Password Modal */}
      {isProfileModalOpen && currentUser && (
        <AdminProfileModal
          currentUser={currentUser}
          currentSchool={currentSchool}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            refreshData();
          }}
        />
      )}
    </div>
  );
}
