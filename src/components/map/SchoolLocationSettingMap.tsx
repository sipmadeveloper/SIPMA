import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, MapPin, Check, RefreshCw } from 'lucide-react';
import { School } from '../../types/sipma';

interface Props {
  school: School;
  onSaveLocation: (lat: number, lng: number, radiusKm: number) => void;
}

export const SchoolLocationSettingMap: React.FC<Props> = ({ school, onSaveLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [lat, setLat] = useState<number>(school.latitude);
  const [lng, setLng] = useState<number>(school.longitude);
  const [radiusKm, setRadiusKm] = useState<number>(school.zoning_radius_km);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const createIcon = () => {
    return L.divIcon({
      className: 'custom-admin-school-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-emerald-700 border-2 border-white shadow-2xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>
          </div>
          <div class="absolute -bottom-1.5 w-3 h-3 bg-emerald-800 rotate-45"></div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
    });
  };

  const updateMapElements = (newLat: number, newLng: number, newRadius: number) => {
    setLat(newLat);
    setLng(newLng);
    setRadiusKm(newRadius);

    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([newLat, newLng]);
      circleRef.current.setRadius(newRadius * 1000);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([newLat, newLng]);
    }
    setIsSaved(false);
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
        center: [school.latitude, school.longitude],
        zoom: 14,
      });
    } catch {
      return;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | SIPMA Madrasah',
    }).addTo(map);

    const marker = L.marker([school.latitude, school.longitude], {
      icon: createIcon(),
      draggable: true,
    }).addTo(map);

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateMapElements(pos.lat, pos.lng, radiusKm);
    });

    map.on('click', (e) => {
      updateMapElements(e.latlng.lat, e.latlng.lng, radiusKm);
    });

    markerRef.current = marker;

    const circle = L.circle([school.latitude, school.longitude], {
      radius: school.zoning_radius_km * 1000,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    circleRef.current = circle;
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
  }, [school.school_id]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=id&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        updateMapElements(newLat, newLng, radiusKm);
      }
    } catch {
      // search fallback
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualCoordinateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMapElements(lat, lng, radiusKm);
  };

  const handleSave = () => {
    onSaveLocation(lat, lng, radiusKm);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-4" id="sipma-school-location-settings">
      {/* Top Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="w-full sm:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama madrasah atau alamat (misal: Kebayoran Baru)..."
            className="w-full pl-9 pr-24 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-1.5 top-1 px-3 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md hover:bg-slate-900"
          >
            {isSearching ? 'Mencari...' : 'Cari'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSave}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
        >
          {isSaved ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          <span>{isSaved ? 'Lokasi Tersimpan!' : 'Simpan Pengaturan Lokasi & Radius'}</span>
        </button>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
        <div ref={mapContainerRef} className="w-full h-80 sm:h-96" />
      </div>

      {/* Parameter Setting Controls */}
      <form onSubmit={handleManualCoordinateSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Latitude Madrasah
          </label>
          <input
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-mono outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Longitude Madrasah
          </label>
          <input
            type="number"
            step="0.000001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-mono outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Radius Maksimal Zonasi (Kilometer)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="25"
              value={radiusKm}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1;
                setRadiusKm(val);
                if (circleRef.current) circleRef.current.setRadius(val * 1000);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-semibold outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold shrink-0"
              title="Perbarui Tampilan Peta"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
