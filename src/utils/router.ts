/**
 * SIPMA SPA Routing & History Synchronization Manager
 * Provides URL Hash routing, browser back/forward navigation support,
 * and robust last-opened page persistence across reloads.
 */

export type ViewMode = 'landing' | 'login' | 'register' | 'app' | 'print_preview';

export type CentralTab =
  | 'overview'
  | 'schools'
  | 'admins'
  | 'applicants'
  | 'map'
  | 'config'
  | 'logs'
  | 'announcements';

export type SchoolTab = 'overview' | 'applicants' | 'selection' | 'map' | 'settings';

export type StudentTab = 'overview' | 'form' | 'print' | 'announcements' | 'profile';

export interface AppRoute {
  viewMode: ViewMode;
  centralTab?: CentralTab;
  schoolTab?: SchoolTab;
  studentTab?: StudentTab;
  printRegNumber?: string | null;
}

const STORAGE_KEY = 'sipma_active_route';
const VIEW_MODE_KEY = 'sipma_view_mode';

/**
 * Converts an AppRoute object into a browser URL hash.
 */
export function routeToHash(route: AppRoute): string {
  switch (route.viewMode) {
    case 'landing':
      return '#/landing';
    case 'login':
      return '#/login';
    case 'register':
      return '#/register';
    case 'print_preview':
      return route.printRegNumber
        ? `#/print?reg=${encodeURIComponent(route.printRegNumber)}`
        : '#/print';
    case 'app':
      if (route.centralTab) {
        return `#/admin/${route.centralTab}`;
      }
      if (route.schoolTab) {
        return `#/school/${route.schoolTab}`;
      }
      if (route.studentTab) {
        return `#/student/${route.studentTab}`;
      }
      return '#/app';
    default:
      return '#/landing';
  }
}

/**
 * Parses a browser URL hash into a structured AppRoute.
 */
export function hashToRoute(hashStr: string, userRole?: string): AppRoute {
  let clean = (hashStr || '').trim();
  if (clean.startsWith('#')) {
    clean = clean.substring(1);
  }
  if (clean.startsWith('/')) {
    clean = clean.substring(1);
  }

  // Handle query params in hash (e.g. print?reg=SIPMA-001)
  const [pathPart, queryPart] = clean.split('?');
  const params = new URLSearchParams(queryPart || '');

  // 1. Landing
  if (!pathPart || pathPart === 'landing' || pathPart === 'home' || pathPart === '') {
    return { viewMode: 'landing' };
  }

  // 2. Auth
  if (pathPart === 'login') {
    return { viewMode: 'login' };
  }
  if (pathPart === 'register' || pathPart === 'daftar') {
    return { viewMode: 'register' };
  }

  // 3. Print
  if (pathPart === 'print' || pathPart === 'print_preview' || pathPart === 'bukti') {
    const reg = params.get('reg') || localStorage.getItem('sipma_print_reg') || null;
    return {
      viewMode: 'print_preview',
      printRegNumber: reg,
    };
  }

  // 4. Admin Pusat routes
  if (pathPart.startsWith('admin/')) {
    const tab = pathPart.replace('admin/', '') as CentralTab;
    const validTabs: CentralTab[] = [
      'overview',
      'schools',
      'admins',
      'applicants',
      'map',
      'config',
      'logs',
      'announcements',
    ];
    return {
      viewMode: 'app',
      centralTab: validTabs.includes(tab) ? tab : 'overview',
    };
  }
  if (pathPart === 'admin') {
    const tab = (params.get('tab') as CentralTab) || 'overview';
    return { viewMode: 'app', centralTab: tab };
  }

  // 5. Admin Sekolah routes
  if (pathPart.startsWith('school/')) {
    const tab = pathPart.replace('school/', '') as SchoolTab;
    const validTabs: SchoolTab[] = ['overview', 'applicants', 'selection', 'map', 'settings'];
    return {
      viewMode: 'app',
      schoolTab: validTabs.includes(tab) ? tab : 'overview',
    };
  }
  if (pathPart === 'school') {
    const tab = (params.get('tab') as SchoolTab) || 'overview';
    return { viewMode: 'app', schoolTab: tab };
  }

  // 6. Calon Murid routes
  if (pathPart.startsWith('student/')) {
    const tab = pathPart.replace('student/', '') as StudentTab;
    const validTabs: StudentTab[] = ['overview', 'form', 'print', 'announcements', 'profile'];
    return {
      viewMode: 'app',
      studentTab: validTabs.includes(tab) ? tab : 'overview',
    };
  }
  if (pathPart === 'student') {
    const tab = (params.get('tab') as StudentTab) || 'overview';
    return { viewMode: 'app', studentTab: tab };
  }

  // 7. Generic /app with user role fallback
  if (pathPart === 'app' || pathPart === 'dashboard') {
    if (userRole === 'admin_pusat') {
      return { viewMode: 'app', centralTab: 'overview' };
    }
    if (userRole === 'admin_sekolah') {
      return { viewMode: 'app', schoolTab: 'overview' };
    }
    if (userRole === 'calon_murid') {
      return { viewMode: 'app', studentTab: 'overview' };
    }
    return { viewMode: 'app' };
  }

  // Check if it's one of direct tab names (e.g. #config, #applicants, #form)
  if (userRole === 'admin_pusat') {
    const validCentralTabs: CentralTab[] = [
      'overview',
      'schools',
      'admins',
      'applicants',
      'map',
      'config',
      'logs',
      'announcements',
    ];
    if (validCentralTabs.includes(pathPart as CentralTab)) {
      return { viewMode: 'app', centralTab: pathPart as CentralTab };
    }
  }

  if (userRole === 'admin_sekolah') {
    const validSchoolTabs: SchoolTab[] = ['overview', 'applicants', 'selection', 'map', 'settings'];
    if (validSchoolTabs.includes(pathPart as SchoolTab)) {
      return { viewMode: 'app', schoolTab: pathPart as SchoolTab };
    }
  }

  if (userRole === 'calon_murid') {
    const validStudentTabs: StudentTab[] = ['overview', 'form', 'print', 'announcements', 'profile'];
    if (validStudentTabs.includes(pathPart as StudentTab)) {
      return { viewMode: 'app', studentTab: pathPart as StudentTab };
    }
  }

  return { viewMode: 'landing' };
}

