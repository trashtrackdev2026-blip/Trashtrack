"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function LogoutPage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
      
      {/* Absolute Logo on top left */}
      <div className="absolute top-8 left-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#2E7D32] flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="font-outfit font-bold text-xl text-slate-900">TrashTrack</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center max-w-lg w-full text-center">
        <div className="w-48 h-48 md:w-56 md:h-56 relative mb-8">
          <Image 
            src="/images/logout_illustration_v2.png" 
            alt="Logout Illustration" 
            fill
            className="object-contain mix-blend-multiply" 
            priority
          />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
          Are you logging out?
        </h1>
        
        <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed mb-12 max-w-sm mx-auto">
          You can always log back in at any time.
        </p>
        
        <div className="flex w-full items-center justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="w-36 md:w-40 rounded-full h-12 md:h-14 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleLogout} 
            disabled={loading}
            className="w-36 md:w-40 rounded-full h-12 md:h-14 bg-black text-white hover:bg-slate-800 font-bold text-sm"
          >
            {loading ? "Logging out..." : "Log out"}
          </Button>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-slate-400">
        &copy; {new Date().getFullYear()} Municipality of Balete, Batangas. All rights reserved.
      </div>
    </div>
  );
}
