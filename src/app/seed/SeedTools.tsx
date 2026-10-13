"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SeedTools() {
  const [status, setStatus] = useState("Idle");

  const seedDatabase = async () => {
    setStatus("Seeding...");
    try {
      // 1. Seed Schedules
      const schedules = [
        { barangay: "Poblacion", day: "Monday", time: "8:00 AM", status: "Active" },
        { barangay: "Makina", day: "Tuesday", time: "8:00 AM", status: "Active" },
        { barangay: "Malabanan", day: "Wednesday", time: "8:00 AM", status: "Active" },
        { barangay: "Balete Proper", day: "Thursday", time: "8:00 AM", status: "Active" }
      ];
      for (const s of schedules) {
        await addDoc(collection(db, "schedules"), { ...s, createdAt: serverTimestamp() });
      }

      // 2. Seed Events
      const events = [
        { title: "Community Clean-Up Drive", barangay: "Poblacion", date: "Dec 6, 2025", time: "7:00 AM", participants: 0, status: "Upcoming", img: "https://images.unsplash.com/photo-1618477461853-cf6ed80f4886?w=400&q=80", description: "A community clean-up initiative." },
        { title: "Tree Planting Activity", barangay: "Makina", date: "Jun 14, 2025", time: "8:00 AM", participants: 43, status: "Completed", img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=80", description: "Planting trees for a greener tomorrow." }
      ];
      for (const e of events) {
        await addDoc(collection(db, "events"), { ...e, createdAt: serverTimestamp() });
      }

      // 3. Seed Educational Resources
      const resources = [
        { title: "Proper Waste Segregation Guide", category: "Waste Segregation", type: "Guide", status: "Published", image: "/images/bins-guide.jpg" },
        { title: "Plastic Pollution Awareness", category: "Environmental Awareness", type: "Video", status: "Published", image: "/images/plastic-video.jpg" }
      ];
      for (const r of resources) {
        await addDoc(collection(db, "educational_resources"), { ...r, createdAt: serverTimestamp() });
      }

      // 4. Seed Notifications
      const notifications = [
        { title: "New Report Submitted", message: "A new illegal dumping report was submitted in Poblacion.", isRead: false, type: "report" },
        { title: "Schedule Updated", message: "The collection schedule for Makina has been updated.", isRead: true, type: "schedule" }
      ];
      for (const n of notifications) {
        await addDoc(collection(db, "notifications"), { ...n, createdAt: serverTimestamp() });
      }

      setStatus("Seeding Complete! Check Firestore.");
    } catch (error: any) {
      console.error(error);
      setStatus("Error: " + error.message);
    }
  };

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-4">Database Seeder</h1>
      <p className="mb-6 text-slate-500">Clicking the button below will inject sample data into Firestore.</p>
      <button 
        onClick={seedDatabase}
        className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow hover:bg-green-700"
      >
        Seed Database
      </button>
      <p className="mt-6 text-lg font-bold">{status}</p>
    </div>
  );
}
