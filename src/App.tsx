/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, Grid, Layers, Filter } from 'lucide-react';

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

function getCircleColor(circleNo: number) {
  if (!circleNo) return '#9e9e9e';
  const hue = (circleNo * 137.5) % 360;
  return `hsl(${hue}, 75%, 50%)`;
}

function getDivisionColor(divisionName: string, divisionList: any[]) {
  const idx = divisionList.findIndex((d) => d.name === divisionName);
  if (idx === -1) return '#9e9e9e';
  const hue = (idx * 30) % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

const extractCoordinates = (arr: any[]): [number, number][] => {
  let result: [number, number][] = [];
  if (arr.length > 0 && typeof arr[0] === 'number') {
    result.push([arr[0], arr[1]]);
    return result;
  }
  for (const item of arr) {
    if (Array.isArray(item)) {
      result = result.concat(extractCoordinates(item));
    }
  }
  return result;
};

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [allPolygons, setAllPolygons] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colorMode, setColorMode] = useState('circle');
  const [showLabels, setShowLabels] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');

  // ─── Data Loading: fetch exported MongoDB JSON files ────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/wards.json').then(res => res.json()),
      fetch('/divisions.json').then(res => res.json())
    ])
      .then(([wards, divs]) => {
        // Wards already come with populated circle (including division_name)
        // and geometry — no mapping or merging needed
        setAllPolygons(wards);
        setDivisions(divs);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading map data:", err);
        setError("Failed to load map data.");
        setLoading(false);
      });
  }, []);

  // Build a lookup: circleName -> divisionName from divisions data
  const circleToDivisionMap: Record<string, string> = {};
  divisions.forEach((div) => {
    (div.circle_names || []).forEach((cName: string) => {
      circleToDivisionMap[cName.toLowerCase()] = div.name;
    });
  });

  // Get the division name for a ward
  const getDivisionForWard = (ward: any) => {
    // Primary: populated circle's division_name
    if (ward.circle?.division_name) return ward.circle.division_name;
    // Fallback: look up by circle name
    const circleName = ward.circle?.name || ward.CIR_NAM_NU?.split('-').slice(1).join('-').trim();
    if (circleName) {
      return circleToDivisionMap[circleName.toLowerCase()] || null;
    }
    return null;
  };

  // Filter polygons by selected division
  const visiblePolygons = selectedDivision === 'all'
    ? allPolygons
    : allPolygons.filter((ward) => getDivisionForWard(ward) === selectedDivision);

  // Convert to GeoJSON for the map
  const getGeoJSONData = (): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: visiblePolygons
        .filter((w) => w.geometry && w.geometry.coordinates)
        .map((ward) => {
          const isCircle = ward.WARD_NO >= 304;
          const divName = getDivisionForWard(ward) || 'N/A';
          let fillColor = '#9e9e9e';

          if (colorMode === 'type') {
            fillColor = isCircle ? '#e91e63' : '#2196f3';
          } else if (colorMode === 'division') {
            fillColor = getDivisionColor(divName, divisions);
          } else {
            fillColor = getCircleColor(ward.CIRCLE_NO);
          }

          return {
            type: 'Feature',
            id: ward.WARD_NO,
            geometry: ward.geometry,
            properties: {
              wardId: ward._id,
              name: ward.NAME,
              ward_no: ward.WARD_NO,
              isCircle,
              circle_name: ward.CIR_NAM_NU || ward.circle?.CIR_NAM_NU || ward.circle?.name || 'N/A',
              circle_no: ward.CIRCLE_NO || 'N/A',
              division_name: divName,
              zone: ward.Zone_Name || 'N/A',
              ac: ward.AC_Name || 'N/A',
              corporate: ward.CORPORATE || 'N/A',
              area: ward.Area__Sqkm || 0,
              business_count: ward.business_count || 0,
              fillColor
            }
          };
        })
    };
  };

  // ─── Initialize Map ─────────────────────────────────────────
  useEffect(() => {
    if (loading || allPolygons.length === 0 || !mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE as any,
      center: [78.4867, 17.3850],
      zoom: 11,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');

    map.on('load', () => {
      map.addSource('polygons', {
        type: 'geojson',
        data: getGeoJSONData(),
        generateId: false,
      });

      map.addLayer({
        id: 'polygons-fill',
        type: 'fill',
        source: 'polygons',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.55,
            0.35,
          ],
        },
      });

      map.addLayer({
        id: 'polygons-outline',
        type: 'line',
        source: 'polygons',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#000000',
            '#3f51b5',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1.2,
          ],
        },
      });

      map.addLayer({
        id: 'polygons-label',
        type: 'symbol',
        source: 'polygons',
        layout: {
          'text-field': ['get', 'ward_no'],
          'text-size': 14,
          'text-anchor': 'center',
          'text-allow-overlap': false,
          visibility: showLabels ? 'visible' : 'none',
        },
        paint: {
          'text-color': '#1a237e',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });

      let hoveredId: string | number | null = null;
      map.on('mousemove', 'polygons-fill', (e) => {
        if (e.features && e.features.length > 0) {
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'polygons', id: hoveredId }, { hover: false });
          }
          hoveredId = e.features[0].properties.ward_no;
          map.setFeatureState({ source: 'polygons', id: hoveredId }, { hover: true });
          map.getCanvas().style.cursor = 'pointer';
        }
      });

      map.on('mouseleave', 'polygons-fill', () => {
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'polygons', id: hoveredId }, { hover: false });
        }
        hoveredId = null;
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'polygons-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties;
          const entityType = props.isCircle ? 'Standalone Circle' : 'Ward';
          const popupContent = `
            <div style="font-family: sans-serif; padding: 6px; min-width: 200px; font-size: 13px;">
              <div style="font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; color: #1a237e;">
                ${entityType}: ${props.name}
              </div>
              <strong>Ward/Circle No:</strong> ${props.ward_no}<br/>
              <strong>CT Circle:</strong> ${props.circle_name}<br/>
              <strong>CT Division:</strong> ${props.division_name}<br/>
              <strong>Zone:</strong> ${props.zone}<br/>
              <strong>AC Name:</strong> ${props.ac}
            </div>
          `;

          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
        }
      });

      fitMapBounds(visiblePolygons);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading]);

  // Sync data changes to the map source
  useEffect(() => {
    if (mapRef.current && mapRef.current.getSource('polygons')) {
      const source = mapRef.current.getSource('polygons') as maplibregl.GeoJSONSource;
      source.setData(getGeoJSONData());
    }
  }, [colorMode, allPolygons, selectedDivision, divisions]);

  // Fit bounds when division filter changes
  useEffect(() => {
    if (mapRef.current && visiblePolygons.length > 0) {
      fitMapBounds(visiblePolygons);
    }
  }, [selectedDivision]);

  // Sync label visibility
  useEffect(() => {
    if (mapRef.current && mapRef.current.getLayer('polygons-label')) {
      mapRef.current.setLayoutProperty(
        'polygons-label',
        'visibility',
        showLabels ? 'visible' : 'none'
      );
    }
  }, [showLabels]);

  const fitMapBounds = (polygons: any[]) => {
    if (!mapRef.current || polygons.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    polygons.forEach((ward) => {
      if (ward.geometry && ward.geometry.coordinates) {
        const coords = extractCoordinates(ward.geometry.coordinates);
        coords.forEach((coord: [number, number]) => bounds.extend(coord));
      }
    });
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 40 });
    }
  };

  const handleSearchResultClick = (poly: any) => {
    if (!mapRef.current || !poly.geometry) return;
    
    const bounds = new maplibregl.LngLatBounds();
    const coords = extractCoordinates(poly.geometry.coordinates);
    
    coords.forEach((coord: [number, number]) => bounds.extend(coord));
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    }
    
    mapRef.current.setFeatureState({ source: 'polygons', id: poly.WARD_NO }, { hover: true });
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.setFeatureState({ source: 'polygons', id: poly.WARD_NO }, { hover: false });
      }
    }, 3000);
  };

  const filteredPolygonsForSearch = visiblePolygons.filter((poly) => 
    poly.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    poly.WARD_NO?.toString().includes(searchTerm)
  );

  const wardCount = visiblePolygons.filter((w) => w.WARD_NO <= 303).length;
  const standaloneCircleCount = visiblePolygons.filter((w) => w.WARD_NO >= 304).length;

  // Real summary statistics from the exported data
  const summaryStatistics = {
    visiblePolygons: visiblePolygons.length,
    wards: wardCount,
    divisions: divisions.length,
    standalone: standaloneCircleCount,
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-neutral-50 overflow-hidden font-sans">
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-neutral-200 bg-white overflow-y-auto flex flex-col p-5 gap-6 shadow-sm z-10">
        
        <div>
          <h1 className="text-xl font-bold text-blue-700 tracking-tight">Unified Map View</h1>
          <p className="text-sm text-neutral-500 mt-1">Interactive representation of administrative areas and standalone circles.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="bg-white border text-neutral-800 border-neutral-200 rounded-xl p-4 shadow-sm">
          <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
            <Filter size={16} className="text-blue-600" /> Filter by CT Division
          </label>
          <select 
            value={selectedDivision} 
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="w-full text-sm border border-neutral-300 rounded-lg p-2 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="all">All Divisions ({allPolygons.length} polygons)</option>
            {divisions.map((div) => (
              <option key={div._id} value={div.name}>
                {div.name} ({div.circle_names?.length || 0} circles)
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border text-neutral-800 border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-3">
            <Grid size={16} className="text-blue-600" /> Color Grouping
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600 group">
              <input type="radio" value="circle" checked={colorMode === 'circle'} onChange={(e) => setColorMode(e.target.value)} className="w-4 h-4 text-blue-600 border-neutral-300 focus:ring-blue-500" />
              <span className="group-hover:text-neutral-900 transition-colors">By Circle</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600 group">
              <input type="radio" value="division" checked={colorMode === 'division'} onChange={(e) => setColorMode(e.target.value)} className="w-4 h-4 text-blue-600 border-neutral-300 focus:ring-blue-500" />
              <span className="group-hover:text-neutral-900 transition-colors">By Division</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600 group">
              <input type="radio" value="type" checked={colorMode === 'type'} onChange={(e) => setColorMode(e.target.value)} className="w-4 h-4 text-blue-600 border-neutral-300 focus:ring-blue-500" />
              <span className="group-hover:text-neutral-900 transition-colors">Wards vs Circles</span>
            </label>
          </div>
        </div>

        <div className="bg-white border text-neutral-800 border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-3">
            <Layers size={16} className="text-blue-600" /> Map Options
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none text-neutral-700">
            <div className="relative">
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="sr-only" />
              <div className={`block w-10 h-6 rounded-full transition-colors ${showLabels ? 'bg-blue-600' : 'bg-neutral-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showLabels ? 'transform translate-x-4' : ''}`}></div>
            </div>
            Show Ward Numbers
          </label>
        </div>

        <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-green-800 mb-3">
            {selectedDivision === 'all' ? 'Summary Statistics' : `${selectedDivision} Division`}
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-2">
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Visible Polygons</div>
              <div className="text-lg font-bold text-neutral-800">{summaryStatistics.visiblePolygons}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Wards</div>
              <div className="text-lg font-bold text-blue-700">{summaryStatistics.wards}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Divisions</div>
              <div className="text-lg font-bold text-emerald-600">{summaryStatistics.divisions}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Standalone</div>
              <div className="text-lg font-bold text-pink-600">{summaryStatistics.standalone}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border flex-1 min-h-0 min-h-[250px] text-neutral-800 border-neutral-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-3">
            <Search size={16} className="text-blue-600" /> Search & Locate
          </div>
          <div className="relative mb-3">
            <input 
              type="text" 
              placeholder="Type name or number..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border border-neutral-300 rounded-lg pl-9 pr-3 py-2 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
            />
            <Search size={14} className="absolute left-3 top-2.5 text-neutral-400" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchTerm ? (
              filteredPolygonsForSearch.length === 0 ? (
                <div className="text-xs text-neutral-500 text-center py-4">No matches found</div>
              ) : (
                <ul className="space-y-1">
                  {filteredPolygonsForSearch.slice(0, 15).map((poly) => (
                    <li 
                      key={poly._id} 
                      onClick={() => handleSearchResultClick(poly)}
                      className="p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors group"
                    >
                      <div className="font-semibold text-sm text-neutral-800 group-hover:text-blue-800">{poly.NAME}</div>
                      <div className="text-xs text-neutral-500 group-hover:text-blue-600/80">
                        {poly.WARD_NO >= 304 ? 'Circle' : 'Ward'} No: {poly.WARD_NO}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="text-xs text-neutral-400 text-center py-4 px-2">Type above to search & zoom to an area</div>
            )}
          </div>
        </div>

        <div className="bg-white border text-neutral-800 border-neutral-200 rounded-xl p-4 shadow-sm mb-4">
          <div className="text-sm font-semibold mb-3">Legend</div>
          {colorMode === 'type' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500 opacity-80" />
                <span className="text-sm text-neutral-600">Wards</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-pink-500 opacity-80" />
                <span className="text-sm text-neutral-600">Standalone Circles</span>
              </div>
            </div>
          ) : colorMode === 'division' ? (
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {divisions.map((div) => (
                <div key={div._id} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded opacity-80 shrink-0" style={{ backgroundColor: getDivisionColor(div.name, divisions) }} />
                  <span className="text-sm text-neutral-600 truncate">{div.name} ({div.circle_names?.length || 0})</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded opacity-80 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500" />
                <span className="text-sm text-neutral-600">Wards colored by parent Circle</span>
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="flex-1 relative h-full w-full">
        <div ref={mapContainerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-4 border-neutral-200 border-t-blue-600 animate-spin mb-4" />
              <div className="text-sm font-semibold text-neutral-700">Loading polygon geometries...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
