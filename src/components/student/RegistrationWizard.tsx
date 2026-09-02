import React, { useState, useEffect } from 'react';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Save,
  User as UserIcon,
  Users,
  GraduationCap,
  Home,
  MapPin,
  Compass,
  FileText,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Trash2,
  Printer,
  ShieldAlert,
  Trophy,
  Briefcase,
  Award,
  Building,
  HeartHandshake,
  Download,
  Info,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  StudentProfile,
  ParentData,
  SchoolOrigin,
  AddressData,
  Application,
  DocumentItem,
  School,
  PathwayType,
} from '../../types/sipma';
import { storageService } from '../../services/storageService';
import { useFeedback } from '../../context/FeedbackContext';
import { InteractiveLocationPicker } from '../map/InteractiveLocationPicker';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
import { DispensationLetterModal } from './DispensationLetterModal';
import { downloadDocumentFile, formatStandardDocumentFileName } from '../../utils/fileDownload';

interface Props {
  registrationNumber: string;
  onFinish?: () => void;
  onOpenPrint?: () => void;
  onBack?: () => void;
  onSchoolSelected?: (schoolId: string, newRegNum: string) => void;
}

const STEPS = [
  { id: 1, label: 'Data Pribadi', icon: UserIcon },
  { id: 2, label: 'Orang Tua / Wali', icon: Users },
  { id: 3, label: 'Sekolah Asal', icon: GraduationCap },
  { id: 4, label: 'Alamat Domisili', icon: Home },
  { id: 5, label: 'Lokasi Rumah & Zonasi', icon: MapPin },
  { id: 6, label: 'Pilih Jalur', icon: Compass },
  { id: 7, label: 'Upload Dokumen', icon: FileText },
  { id: 8, label: 'Review Data', icon: Eye },
  { id: 9, label: 'Submit Pendaftaran', icon: CheckCircle2 },
];

