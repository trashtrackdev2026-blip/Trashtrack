"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, 
  FileText, 
  PlayCircle, 
  Folder, 
  Search, 
  ChevronDown,
  Eye,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  User,
  Globe,
  Check
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect } from "react";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface ResourceData {
  id: string;
  title: string;
  category: string;
  type: string;
  date: string;
  status: string;
  image: string;
}

export default function EducationPage() {
  const { role } = useAuth();
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retryData = () => { setLoading(true); setDataError(null); setAttempt(value => value + 1); };
  const [activeResource, setActiveResource] = useState<ResourceData | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter State
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all-categories");
  const [type, setType] = useState("all-types");
  const [status, setStatus] = useState("all-status");

  const filteredResources = resources.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all-categories" || item.category.toLowerCase().replace(/\s+/g, '-') === category || item.category.toLowerCase() === category;
    const matchesType = type === "all-types" || item.type.toLowerCase() === type;
    const matchesStatus = status === "all-status" || item.status.toLowerCase() === status;
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "educational_resources"), querySnapshot => {
      const resourcesList: ResourceData[] = [];
      querySnapshot.forEach((doc) => {
        resourcesList.push({ id: doc.id, ...doc.data() } as ResourceData);
      });
      setResources(resourcesList);
      setActiveResource(current => resourcesList.find(item => item.id === current?.id) || resourcesList[0] || null);
      setLoading(false);
      setDataError(null);
    }, error => { setDataError(error.message.includes("taking too long") ? error.message : "Unable to load learning resources. Check your connection and retry."); setLoading(false); });
  }, [role, attempt]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
      try {
        await deleteDoc(doc(db, "educational_resources", id));
      } catch (error) {
        console.error("Error deleting resource:", error);
      }
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={dataError} onRetry={retryData} />
        
        {/* Header */}
        <div className="flex flex-col gap-2 mb-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Education Resources</h1>
          <p className="text-sm text-slate-500">Manage educational materials, guides, videos, and waste classification information for residents.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Total Resources" 
            value={resources.length.toString()} 
            subtitle="All published materials" 
            icon={<BookOpen className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Guides" 
            value={resources.filter(r => r.type.toLowerCase() === 'guide').length.toString()} 
            subtitle="Educational guides" 
            icon={<FileText className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Videos" 
            value={resources.filter(r => r.type.toLowerCase() === 'video').length.toString()} 
            subtitle="Awareness videos" 
            icon={<PlayCircle className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
          <KpiCard 
            title="Categories" 
            value={new Set(resources.map(r => r.category)).size.toString()} 
            subtitle="Resource categories" 
            icon={<Folder className="w-7 h-7" />} 
            iconBgColor="bg-orange-50" 
            iconColor="text-orange-500" 
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          
          <div className="flex-1 space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Search resources..." 
                    className="pl-9 h-11 bg-slate-50 border-slate-200" 
                  />
                </div>
                
                <div className="flex gap-3">
                  <Select value={category} onValueChange={(val) => { setCategory(val ?? "all"); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] h-11 bg-white border-slate-200">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-categories">All Categories</SelectItem>
                      <SelectItem value="waste-segregation">Waste Segregation</SelectItem>
                      <SelectItem value="composting">Composting</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={type} onValueChange={(val) => { setType(val ?? "all"); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px] h-11 bg-white border-slate-200">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-types">All Types</SelectItem>
                      <SelectItem value="guide">Guide</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={status} onValueChange={(val) => { setStatus(val ?? "all"); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px] h-11 bg-white border-slate-200">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-status">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Link href="/education/create" className="w-full sm:w-auto">
                <Button className="w-full h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm px-6">
                  <Plus className="w-4 h-4 mr-2" /> Add Resource
                </Button>
              </Link>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700">Title</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700">Category</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700">Type</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700">Date Published</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700">Status</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-700 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setActiveResource(item)}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-10 rounded overflow-hidden bg-slate-100 relative shrink-0 flex items-center justify-center">
                              {item.type?.toLowerCase() === 'video' ? (
                                <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600">
                                  <PlayCircle className="w-5 h-5" />
                                </div>
                              ) : item.image && (item.image.endsWith('.pdf') || item.image.endsWith('.doc') || item.image.endsWith('.docx')) ? (
                                <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-[#2E7D32]">
                                  <FileText className="w-5 h-5" />
                                </div>
                              ) : (
                                <img src={item.image || '/images/bins-guide.jpg'} alt={item.title} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold text-slate-700">{item.category}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${item.type.toLowerCase() === 'video' ? 'text-blue-600 bg-blue-50' : 'text-[#2E7D32] bg-[#E8F5E9]'}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold text-slate-900">{item.date || 'Recently'}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${item.status.toLowerCase() === 'published' ? 'text-[#2E7D32] bg-[#E8F5E9]' : 'text-slate-600 bg-slate-100'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="outline" size="icon" className={`h-8 w-8 rounded-lg ${activeResource?.id === item.id ? 'border-[#2E7D32] text-[#2E7D32] bg-[#E8F5E9]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {(() => {
                const totalPages = Math.max(1, Math.ceil(filteredResources.length / itemsPerPage));
                const startItem = filteredResources.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
                const endItem = Math.min(currentPage * itemsPerPage, filteredResources.length);
                
                return (
                  <div className="py-4 px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
                    <span className="text-xs text-slate-500 font-medium">Showing {startItem} to {endItem} of {filteredResources.length} resources</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="w-8 h-8 rounded-md border-slate-200 disabled:opacity-50"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                          <ChevronDown className="w-4 h-4 rotate-90" />
                        </Button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum = currentPage;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;
                          
                          return (
                            <Button 
                              key={pageNum}
                              variant="outline" 
                              size="icon" 
                              className={`w-8 h-8 rounded-md border-slate-200 ${currentPage === pageNum ? 'bg-[#1B5E20] text-white border-[#1B5E20] hover:bg-[#2E7D32] hover:text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        
                        {totalPages > 5 && currentPage < totalPages - 2 && (
                          <>
                            <span className="text-slate-400 px-1">...</span>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="w-8 h-8 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
                              onClick={() => setCurrentPage(totalPages)}
                            >
                              {totalPages}
                            </Button>
                          </>
                        )}

                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="w-8 h-8 rounded-md border-slate-200 disabled:opacity-50"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          <ChevronDown className="w-4 h-4 -rotate-90" />
                        </Button>
                      </div>
                      
                      <div className="hidden sm:block">
                        <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                          <SelectTrigger className="w-[110px] h-8 bg-white border-slate-200 text-xs">
                            <SelectValue placeholder="10 per page" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 per page</SelectItem>
                            <SelectItem value="10">10 per page</SelectItem>
                            <SelectItem value="20">20 per page</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          
          {/* Right Panel - Resource Details */}
          {activeResource && (
          <div className="w-full lg:w-[350px] shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full relative">
              
              <button className="absolute top-6 right-6 text-slate-400 hover:text-slate-700">
                <span className="text-xl leading-none">&times;</span>
              </button>

              <h3 className="font-bold text-slate-900 mb-6 pr-8">Resource Details</h3>
              
              <div className="w-full aspect-video rounded-xl bg-slate-100 mb-6 relative overflow-hidden flex flex-col justify-between p-3">
                {activeResource.type?.toLowerCase() === 'video' ? (
                  activeResource.image && activeResource.image.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={activeResource.image} controls className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-4">
                      <PlayCircle className="w-12 h-12 text-blue-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-300">Video Content</span>
                    </div>
                  )
                ) : activeResource.image && (activeResource.image.endsWith('.pdf') || activeResource.image.endsWith('.doc') || activeResource.image.endsWith('.docx')) ? (
                  <div className="absolute inset-0 bg-emerald-50 flex flex-col items-center justify-center text-slate-700 p-4">
                    <FileText className="w-12 h-12 text-[#2E7D32] mb-2" />
                    <span className="text-xs font-bold text-slate-800">Document Attached</span>
                    <a href={activeResource.image} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-2">
                      View Document
                    </a>
                  </div>
                ) : (
                  <img src={activeResource.image || '/images/bins-guide.jpg'} alt={activeResource.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                
                <div className="relative z-10 flex justify-end">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ${activeResource.type?.toLowerCase() === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-white text-[#2E7D32]'}`}>{activeResource.type}</span>
                </div>
              </div>

              <h4 className="text-xl font-bold text-slate-900 mb-3 leading-tight">{activeResource.title}</h4>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded uppercase tracking-wider">{activeResource.category}</span>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                {activeResource.type.toLowerCase() === 'video' ? 'Watch this video to learn more about environmental awareness and proper waste management.' : 'Learn how to properly segregate waste at home and help keep our community clean and healthy.'}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Date Published</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">{activeResource.date || 'Recently'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Created By</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">Admin User</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Status</span>
                  <span className={`text-xs font-bold ml-auto ${activeResource.status.toLowerCase() === 'published' ? 'text-[#2E7D32]' : 'text-slate-500'}`}>{activeResource.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 w-24">Visibility</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">All Residents</span>
                </div>
              </div>

              <div className="flex gap-3 mt-auto pt-6 border-t border-slate-100">
                <Button onClick={() => alert("Edit functionality coming soon!")} variant="outline" className="flex-1 h-11 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50">
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button onClick={() => handleDelete(activeResource.id)} variant="outline" className="flex-1 h-11 border-red-100 text-red-600 font-semibold rounded-xl hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </div>
              
            </div>
          </div>
          )}
          
        </div>
      </div>
    </>
  );
}
