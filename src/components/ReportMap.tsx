"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface ReportMapProps {
  latitude: number;
  longitude: number;
  label?: string;
}

export default function ReportMap({ latitude, longitude, label = "Report Location" }: ReportMapProps) {
  const customIcon = L.divIcon({
    className: "custom-report-pin",
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background: #ef4444;
          border: 2px solid white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #ef4444;
          margin-top: -2px;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  return (
    <div className="w-full h-full relative isolate overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={customIcon}>
          <Popup>
            <div className="font-semibold text-xs text-slate-800">{label}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
