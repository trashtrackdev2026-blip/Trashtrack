"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  loadBaleteBoundaries,
  type BarangayBoundaries,
  type BarangayName,
} from "@/lib/barangay-geofence";

export interface BarangayStat {
  name: string;
  total: number;
  resolved: number;
  pending: number;
  color: string;
}

function concern(pending: number) {
  if (pending >= 30) return { color: "#DC2626", fillColor: "#EF4444", status: "High concern" };
  if (pending >= 10) return { color: "#D97706", fillColor: "#F59E0B", status: "Moderate concern" };
  return { color: "#2E7D32", fillColor: "#4CAF50", status: "Low concern" };
}

function BoundaryView({ data, selectedBarangay }: { data: BarangayBoundaries; selectedBarangay: string }) {
  const map = useMap();
  useEffect(() => {
    const features = selectedBarangay === "all-barangays" ? data.features
      : data.features.filter(feature => feature.properties.name === selectedBarangay);
    const visible: BarangayBoundaries = { ...data, features };
    const bounds = L.geoJSON(visible).getBounds();
    const fit = () => {
      map.invalidateSize();
      if (bounds.isValid()) map.fitBounds(bounds, {
        paddingTopLeft: [24, 35], paddingBottomRight: [24, 100], maxZoom: 16,
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [data, map, selectedBarangay]);
  return null;
}

function BarangayLabels({ data, stats, selectedBarangay }: {
  data: BarangayBoundaries; stats: BarangayStat[]; selectedBarangay: string;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return data.features.map(({ properties: props }) => {
    const pending = stats.find(stat => stat.name === props.name)?.pending ?? 0;
    const { color, status } = concern(pending);
    const showLabel = zoom >= 14 || selectedBarangay !== "all-barangays" || props.name === "Calawit";
    return (
      <CircleMarker key={props.psgc} center={[props.labelPoint[1], props.labelPoint[0]]}
        radius={4} pathOptions={{ color: "white", weight: 1.5, fillColor: color, fillOpacity: 1 }}>
        <Tooltip key={`${props.psgc}:${showLabel}`} direction="top" offset={[0, -3]} opacity={1}
          permanent={showLabel}>
          <span className="font-semibold text-[10px]">{props.name}</span>
        </Tooltip>
        <Popup>
          <strong>{props.name}</strong><br />Balete, Batangas<br />
          {status}: {pending} active reports<br />PSGC: {props.psgc}
        </Popup>
      </CircleMarker>
    );
  });
}

export default function Map({ barangayStats = [], selectedBarangay = "all-barangays" }: {
  barangayStats?: BarangayStat[]; selectedBarangay?: BarangayName | "all-barangays";
}) {
  const [boundaries, setBoundaries] = useState<BarangayBoundaries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    loadBaleteBoundaries().then(data => { if (!disposed) setBoundaries(data); })
      .catch(() => { if (!disposed) setError("Unable to load barangay boundaries. Please retry."); });
    return () => { disposed = true; };
  }, [attempt]);

  const displayData = useMemo(() => boundaries && ({
    ...boundaries,
    features: boundaries.features.map(feature => {
      const pending = barangayStats.find(stat => stat.name === feature.properties.name)?.pending ?? 0;
      return { ...feature, properties: { ...feature.properties, pending, ...concern(pending) } };
    }),
  }), [boundaries, barangayStats]);

  if (!boundaries || !displayData) return (
    <div className="w-full h-full bg-slate-100 rounded-xl flex flex-col gap-3 items-center justify-center text-slate-500" role="status">
      <span className="text-sm">{error ?? "Loading Balete barangay boundaries..."}</span>
      {error && <button className="text-sm font-semibold text-green-700 underline" onClick={() => {
        setError(null); setAttempt(value => value + 1);
      }}>Retry</button>}
    </div>
  );

  return (
    <div className="w-full h-full relative isolate overflow-hidden rounded-xl">
      <MapContainer center={[14.0, 121.07]} zoom={12} style={{ height: "100%", width: "100%", zIndex: 0 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Boundaries: NAMRIA/PSA via <a href="https://data.humdata.org/dataset/cod-ab-phl">OCHA</a>' />
        <BoundaryView data={boundaries} selectedBarangay={selectedBarangay} />
        <GeoJSON key={selectedBarangay + ":" + JSON.stringify(barangayStats)} data={displayData}
          style={feature => ({
            color: feature?.properties?.color, fillColor: feature?.properties?.fillColor,
            fillOpacity: selectedBarangay === "all-barangays" || feature?.properties?.name === selectedBarangay ? 0.22 : 0.04,
            weight: feature?.properties?.name === selectedBarangay ? 3 : 1.8,
          })}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            const content = document.createElement("div");
            content.style.whiteSpace = "pre-line";
            content.textContent = [props.name, "Balete, Batangas", "PSGC: " + props.psgc,
              props.status + ": " + props.pending + " active reports",
              "Published administrative boundary (PSGC 2023)",
              "Confirm disputed borders with the LGU."].join("\n");
            layer.bindPopup(content);
          }} />
        <BarangayLabels data={boundaries} stats={barangayStats} selectedBarangay={selectedBarangay} />
      </MapContainer>
      <div className="absolute top-3 right-3 z-[1000] rounded bg-white/95 px-2 py-1 text-[10px] text-slate-700 shadow pointer-events-none">
        13 barangays · Zoom in for labels
      </div>
    </div>
  );
}

