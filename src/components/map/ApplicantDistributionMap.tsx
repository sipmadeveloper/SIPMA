import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  School,
  Application,
  StudentProfile,
  AddressData,
  PathwayType,
  VerificationStatus,
} from '../../types/sipma';
import { formatDistanceIndonesian, formatCoordinates } from '../../utils/geo';
import {
  MapPin,
  Layers,
  Search,
  Filter,
  Users,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  RotateCcw,
  Sliders,
  ExternalLink,
  Activity,
} from 'lucide-react';
import { storageService } from '../../services/storageService';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
  addresses?: Record<string, AddressData>;
  onSelectApplicant?: (regNumber: string) => void;
}

export const ApplicantDistributionMap: React.FC<Props> = ({
  school,
  applications,
  students,
  addresses,
  onSelectApplicant,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const schoolMarkerRef = useRef<L.Marker | null>(null);
  const zoningCircleRef = useRef<L.Circle | null>(null);
  const secondaryCircleRef = useRef<L.Circle | null>(null);

  // Filters and map state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPathway, setSelectedPathway] = useState<string>('all');
  const [selectedZoningFilter, setSelectedZoningFilter] = useState<'all' | 'inside' | 'outside'>('all');
  const [selectedVerificationFilter, setSelectedVerificationFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [tileLayerType, setTileLayerType] = useState<'streets' | 'satellite' | 'terrain'>('streets');
  const [showZoningRadius, setShowZoningRadius] = useState(true);
  const [showRadiusConcentric, setShowRadiusConcentric] = useState(true);
  const [activeApplicant, setActiveApplicant] = useState<Application | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const safeSchool: School = useMemo(() => {
    return (
      school || storageService.getSchools()[0] || {
        school_id: '',
        npsn: '',
        school_name: 'Madrasah',
        level: 'MI',
        status: 'active',
        address: '-',
        village: '',
        district: '',
        city: '',
        province: '',
        latitude: -6.964,
        longitude: 109.056,
        radius_zonasi_km: 1,
        zoning_radius_km: 1,
        quota_total: 0,
        quota_zonasi: 0,
        quota_afirmasi: 0,
        quota_prestasi: 0,
        quota_mutasi: 0,
      }
    );
  }, [school]);

  const zoningRadiusKm = safeSchool.zoning_radius_km || safeSchool.radius_zonasi_km || 5;

  // Filter applications
  const filteredApplicants = useMemo(() => {
    return applications.filter((app) => {
      // Must have valid coordinates
      if (
        app.latitude === undefined ||
        app.latitude === null ||
        isNaN(app.latitude) ||
        app.longitude === undefined ||
        app.longitude === null ||
        isNaN(app.longitude) ||
        (app.latitude === 0 && app.longitude === 0)
      ) {
        return false;
      }

      const student = students[app.registration_number];
      const name = (student?.name || '').toLowerCase();
      const reg = (app.registration_number || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      if (q && !name.includes(q) && !reg.includes(q)) {
        return false;
      }

      if (selectedPathway !== 'all' && app.pathway !== selectedPathway) {
        return false;
      }

      if (selectedVerificationFilter !== 'all' && app.verification_status !== selectedVerificationFilter) {
        return false;
      }

      if (selectedStatusFilter !== 'all' && app.final_status !== selectedStatusFilter) {
        return false;
      }

      const isInside = (app.distance_km ?? 999) <= zoningRadiusKm;
      if (selectedZoningFilter === 'inside' && !isInside) {
        return false;
      }
      if (selectedZoningFilter === 'outside' && isInside) {
        return false;
      }

      return true;
    });
  }, [
    applications,
    students,
    searchQuery,
    selectedPathway,
    selectedVerificationFilter,
    selectedStatusFilter,
    selectedZoningFilter,
    zoningRadiusKm,
  ]);

  // Statistics calculation for zoning reach
  const stats = useMemo(() => {
    let validCoords = 0;
    let insideZoning = 0;
    let outsideZoning = 0;
    let nearestKm = Infinity;
    let furthestKm = 0;
    let avgDistanceKm = 0;
    let totalDist = 0;

    applications.forEach((app) => {
      if (
        app.latitude !== undefined &&
        app.latitude !== null &&
        app.longitude !== undefined &&
        app.longitude !== null &&
        !(app.latitude === 0 && app.longitude === 0)
      ) {
        validCoords++;
        const dist = app.distance_km ?? 0;
        totalDist += dist;
        if (dist <= zoningRadiusKm) {
          insideZoning++;
        } else {
          outsideZoning++;
        }
        if (dist < nearestKm) nearestKm = dist;
        if (dist > furthestKm) furthestKm = dist;
      }
    });

    avgDistanceKm = validCoords > 0 ? totalDist / validCoords : 0;
    if (nearestKm === Infinity) nearestKm = 0;

    return {
      total: applications.length,
      mapped: validCoords,
      unmapped: applications.length - validCoords,
      insideZoning,
      outsideZoning,
      zoningReachPercent: validCoords > 0 ? Math.round((insideZoning / validCoords) * 100) : 0,
      nearestKm,
      furthestKm,
      avgDistanceKm,
    };
  }, [applications, zoningRadiusKm]);

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
    }
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const schoolLat = safeSchool.latitude || -6.2655;
    const schoolLon = safeSchool.longitude || 106.7844;

    const map = L.map(container, {
      center: [schoolLat, schoolLon],
      zoom: 13,
      zoomControl: false,
    });

    // Add zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Default tile layer
    const getTileUrl = () => {
      if (tileLayerType === 'satellite') {
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      }
      if (tileLayerType === 'terrain') {
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      }
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    };

    const tileAttribution =
      tileLayerType === 'satellite'
        ? '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const currentTileLayer = L.tileLayer(getTileUrl(), {
      maxZoom: 19,
      attribution: tileAttribution,
    }).addTo(map);

    // Group for applicant markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // School Marker (Distinctive Emerald Beacon)
    const schoolBeaconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping"></div>
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-800 to-teal-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-lg ring-4 ring-emerald-500/30">
          🏛️
        </div>
      </div>
    `;

    const schoolIcon = L.divIcon({
      className: 'school-beacon-marker',
      html: schoolBeaconHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const schoolMarker = L.marker([schoolLat, schoolLon], {
      icon: schoolIcon,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(
        `
        <div class="p-1 min-w-[200px]">
          <div class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide mb-1">
            Pusat Titik Madrasah
          </div>
          <h4 class="font-bold text-sm text-slate-900 leading-snug">${safeSchool.school_name}</h4>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">${safeSchool.address || ''}, ${safeSchool.village || ''}, ${safeSchool.district || ''}</p>
          <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-slate-500 font-medium">Radius Zonasi:</span>
            <span class="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${zoningRadiusKm} km</span>
          </div>
          <div class="mt-1 text-[11px] text-slate-500">
            Koordinat: ${formatCoordinates(schoolLat, schoolLon)}
          </div>
        </div>
        `,
        { maxWidth: 280 }
      );
    schoolMarkerRef.current = schoolMarker;

    // Primary Zoning Radius Circle
    const zoningCircle = L.circle([schoolLat, schoolLon], {
      radius: zoningRadiusKm * 1000,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      weight: 2.5,
      dashArray: '6, 6',
    }).addTo(map);
    zoningCircleRef.current = zoningCircle;

    // Optional Concentric Half-Radius Circle for visual zoning density gradient
    const secondaryCircle = L.circle([schoolLat, schoolLon], {
      radius: (zoningRadiusKm / 2) * 1000,
      color: '#0d9488',
      fillColor: '#14b8a6',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4',
    }).addTo(map);
    secondaryCircleRef.current = secondaryCircle;

    mapInstanceRef.current = map;

    return () => {
      try {
        currentTileLayer.remove();
        map.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, [safeSchool.school_id, safeSchool.latitude, safeSchool.longitude, zoningRadiusKm, tileLayerType]);

  // Update Markers when filters or data change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map) return;

    // Update Individual Markers
    if (!markersGroup) return;
    markersGroup.clearLayers();

    const schoolLat = safeSchool.latitude || -6.2655;
    const schoolLon = safeSchool.longitude || 106.7844;
    const bounds = L.latLngBounds([[schoolLat, schoolLon]]);

    filteredApplicants.forEach((app) => {
      if (!app.latitude || !app.longitude) return;

        bounds.extend([app.latitude, app.longitude]);

        const student = students[app.registration_number];
        const isInsideZoning = (app.distance_km ?? 999) <= zoningRadiusKm;

        // Color scheme based on pathway and zoning compliance
        let badgeBg = 'bg-emerald-600';
        let borderClr = 'border-white';
        let pathwayCode = 'Z';
        let pathwayLabel = 'Zonasi';

        if (app.pathway === 'afirmasi') {
          badgeBg = 'bg-purple-600';
          pathwayCode = 'A';
          pathwayLabel = 'Afirmasi';
        } else if (app.pathway === 'prestasi') {
          badgeBg = 'bg-amber-600';
          pathwayCode = 'P';
          pathwayLabel = 'Prestasi';
        } else if (app.pathway === 'mutasi') {
          badgeBg = 'bg-blue-600';
          pathwayCode = 'M';
          pathwayLabel = 'Mutasi';
        }

        // If out of zoning radius, highlight border with rose/red
        if (!isInsideZoning) {
          borderClr = 'border-rose-400 ring-2 ring-rose-500/40';
        }

        const isSelected = activeApplicant?.registration_number === app.registration_number;

        const markerHtml = `
          <div class="relative group cursor-pointer transition-transform hover:scale-125 ${isSelected ? 'scale-135 z-50' : ''}">
            <div class="w-7 h-7 rounded-full ${badgeBg} ${borderClr} border-2 shadow-lg flex items-center justify-center text-white text-[10px] font-black tracking-tight">
              ${pathwayCode}
            </div>
            ${
              !isInsideZoning
                ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>'
                : ''
            }
          </div>
        `;

        const markerIcon = L.divIcon({
          className: 'applicant-custom-marker',
          html: markerHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([app.latitude, app.longitude], {
          icon: markerIcon,
        }).addTo(markersGroup);

        // Bind rich popup with complete details
        const popupContent = `
          <div class="p-1.5 min-w-[220px] font-sans">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                isInsideZoning ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }">
                ${isInsideZoning ? '✓ Masuk Radius Zonasi' : '✕ Di Luar Radius'}
              </span>
              <span class="text-[10px] font-mono text-slate-500 font-semibold">${app.registration_number}</span>
            </div>

            <h4 class="font-extrabold text-sm text-slate-900 leading-snug">
              ${student?.name || 'Calon Murid'}
            </h4>

            <div class="mt-2 space-y-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div class="flex justify-between">
                <span class="text-slate-500">Jalur:</span>
                <span class="font-bold text-slate-800 capitalize">${pathwayLabel}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Jarak ke Madrasah:</span>
                <span class="font-black ${isInsideZoning ? 'text-emerald-700' : 'text-rose-700'}">
                  ${formatDistanceIndonesian(app.distance_km)}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Verifikasi:</span>
                <span class="font-semibold capitalize ${
                  app.verification_status === 'terverifikasi'
                    ? 'text-emerald-700'
                    : app.verification_status === 'ditolak'
                    ? 'text-rose-700'
                    : 'text-amber-700'
                }">${app.verification_status || 'menunggu'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Hasil Seleksi:</span>
                <span class="font-bold uppercase ${
                  app.final_status === 'lulus'
                    ? 'text-emerald-700'
                    : app.final_status === 'tidak_lulus'
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }">${app.final_status || 'menunggu'}</span>
              </div>
            </div>

            <div class="mt-2 text-[10px] text-slate-400 font-mono">
              Koordinat: ${formatCoordinates(app.latitude, app.longitude)}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 290 });

        marker.on('click', () => {
          setActiveApplicant(app);
        });
      });

    // If we have applicants, smoothly fit bounds
    if (filteredApplicants.length > 0) {
      map.fitBounds(bounds.pad(0.15));
    }
  }, [
    filteredApplicants,
    students,
    zoningRadiusKm,
    safeSchool,
    activeApplicant,
  ]);

  // Toggle zoning circle visibility
  useEffect(() => {
    if (zoningCircleRef.current) {
      if (showZoningRadius) {
        zoningCircleRef.current.setStyle({ opacity: 1, fillOpacity: 0.12 });
      } else {
        zoningCircleRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
      }
    }
    if (secondaryCircleRef.current) {
      if (showZoningRadius && showRadiusConcentric) {
        secondaryCircleRef.current.setStyle({ opacity: 1, fillOpacity: 0.08 });
      } else {
        secondaryCircleRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
      }
    }
  }, [showZoningRadius, showRadiusConcentric]);

  // Recenter map to school
  const handleRecenterSchool = () => {
    if (!mapInstanceRef.current) return;
    const lat = safeSchool.latitude || -6.2655;
    const lon = safeSchool.longitude || 106.7844;
    mapInstanceRef.current.flyTo([lat, lon], 14, { duration: 1 });
    if (schoolMarkerRef.current) {
      schoolMarkerRef.current.openPopup();
    }
  };

  // Fit all applicants
  const handleFitAllApplicants = () => {
    if (!mapInstanceRef.current || filteredApplicants.length === 0) return;
    const schoolLat = safeSchool.latitude || -6.2655;
    const schoolLon = safeSchool.longitude || 106.7844;
    const bounds = L.latLngBounds([[schoolLat, schoolLon]]);
    filteredApplicants.forEach((app) => {
      if (app.latitude && app.longitude) {
        bounds.extend([app.latitude, app.longitude]);
      }
    });
    mapInstanceRef.current.fitBounds(bounds.pad(0.2), { animate: true, duration: 1 });
  };

  // Fly to specific applicant
  const handleFocusApplicant = (app: Application) => {
    if (!mapInstanceRef.current || !app.latitude || !app.longitude) return;
    setActiveApplicant(app);
    mapInstanceRef.current.flyTo([app.latitude, app.longitude], 16, { duration: 1 });
  };

  return (
    <div className="space-y-4" id="sipma-applicant-distribution-map-view">
      {/* Top Metric Cards: Zoning Reach & Visual Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Pendaftar Terpetakan</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">
            {stats.mapped} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">
            {stats.unmapped > 0 ? `${stats.unmapped} tanpa koordinat` : 'Semua memiliki koordinat'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Dalam Radius ({zoningRadiusKm} km)</div>
          <div className="text-xl font-black text-emerald-950 mt-0.5">{stats.insideZoning}</div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-1">
            {stats.zoningReachPercent}% dari terpetakan
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white p-3.5 rounded-xl border border-rose-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Luar Radius Zonasi</div>
          <div className="text-xl font-black text-rose-950 mt-0.5">{stats.outsideZoning}</div>
          <div className="text-[10px] text-rose-700 font-semibold mt-1">
            {stats.mapped > 0 ? Math.round((stats.outsideZoning / stats.mapped) * 100) : 0}% di luar batas
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Jarak Terdekat</div>
          <div className="text-xl font-black text-teal-700 mt-0.5">
            {formatDistanceIndonesian(stats.nearestKm)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Paling dekat ke madrasah</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Jarak Terjauh</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">
            {formatDistanceIndonesian(stats.furthestKm)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Titik terjauh tercatat</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Rata-Rata Jarak</div>
          <div className="text-xl font-black text-indigo-700 mt-0.5">
            {formatDistanceIndonesian(stats.avgDistanceKm)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Sebaran rata-rata siswa</div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari murid di peta..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pathway Filter */}
          <select
            value={selectedPathway}
            onChange={(e) => setSelectedPathway(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Jalur</option>
            <option value="zonasi">Zonasi (Hijau)</option>
            <option value="afirmasi">Afirmasi (Ungu)</option>
            <option value="prestasi">Prestasi (Amber)</option>
            <option value="mutasi">Mutasi (Biru)</option>
          </select>

          {/* Zoning Reach Filter */}
          <select
            value={selectedZoningFilter}
            onChange={(e) => setSelectedZoningFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Jangkauan</option>
            <option value="inside">✓ Dalam Radius ({zoningRadiusKm} km)</option>
            <option value="outside">✕ Luar Radius Zonasi</option>
          </select>

          {/* Map Layer Type */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-300 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setTileLayerType('streets')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tileLayerType === 'streets' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jalan
            </button>
            <button
              type="button"
              onClick={() => setTileLayerType('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tileLayerType === 'satellite' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satelit
            </button>
            <button
              type="button"
              onClick={() => setTileLayerType('terrain')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                tileLayerType === 'terrain' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Topografi
            </button>
          </div>

          {/* Recenter / Action Buttons */}
          <button
            type="button"
            onClick={handleRecenterSchool}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="Kembalikan fokus ke titik koordinat madrasah"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Pusat Madrasah</span>
          </button>

          <button
            type="button"
            onClick={handleFitAllApplicants}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Sesuaikan zoom layar mencakup seluruh pendaftar"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Semua Titik</span>
          </button>

          <button
            type="button"
            onClick={() => setShowZoningRadius(!showZoningRadius)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              showZoningRadius
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-50 border-slate-300 text-slate-500'
            }`}
            title="Sembunyikan atau tampilkan lingkaran radius zonasi"
          >
            Lingkaran Zonasi: {showZoningRadius ? 'Aktif' : 'Nonaktif'}
          </button>
        </div>
      </div>

      {/* Main Map Visual Container with Interactive List Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map Stage (3 Columns on desktop) */}
        <div className={`${isSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} relative transition-all duration-200`}>
          <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-md relative bg-slate-100">
            {/* The Leaflet Canvas */}
            <div ref={mapContainerRef} className="w-full h-[520px] sm:h-[620px] z-0" />

            {/* Bottom-left interactive Legend Floating Badge */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl max-w-xs text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-extrabold text-slate-900 text-xs">Legenda & Indikator</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                  Radius {zoningRadiusKm} km
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 border border-white flex items-center justify-center text-white text-[9px] font-bold">Z</span>
                  <span>Zonasi (Z)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-purple-600 border border-white flex items-center justify-center text-white text-[9px] font-bold">A</span>
                  <span>Afirmasi (A)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-600 border border-white flex items-center justify-center text-white text-[9px] font-bold">P</span>
                  <span>Prestasi (P)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 border border-white flex items-center justify-center text-white text-[9px] font-bold">M</span>
                  <span>Mutasi (M)</span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-2 text-[11px]">
                <span className="w-4 h-4 rounded-full border-2 border-rose-500 bg-rose-100 flex items-center justify-center text-rose-700 text-[10px] font-black">!</span>
                <span className="text-slate-700">Titik Berada di Luar Radius Zonasi</span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                <span className="w-4 h-4 rounded-lg bg-emerald-800 flex items-center justify-center text-[10px]">🏛️</span>
                <span>Titik Geografis Madrasah</span>
              </div>
            </div>

            {/* Toggle Sidebar Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md text-xs font-bold text-slate-700 hover:bg-white flex items-center gap-1.5 cursor-pointer"
              title="Sembunyikan/Tampilkan Daftar Siswa di Samping Peta"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isSidebarOpen ? 'Sembunyikan Panel Murid' : `Tampilkan Murid (${filteredApplicants.length})`}</span>
            </button>
          </div>
        </div>

        {/* Sidebar: Interactive Applicant List (1 Column on desktop) */}
        {isSidebarOpen && (
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px] sm:h-[620px] overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Daftar Titik ({filteredApplicants.length})
                </h4>
                <p className="text-[10px] text-slate-500">Klik calon murid untuk fokus di peta</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Live Pin
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5">
              {filteredApplicants.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                  <MapPin className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                  <div>Tidak ada titik pendaftar yang cocok dengan filter aktif.</div>
                </div>
              ) : (
                filteredApplicants.map((app) => {
                  const student = students[app.registration_number];
                  const isInside = (app.distance_km ?? 999) <= zoningRadiusKm;
                  const isSelected = activeApplicant?.registration_number === app.registration_number;

                  return (
                    <div
                      key={app.registration_number}
                      onClick={() => handleFocusApplicant(app)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer text-left space-y-1 ${
                        isSelected
                          ? 'bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-500/20 shadow-xs'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 truncate max-w-[140px]">
                          {student?.name || app.registration_number}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isInside ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isInside ? 'Dalam Zonasi' : 'Luar Radius'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono text-[10px]">{app.registration_number}</span>
                        <span className="font-bold text-slate-800">
                          {formatDistanceIndonesian(app.distance_km)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="capitalize font-semibold text-slate-600">Jalur: {app.pathway}</span>
                        {onSelectApplicant && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectApplicant(app.registration_number);
                            }}
                            className="text-emerald-700 hover:underline font-bold inline-flex items-center gap-0.5"
                          >
                            <span>Detail</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer Stats */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 font-medium">
              Radius Zonasi Aktif: <strong className="text-emerald-700">{zoningRadiusKm} km</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
