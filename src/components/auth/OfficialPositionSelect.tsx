"use client";
import type { SelectHTMLAttributes } from "react";
import { STAFF_POSITIONS, staffPosition } from "@/lib/staff-access";

export function OfficialPositionSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} value={staffPosition(props.value)} required>
    <option value="">Select official position</option>
    {STAFF_POSITIONS.map(position => <option key={position}>{position}</option>)}
  </select>;
}
