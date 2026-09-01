import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Search, CheckCircle2, AlertCircle, School as SchoolIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { calculateHaversineDistance, checkZoningCompliance, formatDistanceIndonesian, formatCoordinates, reverseGeocode } from '../../utils/geo';
import { School } from '../../types/sipma';
import { useFeedback } from '../../context/FeedbackContext';

interface Props {
  school: School;
  initialLat?: number;
  initialLng?: number;
  readOnly?: boolean;
  onLocationChange?: (lat: number, lng: number, distanceKm: number, isCompliant: boolean, address?: string) => void;
}

export const InteractiveLocationPicker: React.FC<Props> = ({
  school,
  initialLat,
  initialLng,
  readOnly = false,
  onLocationChange,
}) => {
  const { showAlert, showToast } = useFeedback();
  const safeSchool: School = school || {
    school_id: 'SCH-DEFAULT',
    school_name: 'Madrasah',
    npsn: '20100000',
    level: 'MA',
    status: 'active',
    address: 'Jl. Madrasah No. 1',
    latitude: -6.2655,
    longitude: 106.7844,
    zoning_radius_km: 5,
    quota_zonasi: 100,
    quota_afirmasi: 30,
    quota_prestasi: 40,
    quota_mutasi: 10,
  };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const studentMarkerRef = useRef<L.Marker | null>(null);
  const schoolMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  const defaultLat = initialLat && initialLat !== 0 ? initialLat : safeSchool.latitude - 0.008;
  const defaultLng = initialLng && initialLng !== 0 ? initialLng : safeSchool.longitude + 0.006;

  const [currentLat, setCurrentLat] = useState<number>(defaultLat);
  const [currentLng, setCurrentLng] = useState<number>(defaultLng);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [isCompliant, setIsCompliant] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Custom Icon generators
  const createSchoolIcon = () => {
    return L.divIcon({
      className: 'custom-school-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 bg-emerald-700 rotate-45"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  const createStudentIcon = (withinRadius: boolean) => {
    const bgColor = withinRadius ? 'bg-blue-600' : 'bg-rose-600';
    return L.divIcon({
      className: 'custom-student-icon',
      html: `
        <div class="relative flex items-center justify-center group animate-bounce-short">
          <div class="w-10 h-10 rounded-full ${bgColor} border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 ${bgColor} rotate-45"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  // Update distance, compliance and notify parent
  const updatePosition = async (lat: number, lng: number, updateMap = false) => {
    setCurrentLat(lat);
    setCurrentLng(lng);

    const dist = calculateHaversineDistance(lat, lng, safeSchool.latitude, safeSchool.longitude);
    const compliant = checkZoningCompliance(dist, safeSchool.zoning_radius_km);
    setDistanceKm(dist);
    setIsCompliant(compliant);

    // Update marker on map
    if (studentMarkerRef.current) {
      studentMarkerRef.current.setLatLng([lat, lng]);
      studentMarkerRef.current.setIcon(createStudentIcon(compliant));
    }

    // Update line between school and student
    if (lineRef.current) {
      lineRef.current.setLatLngs([
        [safeSchool.latitude, safeSchool.longitude],
        [lat, lng],
      ]);
      lineRef.current.setStyle({
        color: compliant ? '#2563eb' : '#e11d48',
        dashArray: '6, 8',
      });
    }

    if (updateMap && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng]);
    }

    // Reverse geocode
    const addr = await reverseGeocode(lat, lng);
    setDetectedAddress(addr);

    if (onLocationChange) {
      onLocationChange(lat, lng, dist, compliant, addr);
    }
  };

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

    let map: L.Map;
    try {
      map = L.map(container, {
        center: [safeSchool.latitude, safeSchool.longitude],
        zoom: 14,
        zoomControl: false,
      });
    } catch {
      return;
    }

    // Tile Layer: OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | SIPMA Geospatial',
    }).addTo(map);

    // Add School Marker
    const schoolMarker = L.marker([safeSchool.latitude, safeSchool.longitude], {
      icon: createSchoolIcon(),
      interactive: true,
    }).addTo(map);

    schoolMarker.bindPopup(`
      <div class="p-2 font-sans">
        <h4 class="font-bold text-emerald-800 text-sm">${safeSchool.school_name}</h4>
        <p class="text-xs text-slate-600 mt-1">${safeSchool.address || ''}</p>
        <div class="mt-2 inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded">
          Radius Zonasi: ${safeSchool.zoning_radius_km} km
        </div>
      </div>
    `);
    schoolMarkerRef.current = schoolMarker;

    // Add Zonasi Radius Circle
    const circle = L.circle([safeSchool.latitude, safeSchool.longitude], {
      radius: safeSchool.zoning_radius_km * 1000,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '4, 6',
    }).addTo(map);
    circleRef.current = circle;

    // Initial student distance calculation
    const initDist = calculateHaversineDistance(defaultLat, defaultLng, safeSchool.latitude, safeSchool.longitude);
    const initCompliant = checkZoningCompliance(initDist, safeSchool.zoning_radius_km);
    setDistanceKm(initDist);
    setIsCompliant(initCompliant);

    // Add Student Marker
    const studentMarker = L.marker([defaultLat, defaultLng], {
      icon: createStudentIcon(initCompliant),
      draggable: !readOnly,
    }).addTo(map);

    studentMarker.bindPopup(`
      <div class="p-2 font-sans">
        <h4 class="font-bold text-slate-800 text-sm">Titik Rumah Calon Murid</h4>
        <p class="text-xs text-slate-600 mt-1">Geser marker ini untuk menyesuaikan lokasi tepat.</p>
      </div>
    `);

    if (!readOnly) {
      studentMarker.on('dragend', (e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        updatePosition(position.lat, position.lng);
      });

      map.on('click', (e) => {
        updatePosition(e.latlng.lat, e.latlng.lng);
      });
    }

    studentMarkerRef.current = studentMarker;

    // Add connector line
    const line = L.polyline(
      [
        [safeSchool.latitude, safeSchool.longitude],
        [defaultLat, defaultLng],
      ],
      {
        color: initCompliant ? '#2563eb' : '#e11d48',
        weight: 3,
        dashArray: '6, 8',
      }
    ).addTo(map);
    lineRef.current = line;

    mapInstanceRef.current = map;

    // Initial reverse geocode
    reverseGeocode(defaultLat, defaultLng).then((addr) => {
      setDetectedAddress(addr);
      if (onLocationChange) {
        onLocationChange(defaultLat, defaultLng, initDist, initCompliant, addr);
      }
    });

    // Fit bounds to show both school and student
    const bounds = L.latLngBounds([
      [safeSchool.latitude, safeSchool.longitude],
      [defaultLat, defaultLng],
    ]);
    map.fitBounds(bounds.pad(0.3));

    return () => {
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, [safeSchool.school_id]);

  // Handle Search Location
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=id&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        updatePosition(lat, lng, true);
      }
    } catch {
      // Ignore search error
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Device Geolocation
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      showAlert('Geolokasi Tidak Didukung', 'Browser Anda tidak mendukung deteksi geolokasi GPS.', 'warning');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updatePosition(lat, lng, true);
        showToast('Titik koordinat berhasil diperbarui dari GPS', 'success');
      },
      () => {
        setIsLocating(false);
        showAlert(
          'Izin Lokasi Diperlukan',
          'Gagal mengambil lokasi GPS perangkat. Pastikan izin akses lokasi telah diizinkan pada browser Anda.',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4" id="sipma-location-picker">
      {/* Search & GPS Controls */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleSearch} className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kelurahan, jalan, atau patokan rumah (misal: Kebayoran Baru, Jakarta)..."
              className="w-full pl-9 pr-24 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Mencari...' : 'Cari Titik'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGetDeviceLocation}
            disabled={isLocating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Navigation className={`w-4 h-4 text-emerald-600 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Mendeteksi GPS...' : 'Lokasi Saya'}</span>
          </button>
        </div>
      )}

      {/* Interactive Map Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-80 sm:h-96 z-0" />

        {/* Map Legend Overlay */}
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5 max-w-[220px]">
          <div className="font-semibold text-slate-800 border-b pb-1">Petunjuk Peta</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white shrink-0"></span>
            <span className="text-slate-700 truncate font-medium">{school.school_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isCompliant ? 'bg-blue-600' : 'bg-rose-600'} border border-white shrink-0`}></span>
            <span className="text-slate-700">Rumah Calon Murid</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-emerald-500 rounded-sm shrink-0"></span>
            <span className="text-slate-600">Batas Zonasi ({school.zoning_radius_km} km)</span>
          </div>
        </div>

        {/* Floating Zoom Buttons */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 hover:bg-slate-100 text-slate-700 border-b border-slate-100"
            title="Perbesar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 hover:bg-slate-100 text-slate-700"
            title="Perkecil"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Coordinate & Distance Live Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Distance Card */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Jarak ke Madrasah</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">
            {formatDistanceIndonesian(distanceKm)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <SchoolIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Maksimal radius: <strong>{safeSchool.zoning_radius_km} km</strong></span>
          </div>
        </div>

        {/* Status Zonasi Card */}
        <div
          className={`p-3.5 rounded-xl border shadow-xs ${
            isCompliant
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider">
            Status Kelayakan Zonasi
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isCompliant ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm text-emerald-800">
                  MEMENUHI SYARAT ZONASI
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-bold text-sm text-rose-800">
                  MELEBIHI BATAS RADIUS
                </span>
              </>
            )}
          </div>
          <div className="text-xs mt-1 opacity-80">
            {isCompliant
              ? 'Rumah berada dalam wilayah zonasi madrasah tujuan.'
              : 'Disarankan memilih Jalur Afirmasi atau madrasah terdekat.'}
          </div>
        </div>

        {/* Coordinate details */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Koordinat Terpilih</div>
          <div className="font-mono text-xs text-slate-800 mt-1 font-semibold">
            Lat: {currentLat.toFixed(6)}
            <br />
            Lng: {currentLng.toFixed(6)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 line-clamp-1" title={detectedAddress}>
            {detectedAddress || 'Mengambil alamat...'}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Tips:</strong> Anda dapat menggeser (drag & drop) marker biru pada peta atau klik langsung pada titik atap rumah Anda untuk mendapatkan presisi maksimal.
          </span>
        </div>
      )}
    </div>
  );
};
