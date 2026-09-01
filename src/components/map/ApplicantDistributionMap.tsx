import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { School, Application, StudentProfile } from '../../types/sipma';
import { formatDistanceIndonesian } from '../../utils/geo';

interface Props {
  school: School;
  applications: Application[];
  students: Record<string, StudentProfile>;
}

export const ApplicantDistributionMap: React.FC<Props> = ({ school, applications, students }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const safeSchool: School = school || {
    school_id: 'SCH-MAN1',
    npsn: '20100001',
    school_name: 'MAN 1 Kota Jakarta',
    level: 'MA',
    status: 'active',
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
  };

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
        zoom: 13,
      });
    } catch {
      return;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | SIPMA Distribution',
    }).addTo(map);

    // School Marker
    const schoolIcon = L.divIcon({
      className: 'admin-school-marker',
      html: `
        <div class="w-10 h-10 rounded-full bg-emerald-700 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold">
          🏛️
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([safeSchool.latitude, safeSchool.longitude], { icon: schoolIcon })
      .addTo(map)
      .bindPopup(`<strong>${safeSchool.school_name}</strong><br/>Radius Zonasi: ${safeSchool.zoning_radius_km} km`);

    // Radius Circle
    L.circle([safeSchool.latitude, safeSchool.longitude], {
      radius: safeSchool.zoning_radius_km * 1000,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    // Applicant markers
    const bounds = L.latLngBounds([[safeSchool.latitude, safeSchool.longitude]]);

    applications.forEach((app) => {
      if (!app.latitude || !app.longitude) return;

      bounds.extend([app.latitude, app.longitude]);

      const student = students[app.registration_number];
      const isZonasi = app.pathway === 'zonasi';
      const isCompliant = app.zoning_status === 'memenuhi';

      let markerColor = '#059669'; // green for zonasi
      let markerLetter = 'Z';
      if (app.pathway === 'afirmasi') {
        markerColor = '#9333ea'; // purple for afirmasi
        markerLetter = 'A';
      } else if (app.pathway === 'prestasi') {
        markerColor = '#d97706'; // amber for prestasi
        markerLetter = 'P';
      } else if (app.pathway === 'mutasi') {
        markerColor = '#2563eb'; // blue for mutasi
        markerLetter = 'M';
      }

      if (!isCompliant && app.pathway === 'zonasi') {
        markerColor = '#e11d48'; // red for out-of-bounds zonasi
      }

      const studentIcon = L.divIcon({
        className: 'applicant-map-dot',
        html: `
          <div style="background-color: ${markerColor};" class="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-bold">
            ${markerLetter}
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([app.latitude, app.longitude], { icon: studentIcon }).addTo(map);
      marker.bindPopup(`
        <div class="text-xs font-sans space-y-1">
          <div class="font-bold text-slate-900">${student?.name || app.registration_number}</div>
          <div class="text-slate-600">No: ${app.registration_number}</div>
          <div class="text-slate-600">Jalur: <span class="capitalize font-semibold">${app.pathway}</span></div>
          ${app.pathway === 'prestasi' && app.achievement_name ? `<div class="text-amber-800">Prestasi: <strong>${app.achievement_name}</strong></div>` : ''}
          ${app.pathway === 'mutasi' && app.mutation_parent_instansi ? `<div class="text-blue-800">Instansi: <strong>${app.mutation_parent_instansi}</strong></div>` : ''}
          <div class="text-slate-600">Jarak: <strong>${formatDistanceIndonesian(app.distance_km)}</strong></div>
          <div class="text-slate-600">Status: <span class="uppercase font-semibold">${app.final_status}</span></div>
        </div>
      `);
    });

    if (applications.length > 0) {
      map.fitBounds(bounds.pad(0.2));
    }

    mapInstanceRef.current = map;

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
  }, [safeSchool.school_id, applications]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
      <div ref={mapContainerRef} className="w-full h-80 sm:h-96" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 text-xs shadow-md space-y-1">
        <div className="font-semibold text-slate-800">Keterangan Marker:</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
          <span>Zonasi (Z)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-600"></span>
          <span>Afirmasi (A)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-600"></span>
          <span>Prestasi (P)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600"></span>
          <span>Mutasi (M)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-600"></span>
          <span>Luar Radius Zonasi</span>
        </div>
      </div>
    </div>
  );
};