export const RegistrationWizard: React.FC<Props> = ({
  registrationNumber,
  onFinish,
  onOpenPrint,
  onBack,
  onSchoolSelected,
}) => {
  const { showAlert, showConfirm, showToast, showLoading, hideLoading } = useFeedback();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [showDispensationModal, setShowDispensationModal] = useState<boolean>(false);

  // Main Entities with Safe Fallbacks
  const [student, setStudent] = useState<StudentProfile>(() => {
    const existing = storageService.getStudentProfile(registrationNumber);
    if (existing) return existing;
    const currentUser = storageService.getCurrentUser();
    return {
      student_id: `STD-${Date.now()}`,
      user_id: currentUser?.user_id || '',
      registration_number: registrationNumber,
      nik: '',
      nisn: '',
      name: currentUser?.name || 'Calon Murid Baru',
      birth_place: 'Jakarta',
      birth_date: '2010-05-14',
      gender: 'L',
      religion: 'Islam',
      family_card_number: '',
      child_order: 1,
      total_siblings: 2,
      family_status: 'Anak Kandung',
      phone: currentUser?.phone || '081234567890',
      email: currentUser?.email || 'calon@madrasah.sch.id',
    };
  });

  const [parent, setParent] = useState<ParentData>(() => {
    return (
      storageService.getParentData(registrationNumber) || {
        parent_id: `PAR-${Date.now()}`,
        student_id: '',
        father_name: '',
        father_status: 'hidup',
        father_nik: '',
        father_birth_place: '',
        father_birth_date: '',
        father_education: 'SMA/Sederajat',
        father_job: 'Wiraswasta',
        father_income: 'Rp 3.000.000 - Rp 5.000.000',
        father_phone: '',
        mother_name: '',
        mother_status: 'hidup',
        mother_nik: '',
        mother_birth_place: '',
        mother_birth_date: '',
        mother_education: 'SMA/Sederajat',
        mother_job: 'Ibu Rumah Tangga',
        mother_income: '< Rp 1.000.000',
        mother_phone: '',
        guardian_name: '',
        guardian_nik: '',
        guardian_relation: 'Paman/Bibi',
        guardian_birth_place: '',
        guardian_birth_date: '',
        guardian_education: 'SMA/Sederajat',
        guardian_job: 'Wiraswasta',
        guardian_income: 'Rp 3.000.000 - Rp 5.000.000',
        guardian_phone: '',
        guardian_address: '',
      }
    );
  });

  const [schoolOrigin, setSchoolOrigin] = useState<SchoolOrigin>(() => {
    return (
      storageService.getSchoolOrigin(registrationNumber) || {
        origin_id: `SCH-ORI-${Date.now()}`,
        student_id: '',
        school_name: '',
        npsn_nsm: '',
        school_address: '',
        graduation_year: '2026',
        diploma_number: '',
      }
    );
  });

  const [address, setAddress] = useState<AddressData>(() => {
    return (
      storageService.getAddressData(registrationNumber) || {
        address_id: `ADR-${Date.now()}`,
        student_id: '',
        street_address: '',
        rt: '01',
        rw: '01',
        village: '',
        district: '',
        city: 'Jakarta Selatan',
        province: 'DKI Jakarta',
        postal_code: '',
      }
    );
  });

  const [application, setApplication] = useState<Application>(() => {
    const existing = storageService.getApplication(registrationNumber);
    if (existing) return existing;
    const currentUser = storageService.getCurrentUser();
    return {
      application_id: `APP-${Date.now()}`,
      registration_number: registrationNumber,
      user_id: currentUser?.user_id || '',
      student_id: `STD-${Date.now()}`,
      school_id: '',
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
      latitude: -6.238271,
      longitude: 106.802315,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => storageService.getDocumentsByRegistration(registrationNumber));
  const [schools, setSchools] = useState<School[]>(() => storageService.getSchools());
  const [activeRegNumber, setActiveRegNumber] = useState<string>(registrationNumber);
  const [schoolLevelFilter, setSchoolLevelFilter] = useState<'all' | 'MI' | 'MTs' | 'MA'>('all');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(() => {
    const loaded = storageService.getSchools();
    const app = storageService.getApplication(registrationNumber);
    if (app && app.school_id) {
      return loaded.find((s) => s.school_id === app.school_id) || null;
    }
    return null;
  });

  const effectiveSchool = selectedSchool || schools.find((s) => s.school_id === application?.school_id) || schools[0] || {
    school_id: 'SCH-MAN1',
    npsn: '20100001',
    school_name: 'MAN 1 Kota Jakarta',
    level: 'MA' as const,
    status: 'active' as const,
    address: 'Jl. Madrasah No. 1',
    village: 'Pondok Indah',
    district: 'Kebayoran Lama',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    latitude: -6.2655,
    longitude: 106.7844,
    radius_zonasi_km: 5,
    zoning_radius_km: 5,
    quota_total: 100,
    quota_zonasi: 50,
    quota_afirmasi: 20,
    quota_prestasi: 20,
    quota_mutasi: 10,
    quota_percentage_zonasi: 50,
    quota_percentage_afirmasi: 20,
    quota_percentage_prestasi: 20,
    quota_percentage_mutasi: 10,
  };

  // Handle Target School Selection & Linking
  const handleSelectSchool = (schoolId: string) => {
    showLoading('Menghubungkan ke madrasah tujuan...');
    setTimeout(() => {
      try {
        const result = storageService.assignStudentTargetSchool(activeRegNumber, schoolId);
        setActiveRegNumber(result.newRegNum);
        setSelectedSchool(result.school);
        setApplication(result.updatedApp);

        const std = storageService.getStudentProfile(result.newRegNum);
        if (std) setStudent(std);

        const docs = storageService.getDocumentsByRegistration(result.newRegNum);
        setDocuments(docs);

        if (onSchoolSelected) {
          onSchoolSelected(schoolId, result.newRegNum);
        }

        hideLoading();
        showToast(
          `Berhasil memilih ${result.school.school_name}. Akun Anda kini resmi terhubung dengan panitia PPDB madrasah tersebut.`,
          'success'
        );
      } catch (err: any) {
        hideLoading();
        showAlert('Gagal Memilih Madrasah', err.message || 'Terjadi kesalahan saat memilih madrasah.', 'error');
      }
    }, 350);
  };

  const handleCancelSchool = () => {
    if (application?.is_locked) {
      showAlert('Pendaftaran Terkunci', 'Pendaftaran Anda telah dikunci dan tidak dapat membatalkan pilihan madrasah.', 'warning');
      return;
    }

    showConfirm(
      'Batalkan Pilihan Madrasah?',
      `Apakah Anda yakin ingin membatalkan pilihan madrasah ${effectiveSchool?.school_name || 'tujuan'}? Anda dapat memilih kembali madrasah lain setelahnya.`,
      () => {
        try {
          showLoading('Membatalkan pilihan madrasah...');
          const res = storageService.cancelStudentTargetSchool(activeRegNumber || registrationNumber);
          setSelectedSchool(null);
          setApplication(res.updatedApp);
          hideLoading();
          showToast('Pilihan madrasah berhasil dibatalkan. Silakan pilih madrasah tujuan baru.', 'info');
        } catch (err: any) {
          hideLoading();
          showAlert('Gagal Membatalkan Pilihan', err.message || 'Terjadi kesalahan saat membatalkan pilihan madrasah.', 'error');
        }
      },
      {
        confirmLabel: 'Ya, Batalkan Pilihan',
        cancelLabel: 'Tetap di Madrasah Ini',
        type: 'warning',
      }
    );
  };

  // Review & Data Validity Checklists
  const [validityStudentChecked, setValidityStudentChecked] = useState<boolean>(false);
  const [validityDocsChecked, setValidityDocsChecked] = useState<boolean>(false);
  const [validityLockChecked, setValidityLockChecked] = useState<boolean>(false);
  const [agreementChecked, setAgreementChecked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const isFormLocked = Boolean(
    application?.is_locked ||
    (application?.final_status && application.final_status !== 'draft' && application.final_status !== 'perlu_perbaikan')
  );

  const allValidityConfirmed = validityStudentChecked && validityDocsChecked && validityLockChecked;

  // Load initial data
  useEffect(() => {
    setActiveRegNumber(registrationNumber);
    const loadedSchools = storageService.getSchools();
    if (loadedSchools && loadedSchools.length > 0) {
      setSchools(loadedSchools);
    }

    const app = storageService.getApplication(registrationNumber);
    if (app) {
      setApplication(app);
      if (app.school_id) {
        const sch = loadedSchools.find((s) => s.school_id === app.school_id) || null;
        setSelectedSchool(sch);
      }
      const locked = Boolean(
        app.is_locked ||
        (app.final_status && app.final_status !== 'draft' && app.final_status !== 'perlu_perbaikan')
      );
      if (locked) {
        setSubmitSuccess(true);
        setValidityStudentChecked(true);
        setValidityDocsChecked(true);
        setValidityLockChecked(true);
        setAgreementChecked(true);
        setCurrentStep(9);
      } else if (app.step_completed > 1 && app.step_completed < 9) {
        setCurrentStep(app.step_completed);
      }
    }

    const std = storageService.getStudentProfile(registrationNumber);
    if (std) setStudent(std);

    const par = storageService.getParentData(registrationNumber);
    if (par) setParent(par);

    const ori = storageService.getSchoolOrigin(registrationNumber);
    if (ori) setSchoolOrigin(ori);

    const adr = storageService.getAddressData(registrationNumber);
    if (adr) setAddress(adr);

    const docs = storageService.getDocumentsByRegistration(registrationNumber);
    setDocuments(docs);
  }, [registrationNumber]);

  // Auto-save function
  const triggerAutoSave = () => {
    if (!student || !application || isFormLocked) return;
    setIsAutosaving(true);

    try {
      storageService.saveStudentProfile(student);
      storageService.saveParentData(activeRegNumber, parent);
      storageService.saveSchoolOrigin(activeRegNumber, schoolOrigin);
      storageService.saveAddressData(activeRegNumber, address);

      const updatedApp: Application = {
        ...application,
        step_completed: Math.max(application.step_completed, currentStep),
      };
      storageService.saveApplication(updatedApp);
      setApplication(updatedApp);

      setSaveMessage('Tersimpan otomatis ke database');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAutosaving(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!application?.school_id) {
        showAlert(
          'Pilih Madrasah Tujuan',
          'Silakan pilih salah satu Madrasah / Satuan Pendidikan Tujuan terlebih dahulu sebelum melanjutkan ke langkah berikutnya agar akun Anda terhubung dengan panitia madrasah.',
          'warning'
        );
        return;
      }
      if (!student?.name?.trim() || !student?.nik?.trim()) {
        showAlert(
          'Lengkapi Data Pribadi',
          'Harap isi Nama Lengkap dan NIK calon murid sesuai dokumen resmi.',
          'warning'
        );
        return;
      }
    }

    triggerAutoSave();
    if (currentStep < 9) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    triggerAutoSave();
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: DocumentItem['document_type'],
    docTitle: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      showAlert('Ukuran Berkas Terlalu Besar', 'Batas maksimal ukuran file dokumen adalah 5 MB.', 'warning');
      return;
    }

    showLoading(`Mengunggah "${file.name}" ke Google Drive...`);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;

        const standardFileName = formatStandardDocumentFileName({
          accountName: student?.name,
          registrationNumber: activeRegNumber || registrationNumber,
          documentType: docType,
          documentTitle: docTitle,
          originalFileName: file.name,
        });

        const newDoc: DocumentItem = {
          document_id: `DOC-${Date.now()}`,
          registration_number: activeRegNumber || registrationNumber,
          student_id: student?.student_id || 'STD-001',
          document_type: docType,
          document_title: docTitle,
          file_name: standardFileName,
          file_size_kb: Math.round(file.size / 1024),
          file_data_base64: base64,
          upload_time: new Date().toISOString(),
          verification_status: 'menunggu',
        };

        storageService.saveDocument(newDoc, student?.name, effectiveSchool?.school_name);
        
        // Push directly to Google Drive via server proxy
        const uploadRes = await storageService.uploadDocumentToDrive(newDoc, student?.name, effectiveSchool?.school_name);

        setDocuments(storageService.getDocumentsByRegistration(activeRegNumber || registrationNumber));

        // Also update student photo if docType is foto
        if ((docType === 'foto' || docType === 'pas_foto') && student) {
          const updated = {
            ...student,
            photo_url: uploadRes?.file?.drive_url || uploadRes?.file?.view_url || base64,
          };
          setStudent(updated);
          storageService.saveStudentProfile(updated);
        }

        hideLoading();
        showToast(
          uploadRes?.gas_synced
            ? `Berkas "${standardFileName}" berhasil diunggah & tersimpan di Google Drive!`
            : `Berkas "${standardFileName}" berhasil disimpan di sistem.`,
          'success'
        );
      } catch (err: any) {
        hideLoading();
        showToast(`Berkas "${file.name}" tersimpan di database lokal/cloud.`, 'info');
      }
    };
    reader.onerror = () => {
      hideLoading();
      showAlert('Gagal Mengunggah', 'Gagal memproses berkas dokumen yang dipilih.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = (docId: string) => {
    showConfirm('Hapus Dokumen', 'Apakah Anda yakin ingin menghapus berkas dokumen ini?', () => {
      showLoading('Menghapus berkas dokumen...');
      setTimeout(() => {
        storageService.deleteDocument(docId);
        setDocuments(storageService.getDocumentsByRegistration(activeRegNumber || registrationNumber));
        hideLoading();
        showToast('Dokumen berhasil dihapus', 'info');
      }, 300);
    });
  };

  const handleSubmitFinal = () => {
    if (isFormLocked) {
      showAlert('Pendaftaran Telah Dikunci', 'Formulir pendaftaran ini telah dikirim dan dikunci secara permanen. Anda tidak dapat mengisi ulang formulir.', 'info');
      setCurrentStep(9);
      return;
    }

    if (!allValidityConfirmed) {
      showAlert(
        'Ceklist Kevalidan Data Diperlukan',
        'Mohon centang seluruh checklist pernyataan kevalidan data (Keabsahan Biodata Siswa, Keaslian Berkas & Zonasi, serta Penguncian Permanen) sebelum mengirim pendaftaran final.',
        'warning'
      );
      return;
    }

    setIsSubmitting(true);
    showLoading('Memproses pengiriman pendaftaran final dan mengunci formulir secara permanen...');
    setTimeout(() => {
      try {
        storageService.submitApplication(activeRegNumber || registrationNumber);
        const updated = storageService.getApplication(activeRegNumber || registrationNumber);
        if (updated) {
          setApplication(updated);
        }
        setSubmitSuccess(true);
        setCurrentStep(9);
        hideLoading();
        showToast('Pendaftaran berhasil dikirim dan dikunci permanen!', 'success');
      } catch (err: any) {
        hideLoading();
        showAlert('Gagal Mengirim Pendaftaran', err.message || 'Terjadi kesalahan saat memproses data pendaftaran.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }, 700);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5" id="sipma-registration-wizard">
      {/* Top Navigation & Status Bar aligned with Form */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer group"
              title="Kembali ke Dashboard Utama Calon Murid"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 group-hover:-translate-x-0.5 transition-transform" />
              <span>Kembali ke Halaman Utama</span>
            </button>
          )}

          {onBack && <div className="h-6 w-px bg-slate-200 hidden sm:block" />}

          <div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Formulir Pendaftaran PPDB Madrasah 2026
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {student.name || 'Calon Murid Baru'}
            </h2>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              No. Pendaftaran: <strong className="text-emerald-700 font-bold">{activeRegNumber || registrationNumber}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-end">
          {saveMessage && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-pulse">
              ✓ {saveMessage}
            </span>
          )}

          {application?.school_id ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
              <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-[220px]">{effectiveSchool.school_name}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pilih Madrasah Tujuan</span>
            </span>
          )}

          <button
            type="button"
            onClick={triggerAutoSave}
            disabled={isAutosaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isAutosaving ? 'Menyimpan...' : 'Simpan Draf'}</span>
          </button>
        </div>
      </div>

      {/* Step Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center min-w-[700px] justify-between">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = step.id < currentStep || (step.id === 9 && submitSuccess);
            const isCurrent = step.id === currentStep;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!application.is_locked || step.id === 9 || step.id === 8) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 group cursor-pointer transition-all ${
                    isCurrent ? 'scale-105' : ''
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-slate-900 text-white ring-4 ring-slate-100'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap ${
                      isCurrent
                        ? 'text-slate-900 font-bold'
                        : isCompleted
                        ? 'text-emerald-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                      step.id < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Step Body */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
        {/* ================= STEP 1: DATA PRIBADI ================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 1: Pilihan Madrasah Tujuan & Data Pribadi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih madrasah yang ingin Anda tuju untuk menghubungkan akun ke panitia PPDB, lalu lengkapi data pribadi calon murid sesuai KK & Akta.
              </p>
            </div>

            {/* Pilihan Satuan Pendidikan / Madrasah Tujuan */}
            <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-slate-50 to-teal-50/40 rounded-2xl border-2 border-emerald-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Pilihan Satuan Pendidikan / Madrasah Tujuan *</h4>
                    <p className="text-[11px] text-slate-500">
                      Pilih madrasah tujuan Anda agar formulir & akun terhubung langsung dengan Panitia PPDB madrasah tersebut.
                    </p>
                  </div>
                </div>

                {/* Filter Jenjang */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs self-start">
                  {(['all', 'MI', 'MTs', 'MA'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSchoolLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        schoolLevelFilter === lvl
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {lvl === 'all' ? 'Semua Jenjang' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Connection Notice */}
              {application?.school_id ? (
                <div className="p-4 bg-emerald-100/90 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      Akun Anda telah <strong>resmi terhubung</strong> dengan <strong>{effectiveSchool.school_name}</strong> (Kode: <strong>{effectiveSchool.school_code || effectiveSchool.school_id}</strong>).
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] font-bold bg-white/90 px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-900">
                      No. Reg: {activeRegNumber}
                    </span>
                    {!application.is_locked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelSchool();
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        title="Batalkan pilihan madrasah saat ini"
                      >
                        Batalkan Pilihan
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center gap-2.5 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Belum Memilih Madrasah Tujuan:</strong> Silakan pilih salah satu madrasah di bawah ini (atau klik madrasah yang Anda inginkan) agar formulir Anda terhubung dengan panitia PPDB madrasah tersebut.
                  </span>
                </div>
              )}

              {/* School Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {schools
                  .filter((s) => schoolLevelFilter === 'all' || s.level === schoolLevelFilter)
                  .map((s) => {
                    const isSelected = application?.school_id === s.school_id;
                    const code = s.school_code || (s.school_id ? s.school_id.replace(/^SCH-/, '') : 'MAN01');

                    return (
                      <div
                        key={s.school_id}
                        onClick={() => handleSelectSchool(s.school_id)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                            : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  s.level === 'MA'
                                    ? 'bg-purple-100 text-purple-800'
                                    : s.level === 'MTs'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {s.level}
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                Kode: {code}
                              </span>
                              {s.npsn && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  NPSN: {s.npsn}
                                </span>
                              )}
                            </div>
                            <h5 className="font-bold text-sm text-slate-900 leading-snug">
                              {s.school_name}
                            </h5>
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              {s.address}, {s.city}
                            </p>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'border-2 border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                          <span>Radius Zonasi: <strong>{s.zoning_radius_km} km</strong></span>
                          <span>Kuota: <strong>{s.quota_total} Murid</strong></span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Foto Profil Calon Murid */}
            <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="relative shrink-0">
                <div className="w-24 h-32 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden bg-white flex items-center justify-center shadow-xs">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <UserIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-semibold">Pas Foto</span>
                      <span className="block text-[8px] text-slate-400">3 x 4</span>
                    </div>
                  )}
                </div>
                {student.photo_url && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...student, photo_url: '' };
                      setStudent(updated);
                      storageService.saveStudentProfile(updated);
                    }}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-xs cursor-pointer"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <label className="block text-xs font-bold text-slate-800">
                  Foto Profil / Pas Foto Calon Murid (Opsional)
                </label>
                <p className="text-[11px] text-slate-500">
                  Unggah pas foto calon murid (JPG, PNG, WEBP, maks 3 MB). Foto akan ditampilkan di akun murid dan dicetak pada Bukti Pendaftaran Resmi.
                </p>
                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    id="wizard-photo-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        showAlert('File Terlalu Besar', 'Ukuran pas foto maksimal 3 MB.', 'warning');
                        return;
                      }
                      showLoading('Mengunggah pas foto ke Google Drive...');
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const base64 = reader.result as string;
                          const photoDoc: DocumentItem = {
                            document_id: `DOC-FOTO-${Date.now()}`,
                            registration_number: activeRegNumber || registrationNumber,
                            student_id: student?.student_id || 'STD-001',
                            document_type: 'foto',
                            document_title: 'Pas Foto 3x4 Calon Murid',
                            file_name: file.name,
                            file_size_kb: Math.round(file.size / 1024),
                            file_data_base64: base64,
                            upload_time: new Date().toISOString(),
                            verification_status: 'menunggu',
                          };

                          storageService.saveDocument(photoDoc, student?.name, effectiveSchool?.school_name);
                          const uploadRes = await storageService.uploadDocumentToDrive(
                            photoDoc,
                            student?.name,
                            effectiveSchool?.school_name
                          );

                          const finalUrl = uploadRes?.file?.drive_url || uploadRes?.file?.view_url || base64;
                          const updated = { ...student, photo_url: finalUrl };
                          setStudent(updated);
                          storageService.saveStudentProfile(updated);

                          hideLoading();
                          showToast(
                            uploadRes?.gas_synced
                              ? 'Pas foto berhasil diunggah & tersimpan aman di Google Drive!'
                              : 'Pas foto profil berhasil diunggah.',
                            'success'
                          );
                        } catch {
                          hideLoading();
                          showToast('Pas foto berhasil disimpan.', 'success');
                        }
                      };
                      reader.onerror = () => {
                        hideLoading();
                        showAlert('Gagal Mengunggah', 'Gagal memproses pas foto.', 'error');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <label
                    htmlFor="wizard-photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{student.photo_url ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap (Sesuai Ijazah/Akta) *
                </label>
                <input
                  type="text"
                  value={student.name}
                  onChange={(e) => setStudent({ ...student, name: e.target.value })}
                  placeholder="Contoh: Ahmad Fauzan Pratama"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK) *
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={student.nik}
                  onChange={(e) => setStudent({ ...student, nik: e.target.value.replace(/\D/g, '') })}
                  placeholder="16 Digit NIK"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Siswa Nasional (NISN)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={student.nisn}
                  onChange={(e) => setStudent({ ...student, nisn: e.target.value.replace(/\D/g, '') })}
                  placeholder="10 Digit NISN (jika ada)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Kelamin *
                </label>
                <select
                  value={student.gender}
                  onChange={(e) => setStudent({ ...student, gender: e.target.value as 'L' | 'P' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agama *</label>
                <select
                  value={student.religion}
                  onChange={(e) => setStudent({ ...student, religion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                >
                  <option value="Islam">Islam</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Katolik">Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Khonghucu">Khonghucu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tempat Lahir *</label>
                <input
                  type="text"
                  value={student.birth_place}
                  onChange={(e) => setStudent({ ...student, birth_place: e.target.value })}
                  placeholder="Kota/Kabupaten Lahir"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Lahir *</label>
                <input
                  type="date"
                  value={student.birth_date}
                  onChange={(e) => setStudent({ ...student, birth_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Kartu Keluarga (KK) *</label>
                <input
                  type="text"
                  maxLength={16}
                  value={student.family_card_number}
                  onChange={(e) => setStudent({ ...student, family_card_number: e.target.value.replace(/\D/g, '') })}
                  placeholder="16 Digit No. KK"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Anak Ke-</label>
                  <input
                    type="number"
                    min={1}
                    value={student.child_order}
                    onChange={(e) => setStudent({ ...student, child_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jml Saudara</label>
                  <input
                    type="number"
                    min={1}
                    value={student.total_siblings}
                    onChange={(e) => setStudent({ ...student, total_siblings: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Hobi / Minat Bakat Siswa */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Hobi / Minat & Bakat Calon Murid
                  </label>
                  <span className="text-[11px] text-slate-400">Pilih rekomendasi atau ketik sendiri</span>
                </div>
                <input
                  type="text"
                  value={student.hobby || ''}
                  onChange={(e) => setStudent({ ...student, hobby: e.target.value })}
                  placeholder="Contoh: Robotik & Sains IT, Olahraga, Kesenian/Kaligrafi, Membaca, Tahfidz"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Membaca & Literasi',
                    'Robotik & Sains IT',
                    'Olahraga & Atletik',
                    'Kesenian & Kaligrafi',
                    'Keagamaan & Tahfidz',
                    'Menulis / Jurnalistik',
                    'Pramuka & Kepemimpinan',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setStudent({ ...student, hobby: chip })}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        student.hobby === chip
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp Aktif *</label>
                <input
                  type="tel"
                  value={student.phone}
                  onChange={(e) => setStudent({ ...student, phone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Email *</label>
                <input
                  type="email"
                  value={student.email}
                  onChange={(e) => setStudent({ ...student, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              {/* Status Tempat Tinggal Calon Murid (Data Pribadi Murid) */}
              <div className="md:col-span-2 pt-3 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Tempat Tinggal Calon Murid *
                </label>
                <select
                  value={student.living_status || 'orang_tua_kandung'}
                  onChange={(e) =>
                    setStudent({
                      ...student,
                      living_status: e.target.value as
                        | 'orang_tua_kandung'
                        | 'ayah_kandung'
                        | 'ibu_kandung'
                        | 'wali_saudara',
                    })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
                >
                  <option value="orang_tua_kandung">Bersama Orang Tua (Ayah & Ibu)</option>
                  <option value="ayah_kandung">Bersama Ayah</option>
                  <option value="ibu_kandung">Bersama Ibu</option>
                  <option value="wali_saudara">Bersama Wali / Saudara (Kakek, Paman, Kakak, dll)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Jika tinggal bersama wali/saudara, Anda akan diminta mengisi identitas wali di langkah berikutnya.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: DATA KELUARGA / ORANG TUA ================= */}
        {currentStep === 2 && (
          <div className="space-y-8">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 2: Data Orang Tua / Wali</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Isi data ayah kandung dan ibu kandung. Jika calon murid tinggal bersama wali/saudara, lengkapi pula data wali.
              </p>
            </div>

            {/* DATA AYAH */}
            <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  DATA AYAH KANDUNG
                </h4>
                {parent.father_status === 'meninggal' && (
                  <span className="text-[11px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                    Status: Almarhum (Pengisian Selanjutnya Bersifat Opsional)
                  </span>
                )}
                {parent.father_status === 'tidak_diketahui' && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                    Status: Tidak Diketahui
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap Ayah *
                  </label>
                  <input
                    type="text"
                    value={parent.father_name}
                    onChange={(e) => setParent({ ...parent, father_name: e.target.value })}
                    placeholder="Nama Lengkap Ayah Kandung (beserta gelar jika ada)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Status Ayah */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Keberadaan Ayah Kandung *
                  </label>
                  <select
                    value={parent.father_status || 'hidup'}
                    onChange={(e) =>
                      setParent({
                        ...parent,
                        father_status: e.target.value as 'hidup' | 'meninggal' | 'tidak_diketahui',
                      })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="hidup">Masih Hidup</option>
                    <option value="meninggal">Meninggal Dunia</option>
                    <option value="tidak_diketahui">Tidak Diketahui</option>
                  </select>
                </div>

                {/* Form lanjutan Ayah jika status bukan 'tidak_diketahui' */}
                {parent.father_status !== 'tidak_diketahui' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NIK Ayah {parent.father_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={parent.father_nik}
                        onChange={(e) =>
                          setParent({ ...parent, father_nik: e.target.value.replace(/\D/g, '') })
                        }
                        placeholder="16 Digit NIK"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat Lahir Ayah {parent.father_status === 'hidup' ? '' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        value={parent.father_birth_place || ''}
                        onChange={(e) => setParent({ ...parent, father_birth_place: e.target.value })}
                        placeholder="Kota Lahir"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Lahir Ayah {parent.father_status === 'hidup' ? '' : '(Opsional)'}
                      </label>
                      <input
                        type="date"
                        value={parent.father_birth_date || ''}
                        onChange={(e) => setParent({ ...parent, father_birth_date: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pendidikan Terakhir Ayah
                      </label>
                      <select
                        value={parent.father_education}
                        onChange={(e) => setParent({ ...parent, father_education: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Tidak Sekolah">Tidak Sekolah</option>
                        <option value="SD/Sederajat">SD/Sederajat</option>
                        <option value="SMP/Sederajat">SMP/Sederajat</option>
                        <option value="SMA/Sederajat">SMA/Sederajat</option>
                        <option value="D1/D2/D3">D1/D2/D3</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pekerjaan Ayah {parent.father_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        value={parent.father_job}
                        onChange={(e) => setParent({ ...parent, father_job: e.target.value })}
                        placeholder="Contoh: Karyawan Swasta, PNS, Wiraswasta, Buruh"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Penghasilan Bulanan Ayah
                      </label>
                      <select
                        value={parent.father_income}
                        onChange={(e) => setParent({ ...parent, father_income: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Tidak Berpenghasilan">Tidak Berpenghasilan</option>
                        <option value="< Rp 1.000.000">&lt; Rp 1.000.000</option>
                        <option value="Rp 1.000.000 - Rp 3.000.000">Rp 1.000.000 - Rp 3.000.000</option>
                        <option value="Rp 3.000.000 - Rp 5.000.000">Rp 3.000.000 - Rp 5.000.000</option>
                        <option value="Rp 5.000.000 - Rp 10.000.000">Rp 5.000.000 - Rp 10.000.000</option>
                        <option value="> Rp 10.000.000">&gt; Rp 10.000.000</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Telepon / WhatsApp Ayah {parent.father_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="tel"
                        value={parent.father_phone}
                        onChange={(e) => setParent({ ...parent, father_phone: e.target.value })}
                        placeholder="081234567890"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </>
                )}

                {parent.father_status === 'tidak_diketahui' && (
                  <div className="md:col-span-3 p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Data rincian ayah kandung dilewati karena status keberadaan tidak diketahui.</span>
                  </div>
                )}
              </div>
            </div>

            {/* DATA IBU */}
            <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  DATA IBU KANDUNG
                </h4>
                {parent.mother_status === 'meninggal' && (
                  <span className="text-[11px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                    Status: Almarhumah (Pengisian Selanjutnya Bersifat Opsional)
                  </span>
                )}
                {parent.mother_status === 'tidak_diketahui' && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                    Status: Tidak Diketahui
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap Ibu *
                  </label>
                  <input
                    type="text"
                    value={parent.mother_name}
                    onChange={(e) => setParent({ ...parent, mother_name: e.target.value })}
                    placeholder="Nama Lengkap Ibu Kandung (beserta gelar jika ada)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Status Ibu */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Keberadaan Ibu Kandung *
                  </label>
                  <select
                    value={parent.mother_status || 'hidup'}
                    onChange={(e) =>
                      setParent({
                        ...parent,
                        mother_status: e.target.value as 'hidup' | 'meninggal' | 'tidak_diketahui',
                      })
                    }
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="hidup">Masih Hidup</option>
                    <option value="meninggal">Meninggal Dunia</option>
                    <option value="tidak_diketahui">Tidak Diketahui</option>
                  </select>
                </div>

                {/* Form lanjutan Ibu jika status bukan 'tidak_diketahui' */}
                {parent.mother_status !== 'tidak_diketahui' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NIK Ibu {parent.mother_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={parent.mother_nik}
                        onChange={(e) =>
                          setParent({ ...parent, mother_nik: e.target.value.replace(/\D/g, '') })
                        }
                        placeholder="16 Digit NIK"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat Lahir Ibu {parent.mother_status === 'hidup' ? '' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        value={parent.mother_birth_place || ''}
                        onChange={(e) => setParent({ ...parent, mother_birth_place: e.target.value })}
                        placeholder="Kota Lahir"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Lahir Ibu {parent.mother_status === 'hidup' ? '' : '(Opsional)'}
                      </label>
                      <input
                        type="date"
                        value={parent.mother_birth_date || ''}
                        onChange={(e) => setParent({ ...parent, mother_birth_date: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pendidikan Terakhir Ibu
                      </label>
                      <select
                        value={parent.mother_education}
                        onChange={(e) => setParent({ ...parent, mother_education: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Tidak Sekolah">Tidak Sekolah</option>
                        <option value="SD/Sederajat">SD/Sederajat</option>
                        <option value="SMP/Sederajat">SMP/Sederajat</option>
                        <option value="SMA/Sederajat">SMA/Sederajat</option>
                        <option value="D1/D2/D3">D1/D2/D3</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pekerjaan Ibu {parent.mother_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="text"
                        value={parent.mother_job}
                        onChange={(e) => setParent({ ...parent, mother_job: e.target.value })}
                        placeholder="Contoh: Ibu Rumah Tangga, Guru, PNS, Karyawan"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Penghasilan Bulanan Ibu
                      </label>
                      <select
                        value={parent.mother_income}
                        onChange={(e) => setParent({ ...parent, mother_income: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Tidak Berpenghasilan">Tidak Berpenghasilan</option>
                        <option value="< Rp 1.000.000">&lt; Rp 1.000.000</option>
                        <option value="Rp 1.000.000 - Rp 3.000.000">Rp 1.000.000 - Rp 3.000.000</option>
                        <option value="Rp 3.000.000 - Rp 5.000.000">Rp 3.000.000 - Rp 5.000.000</option>
                        <option value="Rp 5.000.000 - Rp 10.000.000">Rp 5.000.000 - Rp 10.000.000</option>
                        <option value="> Rp 10.000.000">&gt; Rp 10.000.000</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Telepon / WhatsApp Ibu {parent.mother_status === 'hidup' ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="tel"
                        value={parent.mother_phone}
                        onChange={(e) => setParent({ ...parent, mother_phone: e.target.value })}
                        placeholder="081234567890"
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </>
                )}

                {parent.mother_status === 'tidak_diketahui' && (
                  <div className="md:col-span-3 p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Data rincian ibu kandung dilewati karena status keberadaan tidak diketahui.</span>
                  </div>
                )}
              </div>
            </div>

            {/* FORM DATA LENGKAP WALI (Hanya jika memilih tinggal bersama wali/saudara pada Data Pribadi) */}
            {student?.living_status === 'wali_saudara' && (
              <div className="p-5 bg-amber-50/70 rounded-xl border-2 border-amber-300 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-amber-700" />
                    <h4 className="font-bold text-sm text-amber-950">
                      DATA LENGKAP WALI / SAUDARA
                    </h4>
                  </div>
                  <span className="text-[11px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                    Wajib Dilengkapi
                  </span>
                </div>
                <p className="text-xs text-amber-900">
                  Karena pada data pribadi calon murid berstatus tinggal bersama <strong>Wali / Saudara</strong>, mohon lengkapi identitas wali penanggung jawab di bawah ini secara lengkap dan benar.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap Wali *
                    </label>
                    <input
                      type="text"
                      value={parent.guardian_name || ''}
                      onChange={(e) => setParent({ ...parent, guardian_name: e.target.value })}
                      placeholder="Nama Lengkap Wali (beserta gelar jika ada)"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIK Wali (KTP) *
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={parent.guardian_nik || ''}
                      onChange={(e) =>
                        setParent({ ...parent, guardian_nik: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="16 Digit NIK Wali"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hubungan Keluarga dengan Calon Murid *
                    </label>
                    <select
                      value={parent.guardian_relation || 'Paman/Bibi'}
                      onChange={(e) => setParent({ ...parent, guardian_relation: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="Kakek / Nenek">Kakek / Nenek</option>
                      <option value="Paman / Bibi">Paman / Bibi</option>
                      <option value="Kakak Kandung">Kakak Kandung</option>
                      <option value="Saudara / Kerabat Lain">Saudara / Kerabat Lain</option>
                      <option value="Wali Asuh / Pengasuh">Wali Asuh / Pengasuh</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tempat Lahir Wali
                    </label>
                    <input
                      type="text"
                      value={parent.guardian_birth_place || ''}
                      onChange={(e) => setParent({ ...parent, guardian_birth_place: e.target.value })}
                      placeholder="Kota Lahir Wali"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Lahir Wali
                    </label>
                    <input
                      type="date"
                      value={parent.guardian_birth_date || ''}
                      onChange={(e) => setParent({ ...parent, guardian_birth_date: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pendidikan Terakhir Wali
                    </label>
                    <select
                      value={parent.guardian_education || 'SMA/Sederajat'}
                      onChange={(e) => setParent({ ...parent, guardian_education: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="SD/Sederajat">SD/Sederajat</option>
                      <option value="SMP/Sederajat">SMP/Sederajat</option>
                      <option value="SMA/Sederajat">SMA/Sederajat</option>
                      <option value="D1/D2/D3">D1/D2/D3</option>
                      <option value="S1">S1</option>
                      <option value="S2/S3">S2/S3</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pekerjaan Wali
                    </label>
                    <input
                      type="text"
                      value={parent.guardian_job || ''}
                      onChange={(e) => setParent({ ...parent, guardian_job: e.target.value })}
                      placeholder="Contoh: Wiraswasta, PNS, Karyawan"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Penghasilan Bulanan Wali
                    </label>
                    <select
                      value={parent.guardian_income || 'Rp 3.000.000 - Rp 5.000.000'}
                      onChange={(e) => setParent({ ...parent, guardian_income: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="< Rp 1.000.000">&lt; Rp 1.000.000</option>
                      <option value="Rp 1.000.000 - Rp 3.000.000">Rp 1.000.000 - Rp 3.000.000</option>
                      <option value="Rp 3.000.000 - Rp 5.000.000">Rp 3.000.000 - Rp 5.000.000</option>
                      <option value="Rp 5.000.000 - Rp 10.000.000">Rp 5.000.000 - Rp 10.000.000</option>
                      <option value="> Rp 10.000.000">&gt; Rp 10.000.000</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Telepon / WhatsApp Wali *
                    </label>
                    <input
                      type="tel"
                      value={parent.guardian_phone || ''}
                      onChange={(e) => setParent({ ...parent, guardian_phone: e.target.value })}
                      placeholder="081234567890"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Domisili Tempat Tinggal Wali *
                    </label>
                    <textarea
                      rows={2}
                      value={parent.guardian_address || ''}
                      onChange={(e) => setParent({ ...parent, guardian_address: e.target.value })}
                      placeholder="Alamat lengkap tempat tinggal wali saat ini (Jl, RT/RW, Kelurahan, Kecamatan, Kota)"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: SEKOLAH ASAL ================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 3: Data Madrasah / Sekolah Asal</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih jenjang sekolah asal terlebih dahulu, kemudian lengkapi rincian sekolah asal calon murid.
              </p>
            </div>

            {/* Pilihan Jenjang Sekolah Asal (Standard Dropdown Select) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilihan Jenjang Sekolah Asal *
              </label>
              <select
                value={schoolOrigin.previous_level || ''}
                onChange={(e) => {
                  const val = e.target.value as SchoolOrigin['previous_level'];
                  const isNone = val === 'Belum Pernah Sekolah';
                  const updated: SchoolOrigin = {
                    ...schoolOrigin,
                    previous_level: val,
                    school_name: isNone ? (schoolOrigin.school_name && schoolOrigin.school_name !== 'Belum Pernah Sekolah' ? schoolOrigin.school_name : 'Belum Pernah Sekolah') : (schoolOrigin.school_name === 'Belum Pernah Sekolah' ? '' : schoolOrigin.school_name),
                    npsn_nsm: isNone ? '-' : (schoolOrigin.npsn_nsm === '-' ? '' : schoolOrigin.npsn_nsm),
                    school_status: schoolOrigin.school_status || 'Negeri',
                    graduation_year: schoolOrigin.graduation_year || '2026',
                  };
                  setSchoolOrigin(updated);
                  storageService.saveSchoolOrigin(registrationNumber, updated);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="">-- Klik untuk memilih jenjang sekolah asal --</option>
                <option value="Belum Pernah Sekolah">Belum Pernah Sekolah (Pendaftar Baru Tanpa Sekolah Asal / Usia Dini)</option>
                <option value="RA/TK">RA / TK / PAUD (Raudhatul Athfal / Taman Kanak-Kanak / PAUD)</option>
                <option value="MI/SD">MI / SD (Madrasah Ibtidaiyah / Sekolah Dasar)</option>
                <option value="MTs/SMP">MTs / SMP (Madrasah Tsanawiyah / SMP)</option>
                <option value="Pesantren/Lainnya">Pesantren / PKBM / Pendidikan Non-Formal / Lainnya</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Pilih asal jenjang pendidikan calon murid sebelum mendaftar ke madrasah ini. Untuk pendaftar baru yang belum pernah sekolah sebelumnya, pilih opsi <strong>Belum Pernah Sekolah</strong>.
              </p>
            </div>

            {/* FORM RINCIAN SEKOLAH ASAL: HANYA MUNCUL JIKA JENJANG SUDAH DIPILIH */}
            {!schoolOrigin.previous_level ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-800">
                  Pilih Jenjang Sekolah Asal Terlebih Dahulu
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Silakan klik kolom pilihan jenjang sekolah asal di atas untuk menampilkan formulir rincian nama sekolah, status, dan tahun kelulusan.
                </p>
              </div>
            ) : schoolOrigin.previous_level === 'Belum Pernah Sekolah' ? (
              <div className="p-6 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl space-y-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-emerald-950">
                      Kategori Pendaftar: Belum Pernah Sekolah
                    </h4>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      Calon murid tercatat belum pernah menempuh pendidikan formal/non-formal sebelumnya. Data sekolah asal otomatis disesuaikan oleh sistem dan calon murid tidak diwajibkan mengisi NPSN atau Nomor Seri Ijazah.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Keterangan Status Sekolah Asal</label>
                    <input
                      type="text"
                      value={schoolOrigin.school_name || 'Belum Pernah Sekolah'}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, school_name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tahun Masuk / Pendaftaran</label>
                    <input
                      type="text"
                      value={schoolOrigin.graduation_year || '2026'}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, graduation_year: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-emerald-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-700" />
                    <h4 className="font-bold text-sm text-slate-900">
                      Rincian Identitas Sekolah Asal ({schoolOrigin.previous_level})
                    </h4>
                  </div>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Jenjang: {schoolOrigin.previous_level}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Madrasah / Sekolah Asal *
                    </label>
                    <input
                      type="text"
                      value={schoolOrigin.school_name}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, school_name: e.target.value })}
                      placeholder={`Contoh: ${
                        schoolOrigin.previous_level === 'RA/TK'
                          ? 'RA Perwanida 1 / TK Al-Azhar'
                          : schoolOrigin.previous_level === 'MI/SD'
                          ? 'MIN 1 Kota / SD Negeri 05 Pagi'
                          : schoolOrigin.previous_level === 'MTs/SMP'
                          ? 'MTs Negeri 1 Jakarta / SMP Negeri 5'
                          : 'Pondok Pesantren Al-Hikmah / PKBM Bina Mandiri'
                      }`}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Sekolah Asal *
                    </label>
                    <select
                      value={schoolOrigin.school_status || 'Negeri'}
                      onChange={(e) =>
                        setSchoolOrigin({
                          ...schoolOrigin,
                          school_status: e.target.value as 'Negeri' | 'Swasta',
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    >
                      <option value="Negeri">Negeri</option>
                      <option value="Swasta">Swasta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NPSN / NSM Sekolah Asal
                    </label>
                    <input
                      type="text"
                      value={schoolOrigin.npsn_nsm}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, npsn_nsm: e.target.value })}
                      placeholder="8 Digit NPSN / 12 Digit NSM"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Lulus *</label>
                    <select
                      value={schoolOrigin.graduation_year}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, graduation_year: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    >
                      <option value="2026">2026 (Tahun Ini)</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                      <option value="2023">2023</option>
                      <option value="2022">2022</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Seri Ijazah / SKL (Opsional)
                    </label>
                    <input
                      type="text"
                      value={schoolOrigin.diploma_number}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, diploma_number: e.target.value })}
                      placeholder="Nomor Ijazah atau Surat Keterangan Lulus"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Sekolah Asal
                    </label>
                    <textarea
                      rows={2}
                      value={schoolOrigin.school_address}
                      onChange={(e) => setSchoolOrigin({ ...schoolOrigin, school_address: e.target.value })}
                      placeholder="Jl. Nama Sekolah, Kelurahan/Desa, Kecamatan, Kabupaten/Kota, Provinsi"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 4: ALAMAT DOMISILI ================= */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 4: Alamat Domisili Sesuai KK</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Alamat ini menjadi rujukan resmi validasi dokumen Kartu Keluarga untuk sistem zonasi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap (Jalan, No Rumah, Gang, Patokan) *
                </label>
                <textarea
                  rows={2}
                  value={address.street_address}
                  onChange={(e) => setAddress({ ...address, street_address: e.target.value })}
                  placeholder="Contoh: Jl. Gandaria I No. 15B RT 04 RW 02"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RT *</label>
                  <input
                    type="text"
                    value={address.rt}
                    onChange={(e) => setAddress({ ...address, rt: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RW *</label>
                  <input
                    type="text"
                    value={address.rw}
                    onChange={(e) => setAddress({ ...address, rw: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan / Desa *</label>
                <input
                  type="text"
                  value={address.village}
                  onChange={(e) => setAddress({ ...address, village: e.target.value })}
                  placeholder="Nama Kelurahan"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan *</label>
                <input
                  type="text"
                  value={address.district}
                  onChange={(e) => setAddress({ ...address, district: e.target.value })}
                  placeholder="Nama Kecamatan"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kabupaten / Kota *</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Kota Administrasi / Kabupaten"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Provinsi *</label>
                <input
                  type="text"
                  value={address.province}
                  onChange={(e) => setAddress({ ...address, province: e.target.value })}
                  placeholder="Provinsi"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pos</label>
                <input
                  type="text"
                  maxLength={5}
                  value={address.postal_code}
                  onChange={(e) => setAddress({ ...address, postal_code: e.target.value.replace(/\D/g, '') })}
                  placeholder="5 Digit Kode Pos"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: LOKASI RUMAH & ZONASI ================= */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Step 5: Penentuan Lokasi Rumah & Sistem Zonasi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan titik atap rumah Anda pada peta. Sistem akan otomatis menghitung jarak ke madrasah.
                </p>
              </div>

              <div className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold self-start">
                Madrasah Tujuan: <strong>{effectiveSchool.school_name}</strong>
              </div>
            </div>

            {/* School Selector if multi-school */}
            {schools.length > 1 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-700" />
                  <label className="text-xs font-bold text-slate-700 shrink-0">
                    Ganti Madrasah Tujuan:
                  </label>
                </div>
                <select
                  value={application?.school_id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectSchool(e.target.value);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="" disabled>-- Pilih Madrasah Tujuan --</option>
                  {schools.map((s) => (
                    <option key={s.school_id} value={s.school_id}>
                      {s.school_name} ({s.level}) - Kode: {s.school_code || s.school_id} - Radius {s.zoning_radius_km} km
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Interactive Leaflet Map Picker */}
            <InteractiveLocationPicker
              school={effectiveSchool}
              initialLat={application.latitude}
              initialLng={application.longitude}
              onLocationChange={(lat, lng, dist, isCompliant) => {
                if (application) {
                  const updated: Application = {
                    ...application,
                    latitude: lat,
                    longitude: lng,
                    distance_km: dist,
                    max_distance_km: effectiveSchool.zoning_radius_km,
                    zoning_status: isCompliant ? 'memenuhi' : 'tidak_memenuhi',
                  };
                  setApplication(updated);
                  storageService.saveApplication(updated);
                }
              }}
            />

            {/* Out-of-Zonasi Advisory Alert */}
            {application.zoning_status === 'tidak_memenuhi' && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Lokasi Rumah di Luar Radius Zonasi ({effectiveSchool.zoning_radius_km} km)</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Jarak rumah Anda ({formatDistanceIndonesian(application.distance_km)}) melebihi radius zonasi madrasah. Anda disarankan memilih <strong>Jalur Afirmasi (Kategori Luar Zonasi)</strong> pada langkah berikutnya dengan melampirkan Surat Permohonan Dispensasi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDispensationModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Lihat Template Dispensasi</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 6: PILIH JALUR ================= */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 6: Pemilihan Jalur Penerimaan</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih salah satu dari 4 jalur pendaftaran yang sesuai dengan kriteria dan berkas calon murid.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Jalur Zonasi */}
              <div
                onClick={() => {
                  const updated: Application = { ...application, pathway: 'zonasi' };
                  setApplication(updated);
                  storageService.saveApplication(updated);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  application.pathway === 'zonasi'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      application.pathway === 'zonasi'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {application.pathway === 'zonasi' ? 'Dipilih' : 'Pilih Jalur'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 mt-3.5">Jalur Zonasi</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Diperuntukkan bagi calon peserta didik yang berdomisili di dalam wilayah radius zonasi madrasah terdekat.
                </p>

                <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Kuota Jalur:</span>
                    <strong className="text-slate-900">{effectiveSchool.quota_zonasi} Murid ({effectiveSchool.quota_percentage_zonasi || 50}%)</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Radius Maksimal:</span>
                    <strong className="text-slate-900">{effectiveSchool.zoning_radius_km} km</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Jarak Rumah Anda:</span>
                    <strong className={application.zoning_status === 'memenuhi' ? 'text-emerald-700' : 'text-rose-600'}>
                      {formatDistanceIndonesian(application.distance_km)} ({application.zoning_status === 'memenuhi' ? 'Memenuhi' : 'Luar Radius'})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Jalur Afirmasi */}
              <div
                onClick={() => {
                  const updated: Application = { ...application, pathway: 'afirmasi' };
                  setApplication(updated);
                  storageService.saveApplication(updated);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  application.pathway === 'afirmasi'
                    ? 'border-purple-600 bg-purple-50/40 shadow-md ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      application.pathway === 'afirmasi'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {application.pathway === 'afirmasi' ? 'Dipilih' : 'Pilih Jalur'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 mt-3.5">Jalur Afirmasi</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Diperuntukkan bagi calon murid dari keluarga ekonomi kurang mampu (pemegang KIP, PKH, KKS, atau DTKS).
                </p>

                <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Kuota Jalur:</span>
                    <strong className="text-slate-900">{effectiveSchool.quota_afirmasi} Murid ({effectiveSchool.quota_percentage_afirmasi || 20}%)</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Syarat Dokumen:</span>
                    <strong className="text-purple-700">Kartu KIP / PKH / KKS Asli</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pertimbangan Jarak:</span>
                    <span className="text-slate-700">Fleksibel (Lintas Zonasi)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Jalur Prestasi */}
              <div
                onClick={() => {
                  const updated: Application = { ...application, pathway: 'prestasi' };
                  setApplication(updated);
                  storageService.saveApplication(updated);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  application.pathway === 'prestasi'
                    ? 'border-amber-600 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      application.pathway === 'prestasi'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {application.pathway === 'prestasi' ? 'Dipilih' : 'Pilih Jalur'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 mt-3.5">Jalur Prestasi</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Bagi calon murid berprestasi dalam bidang Sains/Akademik (KSM, OSN), Keagamaan (Tahfidz Al-Qur'an), Seni atau Olahraga.
                </p>

                <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Kuota Jalur:</span>
                    <strong className="text-slate-900">{effectiveSchool.quota_prestasi || 40} Murid ({effectiveSchool.quota_percentage_prestasi || 20}%)</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Syarat Dokumen:</span>
                    <strong className="text-amber-800">Sertifikat / Piagam / Syahadah</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pertimbangan Jarak:</span>
                    <span className="text-slate-700">Bebas Domisili (Nasional/Daerah)</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Jalur Mutasi / Pindah Tugas Orang Tua */}
              <div
                onClick={() => {
                  const updated: Application = { ...application, pathway: 'mutasi' };
                  setApplication(updated);
                  storageService.saveApplication(updated);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  application.pathway === 'mutasi'
                    ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      application.pathway === 'mutasi'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {application.pathway === 'mutasi' ? 'Dipilih' : 'Pilih Jalur'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 mt-3.5">Jalur Mutasi Tugas Orang Tua</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Bagi calon peserta didik yang mengikuti kepindahan tugas kedinasan orang tua/wali (PNS, TNI, POLRI, BUMN, atau Lembaga Resmi).
                </p>

                <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Kuota Jalur:</span>
                    <strong className="text-slate-900">{effectiveSchool.quota_mutasi || 20} Murid ({effectiveSchool.quota_percentage_mutasi || 10}%)</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Syarat Dokumen:</span>
                    <strong className="text-blue-700">Surat Keputusan (SK) Penugasan</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pertimbangan Jarak:</span>
                    <span className="text-slate-700">Sesuai Lokasi Penugasan Baru</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Options for Afirmasi Pathway (Ekonomi vs Luar Zonasi) */}
            {application.pathway === 'afirmasi' && (
              <div className="p-5 bg-purple-50/70 border-2 border-purple-300 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-purple-700" />
                  <h4 className="font-bold text-sm text-purple-950">Kategori Pendaftaran Jalur Afirmasi</h4>
                </div>
                <p className="text-xs text-purple-900 leading-relaxed">
                  Jalur afirmasi dapat diikuti oleh calon murid dari keluarga ekonomi kurang mampu, <strong>serta calon murid dari luar zonasi</strong> yang mengajukan permohonan khusus dengan menyertakan Surat Dispensasi bermaterai Rp 10.000 (template disediakan sistem tanpa kop surat).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const updated: Application = {
                        ...application,
                        afirmasi_category: 'ekonomi_kurang_mampu',
                      };
                      setApplication(updated);
                      storageService.saveApplication(updated);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      (application.afirmasi_category || 'ekonomi_kurang_mampu') === 'ekonomi_kurang_mampu'
                        ? 'border-purple-600 bg-white ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-purple-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Keluarga Ekonomi Kurang Mampu</span>
                      {(application.afirmasi_category || 'ekonomi_kurang_mampu') === 'ekonomi_kurang_mampu' && (
                        <Check className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Memiliki kartu bantuan pemerintah (KIP, PKH, KKS, atau terdaftar DTKS).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated: Application = {
                        ...application,
                        afirmasi_category: 'luar_zonasi',
                      };
                      setApplication(updated);
                      storageService.saveApplication(updated);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      application.afirmasi_category === 'luar_zonasi'
                        ? 'border-purple-600 bg-white ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-purple-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Siswa Luar Zonasi (Dispensasi)</span>
                      {application.afirmasi_category === 'luar_zonasi' && (
                        <Check className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Domisili di luar radius zonasi dengan Surat Dispensasi bermaterai Rp 10.000.
                    </p>
                  </button>
                </div>

                {application.afirmasi_category === 'luar_zonasi' && (
                  <div className="p-4 bg-white rounded-xl border border-purple-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-purple-900 leading-relaxed">
                        <strong>Ketentuan Khusus Afirmasi Luar Zonasi:</strong>
                        <br />
                        Calon murid wajib mengunduh dan mencetak <strong>Template Surat Dispensasi</strong> (tanpa kop surat) yang telah disediakan otomatis oleh sistem di tahap Step 7 (Upload Dokumen), membubuhkan materai Rp 10.000, menandatangani, lalu mengunggahnya kembali.
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Alasan Permohonan Dispensasi Luar Zonasi (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        value={application.dispensation_reason || ''}
                        onChange={(e) => {
                          const updated: Application = {
                            ...application,
                            dispensation_reason: e.target.value,
                          };
                          setApplication(updated);
                          storageService.saveApplication(updated);
                        }}
                        placeholder="Contoh: Lokasi madrasah terdekat dengan tempat kerja orang tua / Tidak ada madrasah setingkat di kecamatan asal"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                      />
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDispensationModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>📄 Buka, Unduh & Cetak Template Surat Dispensasi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Additional Inputs for Prestasi Pathway */}
            {application.pathway === 'prestasi' && (
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-700" />
                  <h4 className="font-bold text-sm text-amber-950">Rincian Prestasi Calon Murid</h4>
                </div>
                <p className="text-xs text-amber-800">
                  Masukkan data kejuaraan atau sertifikat keagamaan / tahfidz yang dimiliki untuk penentuan skor bobot seleksi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis / Kategori Prestasi *</label>
                    <select
                      value={application.achievement_type || 'akademik'}
                      onChange={(e) => {
                        const updated: Application = {
                          ...application,
                          achievement_type: e.target.value as 'akademik' | 'non_akademik' | 'keagamaan',
                        };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="akademik">Akademik & Sains (KSM, OSN, Olimpiade)</option>
                      <option value="keagamaan">Keagamaan / Tahfidz Al-Qur'an (Juz)</option>
                      <option value="non_akademik">Non-Akademik (Seni, Olahraga, Pramuka, Robotik)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tingkat Kejuaraan / Sertifikasi *</label>
                    <select
                      value={application.achievement_level || 'kabupaten_kota'}
                      onChange={(e) => {
                        const updated: Application = {
                          ...application,
                          achievement_level: e.target.value as 'sekolah' | 'kabupaten_kota' | 'provinsi' | 'nasional' | 'internasional',
                        };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="internasional">Internasional</option>
                      <option value="nasional">Tingkat Nasional</option>
                      <option value="provinsi">Tingkat Provinsi</option>
                      <option value="kabupaten_kota">Tingkat Kabupaten / Kota</option>
                      <option value="sekolah">Tingkat Madrasah / Sekolah</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Kejuaraan / Hafalan *</label>
                    <input
                      type="text"
                      placeholder="Contoh: KSM Matematika Terintegrasi / Tahfidz 5 Juz"
                      value={application.achievement_name || ''}
                      onChange={(e) => {
                        const updated: Application = { ...application, achievement_name: e.target.value };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peringkat / Capaian *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Juara 1 (Medali Emas) / Mumtaz"
                      value={application.achievement_rank || ''}
                      onChange={(e) => {
                        const updated: Application = { ...application, achievement_rank: e.target.value };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Additional Inputs for Mutasi Pathway */}
            {application.pathway === 'mutasi' && (
              <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-700" />
                  <h4 className="font-bold text-sm text-blue-950">Rincian Kepindahan Tugas Orang Tua / Wali</h4>
                </div>
                <p className="text-xs text-blue-800">
                  Lengkapi data surat mutasi/penugasan resmi dari kantor instansi orang tua yang bersangkutan.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Instansi / Lembaga Penugasan *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Instansi Pemerintah / TNI-Polri / BUMN / Perusahaan Swasta"
                      value={application.mutation_parent_instansi || ''}
                      onChange={(e) => {
                        const updated: Application = { ...application, mutation_parent_instansi: e.target.value };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Surat Keputusan / Tugas *</label>
                    <input
                      type="text"
                      placeholder="Contoh: SK/894/MUT/I/2026"
                      value={application.mutation_letter_number || ''}
                      onChange={(e) => {
                        const updated: Application = { ...application, mutation_letter_number: e.target.value };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Surat Keputusan *</label>
                    <input
                      type="date"
                      value={application.mutation_letter_date || ''}
                      onChange={(e) => {
                        const updated: Application = { ...application, mutation_letter_date: e.target.value };
                        setApplication(updated);
                        storageService.saveApplication(updated);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 7: UPLOAD DOKUMEN ================= */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 7: Unggah Dokumen Persyaratan</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format yang didukung: JPG, PNG, PDF (Maks. 5 MB per file). Dokumen tersimpan aman di server penyimpanan berkas.
                </p>
              </div>

              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
                Penyimpanan Digital Siap
              </div>
            </div>

            {/* Notice & Download Button for Afirmasi Luar Zonasi Dispensasi Letter */}
            {application.pathway === 'afirmasi' && application.afirmasi_category === 'luar_zonasi' && (
              <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-purple-950">
                    <FileText className="w-4 h-4 text-purple-700" />
                    <span>Template Surat Dispensasi Resmi (Tanpa Kop Surat)</span>
                  </div>
                  <p className="text-xs text-purple-800">
                    Sistem telah menyediakan formulir template surat dispensasi pendaftaran luar zonasi. Silakan unduh/cetak, beri materai Rp 10.000, lalu ditandatangani orang tua/wali dan diunggah di bawah.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDispensationModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh / Cetak Template</span>
                </button>
              </div>
            )}

            {/* List of Required Documents */}
            <div className="space-y-4">
              {[
                {
                  type: 'foto',
                  title: 'Pas Foto 3x4 Calon Murid (Background Merah/Biru)',
                  required: true,
                  desc: 'Foto formal terbaru calon murid',
                },
                {
                  type: 'kartu_keluarga',
                  title: 'Kartu Keluarga (KK) Asli / Legalisir',
                  required: true,
                  desc: 'Memuat NIK dan nama calon murid',
                },
                {
                  type: 'akta_kelahiran',
                  title: 'Akta Kelahiran Calon Murid',
                  required: true,
                  desc: 'Sebagai bukti sah identitas dan tanggal lahir',
                },
                {
                  type: 'ijazah_skl',
                  title: 'Ijazah / Surat Keterangan Lulus (SKL)',
                  required: schoolOrigin.previous_level !== 'Belum Pernah Sekolah',
                  desc: schoolOrigin.previous_level === 'Belum Pernah Sekolah'
                    ? 'Opsional / tidak wajib bagi calon murid yang belum pernah bersekolah sebelumnya'
                    : 'Diterbitkan madrasah/sekolah jenjang sebelumnya',
                },
                ...(application.pathway === 'afirmasi'
                  ? application.afirmasi_category === 'luar_zonasi'
                    ? [
                        {
                          type: 'surat_dispensasi',
                          title: 'Surat Dispensasi Pendaftaran Luar Zonasi (Bermaterai Rp 10.000)',
                          required: true,
                          desc: 'Cetak template surat resmi yang telah disediakan di atas, beri materai Rp 10.000 dan tandatangani',
                          isDispensation: true,
                        },
                      ]
                    : [
                        {
                          type: 'kartu_afirmasi',
                          title: 'Kartu KIP / PKH / KKS / Surat Keterangan Afirmasi',
                          required: true,
                          desc: 'Wajib diunggah untuk verifikasi Jalur Afirmasi',
                        },
                      ]
                  : []),
                ...(application.pathway === 'prestasi'
                  ? [
                      {
                        type: 'sertifikat_prestasi',
                        title: 'Sertifikat / Piagam / Syahadah Prestasi (Asli/Legalisir)',
                        required: true,
                        desc: 'Wajib diunggah untuk pembobotan skor Jalur Prestasi (KSM/OSN/Tahfidz)',
                      },
                    ]
                  : []),
                ...(application.pathway === 'mutasi'
                  ? [
                      {
                        type: 'surat_mutasi',
                        title: 'Surat Keputusan (SK) Pindah Tugas / Surat Penugasan Orang Tua',
                        required: true,
                        desc: 'Wajib diunggah untuk pembuktian kepindahan tugas orang tua/wali',
                      },
                    ]
                  : []),
              ].map((item) => {
                const uploaded = documents.find((d) => d.document_type === item.type);
                const isImage =
                  uploaded?.file_data_base64?.startsWith('data:image') ||
                  item.type === 'foto' ||
                  (uploaded?.file_name && /\.(jpg|jpeg|png|webp)$/i.test(uploaded.file_name));

                return (
                  <div
                    key={item.type}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      item.type === 'surat_dispensasi'
                        ? 'bg-purple-50/50 border-purple-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {uploaded && isImage && uploaded.file_data_base64 ? (
                        <a
                          href={uploaded.file_data_base64}
                          target="_blank"
                          rel="noreferrer"
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 block hover:opacity-90 transition-opacity shadow-xs"
                          title="Klik untuk melihat gambar ukuran penuh"
                        >
                          <img
                            src={uploaded.file_data_base64}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </a>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <FileText className="w-5 h-5 text-emerald-700" />
                        </div>
                      )}

                      <div className="space-y-1 flex-1">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.required && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                              Wajib
                            </span>
                          )}
                          {uploaded && isImage && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded">
                              Foto Tersimpan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{item.desc}</p>

                        {item.type === 'surat_dispensasi' && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setShowDispensationModal(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-purple-700" />
                              <span>Buka Template (A4 / Unduh)</span>
                            </button>
                          </div>
                        )}

                        {uploaded && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium mt-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>
                              {uploaded.file_name} ({uploaded.file_size_kb} KB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {uploaded ? (
                        <>
                          <button
                            type="button"
                            onClick={() => downloadDocumentFile(uploaded)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                            title="Unduh file berkas ini"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh</span>
                          </button>
                          <a
                            href={uploaded.file_data_base64 || uploaded.drive_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(uploaded.document_id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Hapus file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih & Unggah File</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={(e) =>
                              handleFileUpload(e, item.type as DocumentItem['document_type'], item.title)
                            }
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= STEP 8: REVIEW SEBELUM SUBMIT ================= */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Step 8: Review Formulir Pendaftaran</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Periksa kembali seluruh data dengan teliti sebelum mengirimkan formulir final.
              </p>
            </div>

            {/* Summary Cards with Edit Buttons */}
            <div className="space-y-4">
              {/* Data Pribadi Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h4 className="font-bold text-sm text-slate-800">1. Data Pribadi</h4>
                  {!isFormLocked ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Nama:</span>
                    <div className="font-semibold text-slate-900">{student.name}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">NIK:</span>
                    <div className="font-semibold text-slate-900">{student.nik}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Jenis Kelamin:</span>
                    <div className="font-semibold text-slate-900">
                      {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">WhatsApp:</span>
                    <div className="font-semibold text-slate-900">{student.phone}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Hobi / Minat:</span>
                    <div className="font-semibold text-slate-900">{student.hobby || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Status Tinggal:</span>
                    <div className="font-semibold text-emerald-800 capitalize">
                      {student.living_status?.replace(/_/g, ' ') || 'Orang Tua Kandung'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Orang Tua Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h4 className="font-bold text-sm text-slate-800">2. Orang Tua / Wali</h4>
                  {!isFormLocked ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Nama Ayah:</span>
                    <div className="font-semibold text-slate-900">
                      {parent.father_name || '-'} ({parent.father_status || 'hidup'})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Pekerjaan Ayah:</span>
                    <div className="font-semibold text-slate-900">{parent.father_job || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Nama Ibu:</span>
                    <div className="font-semibold text-slate-900">
                      {parent.mother_name || '-'} ({parent.mother_status || 'hidup'})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Pekerjaan Ibu:</span>
                    <div className="font-semibold text-slate-900">{parent.mother_job || '-'}</div>
                  </div>

                  {student.living_status === 'wali_saudara' && (
                    <>
                      <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                        <span className="text-amber-800 font-bold">Nama Wali ({parent.guardian_relation || 'Wali'}):</span>
                        <div className="font-semibold text-slate-900">{parent.guardian_name || '-'} (NIK: {parent.guardian_nik || '-'})</div>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                        <span className="text-amber-800 font-bold">Kontak & Alamat Wali:</span>
                        <div className="font-semibold text-slate-900">{parent.guardian_phone || '-'} - {parent.guardian_address || '-'}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Sekolah Asal Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h4 className="font-bold text-sm text-slate-800">3. Madrasah / Sekolah Asal</h4>
                  {!isFormLocked ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Jenjang Asal:</span>
                    <div className="font-semibold text-emerald-800 font-bold">{schoolOrigin.previous_level || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Nama Sekolah:</span>
                    <div className="font-semibold text-slate-900">{schoolOrigin.school_name || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Status / NPSN:</span>
                    <div className="font-semibold text-slate-900">{schoolOrigin.school_status || 'Negeri'} ({schoolOrigin.npsn_nsm || '-'})</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tahun Lulus:</span>
                    <div className="font-semibold text-slate-900">{schoolOrigin.graduation_year || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Zonasi & Lokasi Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h4 className="font-bold text-sm text-slate-800">4. Lokasi & Zonasi</h4>
                  {!isFormLocked ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                        title="Ubah atau ganti madrasah tujuan"
                      >
                        Edit Pilihan
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleCancelSchool}
                        className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        title="Batalkan pilihan madrasah tujuan saat ini"
                      >
                        Batalkan Pilihan
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Madrasah Tujuan:</span>
                    <div className="font-semibold text-slate-900">{effectiveSchool.school_name}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Jalur Dipilih:</span>
                    <div className="font-bold text-emerald-800 uppercase">
                      Jalur {application.pathway} {application.pathway === 'afirmasi' && application.afirmasi_category === 'luar_zonasi' ? '(Luar Zonasi - Dispensasi)' : ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Jarak Zonasi:</span>
                    <div className="font-bold text-slate-900">
                      {formatDistanceIndonesian(application.distance_km)} (Status: {application.zoning_status ? application.zoning_status.toUpperCase() : 'TERHITUNG'})
                    </div>
                  </div>
                </div>

                {application.pathway === 'prestasi' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-amber-50/50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-amber-800 font-medium">Kategori & Tingkat:</span>
                      <div className="font-semibold text-slate-900 capitalize">
                        {application.achievement_type || '-'} ({application.achievement_level || '-'})
                      </div>
                    </div>
                    <div>
                      <span className="text-amber-800 font-medium">Nama Prestasi:</span>
                      <div className="font-semibold text-slate-900">{application.achievement_name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-amber-800 font-medium">Peringkat/Capaian:</span>
                      <div className="font-semibold text-slate-900">{application.achievement_rank || '-'}</div>
                    </div>
                  </div>
                )}

                {application.pathway === 'mutasi' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-blue-50/50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-blue-800 font-medium">Instansi Orang Tua:</span>
                      <div className="font-semibold text-slate-900">{application.mutation_parent_instansi || '-'}</div>
                    </div>
                    <div>
                      <span className="text-blue-800 font-medium">Nomor SK Tugas:</span>
                      <div className="font-semibold text-slate-900">{application.mutation_letter_number || '-'}</div>
                    </div>
                    <div>
                      <span className="text-blue-800 font-medium">Tanggal SK:</span>
                      <div className="font-semibold text-slate-900">{application.mutation_letter_date || '-'}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dokumen Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h4 className="font-bold text-sm text-slate-800">5. Dokumen Persyaratan ({documents.length} Berkas)</h4>
                  {!isFormLocked ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(7)}
                      className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {documents.map((d) => {
                    const isImg =
                      d.file_data_base64?.startsWith('data:image') ||
                      d.document_type === 'foto' ||
                      /\.(jpg|jpeg|png|webp)$/i.test(d.file_name);

                    return (
                      <div
                        key={d.document_id}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {isImg && d.file_data_base64 ? (
                            <img
                              src={d.file_data_base64}
                              alt={d.document_title}
                              className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="font-bold text-slate-800 truncate">{d.document_title}</div>
                            <div className="text-[10px] text-slate-400 truncate">{d.file_name}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadDocumentFile(d)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 transition-colors cursor-pointer"
                          title="Unduh Berkas"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {documents.length === 0 && (
                    <span className="text-rose-600 font-semibold col-span-2">Belum ada dokumen yang diunggah.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ceklist Tanda Kevalidan Data & Penguncian Permanen */}
            {isFormLocked ? (
              <div className="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Formulir Pendaftaran Telah Dikirim & Dikunci Permanen
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Seluruh checklist kevalidan data telah disetujui. Formulir ini tidak dapat diisi ulang atau diubah kembali demi menjaga integritas data.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-900 font-mono">
                    Status Dokumen: Terkunci Permanen ({application?.final_status?.toUpperCase() || 'SUBMITTED'})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(9)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Buka Bukti Pendaftaran (Step 9)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Ceklist Tanda Kevalidan Data & Penguncian Permanen
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Wajib mencentang ketiga checklist berikut sebelum formulir dikirimkan ke sistem panitia.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      allValidityConfirmed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {allValidityConfirmed ? '✓ 3/3 Checklist Lengkap' : 'Wajib 3 Checklist'}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Checklist 1: Keabsahan Biodata */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group bg-white/70 p-3 rounded-xl border border-amber-200/80 hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={validityStudentChecked}
                      onChange={(e) => {
                        setValidityStudentChecked(e.target.checked);
                        setAgreementChecked(e.target.checked && validityDocsChecked && validityLockChecked);
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="text-xs text-slate-800 leading-relaxed group-hover:text-slate-950">
                      <strong>1. Keabsahan Data Pribadi & Keluarga:</strong> Saya telah memeriksa dengan teliti dan menyatakan bahwa seluruh biodata siswa (Nama, NIK, NISN, Tempat/Tanggal Lahir), data orang tua/wali, serta riwayat sekolah asal adalah <strong>BENAR, VALID, dan SAH</strong> sesuai dokumen Kartu Keluarga dan Akta Kelahiran.
                    </div>
                  </label>

                  {/* Checklist 2: Keabsahan Berkas & Lokasi Zonasi */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group bg-white/70 p-3 rounded-xl border border-amber-200/80 hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={validityDocsChecked}
                      onChange={(e) => {
                        setValidityDocsChecked(e.target.checked);
                        setAgreementChecked(validityStudentChecked && e.target.checked && validityLockChecked);
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="text-xs text-slate-800 leading-relaxed group-hover:text-slate-950">
                      <strong>2. Keaslian Dokumen & Titik Koordinat Rumah:</strong> Saya menyatakan bahwa seluruh berkas persyaratan yang diunggah adalah <strong>DOKUMEN ASLI</strong> (bukan rekayasa), serta titik penandaan rumah pada peta zonasi akurat sesuai alamat domisili Kartu Keluarga sebenarnya.
                    </div>
                  </label>

                  {/* Checklist 3: Komitmen Kunci Permanen & Tidak Dapat Diisi Ulang */}
                  <label className="flex items-start gap-3 cursor-pointer select-none group bg-rose-50/60 p-3.5 rounded-xl border border-rose-300 hover:bg-rose-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={validityLockChecked}
                      onChange={(e) => {
                        setValidityLockChecked(e.target.checked);
                        setAgreementChecked(validityStudentChecked && validityDocsChecked && e.target.checked);
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300 cursor-pointer shrink-0"
                    />
                    <div className="text-xs text-slate-900 leading-relaxed group-hover:text-black">
                      <strong className="text-rose-700 font-bold">3. Penguncian Permanen Formulir:</strong> Saya memahami dan menyetujui sepenuhnya bahwa setelah menekan tombol kirim, <strong>SELURUH DATA PENDAFTARAN AKAN DIKUNCI PERMANEN, TIDAK DAPAT DIUBAH KEMBALI, DAN TIDAK BISA DIISI ULANG</strong> dengan akun ini demi menjaga ketertiban seleksi.
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 9: SUBMIT BERHASIL ================= */}
        {currentStep === 9 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-2xl font-black text-slate-900">
                Pendaftaran Berhasil Dikirim!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nomor pendaftaran Anda adalah{' '}
                <strong className="text-emerald-800 font-mono text-sm">{registrationNumber}</strong>. Formulir telah diteruskan ke panitia PPDB madrasah untuk tahap verifikasi berkas.
              </p>
            </div>

            {/* Non-payment Notice */}
            <div className="inline-block p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 max-w-md font-medium">
              ℹ️ <strong>PEMBAYARAN TIDAK DIPERLUKAN</strong>
              <br />
              Proses pendaftaran murid baru di madrasah negeri tidak dipungut biaya apapun (Gratis).
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {application.pathway === 'afirmasi' && application.afirmasi_category === 'luar_zonasi' && (
                <button
                  type="button"
                  onClick={() => setShowDispensationModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Cetak / Unduh Surat Dispensasi</span>
                </button>
              )}

              {onOpenPrint && (
                <button
                  type="button"
                  onClick={onOpenPrint}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Bukti Pendaftaran (A4)</span>
                </button>
              )}

              {onFinish && (
                <button
                  type="button"
                  onClick={onFinish}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm transition-all"
                >
                  <span>Lihat Status di Dashboard</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        {currentStep < 9 && (
          <div className="flex items-center justify-between pt-6 mt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            {currentStep < 8 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
              >
                <span>Lanjutkan</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : isFormLocked ? (
              <button
                type="button"
                onClick={() => setCurrentStep(9)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lihat Bukti Pendaftaran (Step 9)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitFinal}
                disabled={!allValidityConfirmed || isSubmitting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengunci & Mengirim Formulir...' : 'Kirim Pendaftaran Final & Kunci'}</span>
              </button>
            )}
          </div>
        )}
        {/* Dispensation Letter Modal */}
        {showDispensationModal && (
          <DispensationLetterModal
            isOpen={showDispensationModal}
            student={student}
            parent={parent}
            schoolOrigin={schoolOrigin}
            school={selectedSchool}
            address={address}
            application={application}
            reason={application?.dispensation_reason}
            onClose={() => setShowDispensationModal(false)}
          />
        )}
      </div>
    </div>
  );
};