/**
 * Saves current route to LocalStorage for persistence across full page reloads.
 */
export function saveRoute(route: AppRoute): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
    localStorage.setItem(VIEW_MODE_KEY, route.viewMode);
    if (route.printRegNumber) {
      localStorage.setItem('sipma_print_reg', route.printRegNumber);
    }
  } catch (e) {
    console.error('Failed to save route to storage', e);
  }
}

/**
 * Retrieves the saved route from LocalStorage if available.
 */
export function getSavedRoute(): AppRoute | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.viewMode) {
        return parsed as AppRoute;
      }
    }
    const legacyView = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    if (legacyView) {
      return { viewMode: legacyView };
    }
  } catch (e) {
    console.error('Failed to parse saved route', e);
  }
  return null;
}

/**
 * Gets the initial route on page load by prioritizing:
 * 1. window.location.hash if present and meaningful
 * 2. Saved route in LocalStorage
 * 3. Default fallback based on currentUser status
 */
export function getInitialRoute(userRole?: string | null): AppRoute {
  const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
  
  if (currentHash && currentHash !== '#' && currentHash !== '#/' && currentHash !== '#/landing') {
    const parsed = hashToRoute(currentHash, userRole || undefined);
    // If parsed route requires auth but user is not logged in
    if (parsed.viewMode === 'app' && !userRole) {
      return { viewMode: 'login' };
    }
    return parsed;
  }

  // Check saved route from previous session/reload
  const saved = getSavedRoute();
  if (saved) {
    if (saved.viewMode === 'app' && !userRole) {
      return { viewMode: 'login' };
    }
    if (userRole && (saved.viewMode === 'login' || saved.viewMode === 'register')) {
      // User is already logged in, send to app
      if (userRole === 'admin_pusat') return { viewMode: 'app', centralTab: 'overview' };
      if (userRole === 'admin_sekolah') return { viewMode: 'app', schoolTab: 'overview' };
      if (userRole === 'calon_murid') return { viewMode: 'app', studentTab: 'overview' };
      return { viewMode: 'app' };
    }
    return saved;
  }

  // Default fallback
  if (userRole) {
    if (userRole === 'admin_pusat') return { viewMode: 'app', centralTab: 'overview' };
    if (userRole === 'admin_sekolah') return { viewMode: 'app', schoolTab: 'overview' };
    if (userRole === 'calon_murid') return { viewMode: 'app', studentTab: 'overview' };
    return { viewMode: 'app' };
  }

  return { viewMode: 'landing' };
}

/**
 * Pushes or replaces history state and updates URL hash.
 */
export function navigateToRoute(route: AppRoute, replace: boolean = false): void {
  saveRoute(route);
  const targetHash = routeToHash(route);

  if (typeof window !== 'undefined') {
    if (window.location.hash !== targetHash) {
      if (replace) {
        window.history.replaceState({ ...route }, '', targetHash);
      } else {
        window.history.pushState({ ...route }, '', targetHash);
      }
    }
  }
}
