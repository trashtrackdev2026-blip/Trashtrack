import { LoginForm } from "@/components/auth/LoginForm";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      
      {/* Left Side: Login Form */}
      <div className="w-full md:w-[45%] p-8 md:p-12 lg:p-16 flex flex-col relative justify-between min-h-screen">
        
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded bg-[#2E7D32] flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="font-outfit font-bold text-xl text-[#2E7D32]">TrashTrack</span>
        </div>

        <div className="flex-1 flex flex-col justify-center w-full max-w-[360px] mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin sign-in</h1>
          <p className="text-xs text-slate-500 mb-8">
            Sign in as MENRO Master Admin<br/>or approved barangay staff.
          </p>

          <LoginForm />

          <div className="mt-16 text-center text-xs text-[#2E7D32] font-medium">
            Need approval or account recovery?<br/>
            Contact MENRO at the municipal office.
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} Municipality of Balete, Batangas. All rights reserved.
        </div>
      </div>

      {/* Right Side: Image with Overlay */}
      <div className="hidden md:flex w-full md:w-[55%] relative items-center justify-center">
        <Image 
          src="/images/trashtrack_bg.png" 
          alt="TrashTrack Smart Environment Background" 
          fill 
          sizes="(min-width: 768px) 55vw, 0px"
          loading="eager"
          className="object-cover"
        />
        
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-10 text-white w-full max-w-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
            <div className="w-8 h-8 rounded-full border-2 border-white mb-6"></div>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Sustainable Waste Management<br/>for a Greener Future
            </h2>
            <p className="text-white/90 text-sm leading-relaxed font-medium">
              Our platform provides comprehensive tools to monitor, manage, and optimize waste collection, ensuring a cleaner environment for the community.
            </p>
          </div>
        </div>
      </div>
      
    </div>
  );
}
