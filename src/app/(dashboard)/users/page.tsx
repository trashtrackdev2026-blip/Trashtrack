"use client";

import { Users, Search, User, Eye, Shield, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StaffRequestsSummary } from "@/components/auth/StaffRequestsSummary";
import { StaffManagement } from "@/components/auth/StaffManagement";
import { STAFF_BARANGAYS } from "@/lib/staff-access";
import { useAuth } from "@/context/AuthContext";
import { withTimeout } from "@/lib/request-timeout";
import { DataState } from "@/components/ui/data-state";
import { accountGroup as getAccountGroup } from "@/lib/account-group";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  group: string;
  barangay: string;
  status: string;
  date: string;
  time: string;
  reports: number;
}

export default function UsersPage() {
  const { role, user: currentUser, loading: authLoading } = useAuth();
  const [accountGroup, setAccountGroup] = useState("resident");
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [countsReady, setCountsReady] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter State
  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);

  const filteredUsers = useMemo(() => users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                          (u.phone && u.phone.toLowerCase().includes(deferredSearch.toLowerCase()));
    const matchesBarangay = barangayFilter === "all" || (u.barangay && u.barangay.toLowerCase() === barangayFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || (u.status && u.status.toLowerCase() === statusFilter.toLowerCase());
    return u.group === accountGroup && matchesSearch && matchesBarangay && matchesStatus;
  }), [users, deferredSearch, barangayFilter, statusFilter, accountGroup]);

  useEffect(() => {
    if (authLoading || !currentUser || role !== "Admin") return;
    let cancelled = false;
    const fetchUsers = async () => {
      setLoading(true); setDataError(null); setCountsReady(false);
      // Fetch report totals in parallel, without delaying the user list.
      const counts = withTimeout(getDocs(collection(db, "reports")), "Report totals are taking too long. Check your connection and retry.", 15_000)
        .then(snapshot => {
          const result: Record<string, number> = {};
          snapshot.forEach(doc => { const uid = doc.data().userId; if (uid) result[uid] = (result[uid] || 0) + 1; });
          return result;
        }).catch(error => { if (!cancelled) setDataError(error instanceof Error ? error.message : "Unable to load report totals."); return null; });
      try {
        const [usersSnap, requestsSnap] = await withTimeout(Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "staff_requests"))]), "Users are taking too long to load. Check your connection and retry.", 15_000);
        if (cancelled) return;
        const staffApplicants = new Set(requestsSnap.docs.map(doc => doc.id));

        const usersList: UserData[] = [];
        usersSnap.forEach((doc) => {
          const data = doc.data();

          let userDate = "Recently";
          let userTime = "";

          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            const dateObj = data.createdAt.toDate();
            userDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            userTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          } else if (data.timestamp) {
            const dateObj = new Date(data.timestamp);
            if (!isNaN(dateObj.getTime())) {
              userDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              userTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }
          }

          usersList.push({
            id: doc.id,
            name: data.name || "Unknown",
            email: data.email || "No email",
            phone: data.contact || data.phone || "",
            role: String(data.role).toLowerCase() === "resident" && staffApplicants.has(doc.id) ? "Semi-Admin applicant" : data.role || "Resident",
            group: getAccountGroup(data.role, staffApplicants.has(doc.id)),
            barangay: data.barangay || "Unassigned",
            status: data.accessStatus || data.status || "Registered",
            date: userDate,
            time: userTime,
            reports: 0,
          });
        });
        setUsers(usersList);
        setLoading(false);
        const reportCounts = await counts;
        if (!cancelled && reportCounts) {
          setUsers(usersList.map(user => ({ ...user, reports: reportCounts[user.id] || 0 })));
          setCountsReady(true);
        }
      } catch (error) {
        if (!cancelled) setDataError(error instanceof Error ? error.message : "Unable to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsers();
    return () => { cancelled = true; };
  }, [role, currentUser, authLoading, attempt]);

  return (
    <>
      <div className="space-y-6 ">
        <DataState loading={loading} error={dataError} onRetry={() => setAttempt(value => value + 1)} />


        {/* KPI Cards */}
        <div className="tt-metric-strip three-metrics">
          <KpiCard 
            title="Total Users" 
            value={loading ? "—" : users.length.toString()}
            subtitle="All registered users" 
            icon={<Users className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Residents" 
            value={users.filter(u => u.group === 'resident').length.toString()}
            subtitle="Registered residents" 
            icon={<User className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Barangay staff"
            value={users.filter(u => u.group === 'semi-admin').length.toString()}
            subtitle="Officials and applicants"
            icon={<Shield className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
        </div>

        <nav className="tt-tabs" aria-label="Account group">{[{id:"resident",label:"Residents"},{id:"semi-admin",label:"Barangay staff"},{id:"admin",label:"MENRO admins"},{id:"approvals",label:"Staff approvals"}].map(group => <button key={group.id} type="button" aria-pressed={accountGroup === group.id} onClick={() => {setAccountGroup(group.id);setCurrentPage(1);setSelectedUser(null);setStatusFilter("all");}}>{group.label}</button>)}</nav>
        {accountGroup === "approvals" ? <StaffManagement /> : <div className="tt-people-layout"><div className="tt-surface overflow-hidden">

          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search user by name, email, or phone..." 
                className="pl-9 bg-slate-50 border-none rounded-xl h-10 focus-visible:ring-1 focus-visible:ring-[#2E7D32] focus-visible:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Barangay</span>
                <Select value={barangayFilter} onValueChange={(val) => { setBarangayFilter(val ?? "all"); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                    <SelectValue>{barangayFilter === "all" ? "All barangays" : barangayFilter}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Barangays</SelectItem>
                    {STAFF_BARANGAYS.map(value => <SelectItem key={value} value={value.toLowerCase()}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Account Status</span>
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? "all"); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                    <SelectValue>{statusFilter === "all" ? "All statuses" : statusFilter.replaceAll("-"," ")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active staff</SelectItem>
                    <SelectItem value="needs-review">Needs review</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="registered">Registered resident</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col justify-end h-full pt-[20px]">
                <Button 
                  onClick={() => { setSearch(""); setBarangayFilter("all"); setStatusFilter("all"); setCurrentPage(1); }}
                  variant="outline" 
                  className="h-9 px-4 text-[#2E7D32] border-[#2E7D32]/30 bg-green-50/50 hover:bg-green-50 rounded-xl"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left"><thead><tr className="border-b"><th className="px-5 py-4">Name</th><th className="px-3 py-4">Barangay</th><th className="px-3 py-4">Role</th><th className="px-3 py-4">Status</th><th className="px-3 py-4">Joined</th><th className="px-4 py-4 text-right">Actions</th></tr></thead><tbody>{filteredUsers.slice((currentPage - 1) * itemsPerPage,currentPage * itemsPerPage).map(user=><tr key={user.id} className="border-b last:border-0"><td className="px-5 py-4"><button type="button" onClick={()=>setSelectedUser(user)} className="flex items-center gap-3 text-left"><span className="tt-avatar" aria-hidden="true">{user.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</span><span><strong className="block text-xs font-semibold">{user.name}</strong><small className="mt-1 block text-[10px] text-muted-foreground">{user.email}</small></span></button></td><td className="px-3 py-4 text-xs">{user.barangay || (user.role.toLowerCase()==="admin"?"All barangays":"Unassigned")}</td><td className="px-3 py-4 text-xs">{user.role}</td><td className="px-3 py-4"><span className="tt-status">{user.status}</span></td><td className="px-3 py-4 text-[11px] text-muted-foreground">{user.date}</td><td className="px-4 py-4 text-right"><Button variant="ghost" size="icon" aria-label={"View "+user.name} onClick={()=>setSelectedUser(user)}><Eye /></Button></td></tr>)}{!filteredUsers.length&&<tr><td colSpan={6} className="tt-empty">No users match your filters.</td></tr>}</tbody></table>
          </div>

          {/* Pagination */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
            const startItem = filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
            const endItem = Math.min(currentPage * itemsPerPage, filteredUsers.length);

            return (
              <div className="py-4 px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
                <span className="text-xs text-slate-500 font-medium">Showing {startItem} to {endItem} of {filteredUsers.length} users</span>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="w-8 h-8 rounded-lg border-slate-200 text-slate-500 disabled:opacity-50" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
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
                        size="sm" 
                        className={`w-8 h-8 rounded-lg border-slate-200 ${currentPage === pageNum ? 'bg-[#2E7D32] text-white border-[#2E7D32]' : 'text-slate-600 hover:bg-slate-50'}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-1 text-slate-400">...</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-8 h-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}

                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="w-8 h-8 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 hidden sm:flex">
                  <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(val) => {
                      setItemsPerPage(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[100px] bg-white border-slate-200 rounded-lg h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 per page</SelectItem>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })()}
        </div><StaffRequestsSummary onReview={() => { setAccountGroup("approvals");setSelectedUser(null); }} /></div>}
      </div>
      {/* User Details Modal */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null); }}>
      {selectedUser && (
          <DialogContent className="gap-0 p-0 sm:max-w-lg">
            <DialogDescription className="sr-only">Profile information for {selectedUser.name}. Account roles are fixed.</DialogDescription>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <DialogTitle className="font-bold text-slate-900 text-lg">User Profile</DialogTitle>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-slate-100 shadow-sm">
                  <AvatarFallback className="bg-[#E8F5E9] text-[#1B5E20] text-xl font-bold">
                    {selectedUser.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-slate-900 text-xl">{selectedUser.name}</h4>
                  <p className="text-slate-500 text-sm">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role</span>
                  <span className="font-semibold text-slate-900">{selectedUser.role}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Barangay</span>
                  <span className="font-semibold text-slate-900">{selectedUser.barangay}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</span>
                  <span className={`font-semibold ${selectedUser.status === 'Verified' ? 'text-[#2E7D32]' : 'text-orange-500'}`}>{selectedUser.status}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reports Submitted</span>
                  <span className="font-semibold text-slate-900">{countsReady ? users.find(user => user.id === selectedUser.id)?.reports ?? "—" : "—"}</span>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
      )}
      </Dialog>
    </>
  );
}
