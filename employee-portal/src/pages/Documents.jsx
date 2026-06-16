import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  doc, getDoc, orderBy, addDoc, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import useAuthStore    from "../store/authStore";
import Layout          from "../components/Layout";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";
import {
  FileText, Image, Paperclip, Download,
  Upload, FolderOpen, AlertCircle,
  CheckCircle, Search, User, ChevronDown
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────
const ALLOWED_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg":      "JPG",
  "image/png":       "PNG",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
};

const FileIcon = ({ type }) => {
  if (type?.includes("pdf"))                                      return <FileText size={20} className="text-red-400" />;
  if (type?.includes("image"))                                    return <Image    size={20} className="text-blue-400" />;
  if (type?.includes("sheet") || type?.includes("excel"))        return <FileText size={20} className="text-green-500" />;
  return <Paperclip size={20} className="text-gray-400" />;
};

const formatSize = (bytes) => {
  if (!bytes)               return "—";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─── Doc Row ──────────────────────────────────────────────────────
const DocRow = ({ doc, clientName }) => (
  <div className="flex items-center justify-between py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-colors group">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <FileIcon type={doc.fileType} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate max-w-xs">
          {doc.fileName}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
            <User size={10} />
            {clientName || doc.uploadedByName || "Client"}
          </span>
          <span className="text-gray-200">•</span>
          <span className="text-xs text-gray-400 font-medium">{formatSize(doc.fileSize)}</span>
          <span className="text-gray-200">•</span>
          <span className="text-xs text-gray-400 font-medium">
            {doc.createdAt
              ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })
              : "—"}
          </span>
          <span className="text-gray-200">•</span>
          <span className={`text-xs font-semibold ${
            doc.uploadedByRole === "client" ? "text-indigo-500" : "text-[#1D7872]"
          }`}>
            {doc.uploadedByRole === "client" ? "By Client" : "By CA Team"}
          </span>
        </div>
      </div>
    </div>
    <a href={doc.fileUrl} target="_blank" rel="noreferrer"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200
                 text-gray-600 hover:border-[#1D7872] hover:text-[#1D7872] transition-all font-medium flex-shrink-0 ml-3">
      <Download size={12} /> Download
    </a>
  </div>
);

// ─── Upload Dropzone ──────────────────────────────────────────────
const UploadZone = ({ onUpload, uploading, progress }) => {
  const onDrop = useCallback((files) => {
    if (files.length > 0) onUpload(files[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  return (
    <>
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
          ${isDragActive
            ? "border-[#1D7872] bg-teal-50"
            : "border-gray-200 bg-white hover:border-[#1D7872] hover:bg-teal-50/20"
          }`}>
        <input {...getInputProps()} />
        <Upload size={28} className={`mx-auto mb-2 ${isDragActive ? "text-[#1D7872]" : "text-gray-300"}`} />
        <p className="text-sm font-bold text-gray-700">
          {isDragActive ? "Drop the file here..." : "Drag & drop, or click to upload for this client"}
        </p>
        <p className="text-xs text-gray-400 mt-1 font-medium">PDF, JPG, PNG, XLSX — Max 10MB</p>
      </div>

      {uploading && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mt-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Uploading...</p>
            <p className="text-sm font-black text-[#1D7872]">{progress}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-[#1D7872] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────
const Documents = () => {
  const { user, userData } = useAuthStore();

  // Assigned clients
  const [assignedClients, setAssignedClients] = useState([]); // [{ uid, name, company }]
  const [selectedClient,  setSelectedClient]  = useState(null); // uid string

  // Documents
  const [docs,      setDocs]      = useState([]);   // all docs for selected client
  const [loading,   setLoading]   = useState(false);
  const [clientMap, setClientMap] = useState({});   // uid → name

  // Upload
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  // Filters
  const [search,    setSearch]    = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // ── 1. Load assigned clients from employee doc ─────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const empSnap     = await getDoc(doc(db, "employees", user.uid));
        const assignedIds = empSnap.data()?.assignedClients || [];
        if (assignedIds.length === 0) { setAssignedClients([]); return; }

        // Batch fetch client names from users collection
        const userSnaps = await Promise.all(
          assignedIds.map(id => getDoc(doc(db, "users", id)))
        );
        const clients = userSnaps
          .filter(s => s.exists())
          .map(s => ({ uid: s.id, name: s.data().name || "Unnamed", company: s.data().company || "" }));

        const map = {};
        clients.forEach(c => { map[c.uid] = c.name; });
        setClientMap(map);
        setAssignedClients(clients);

        // Auto-select first client
        if (clients.length > 0) setSelectedClient(clients[0].uid);
      } catch (err) {
        console.error("Failed to load assigned clients:", err);
      }
    };
    load();
  }, [user?.uid]);

  // ── 2. Fetch documents for selected client ─────────────────────
  const fetchDocs = async (clientId) => {
    if (!clientId) return;
    setLoading(true);
    setDocs([]);
    try {
      const snap = await getDocs(
        query(
          collection(db, "documents"),
          where("clientId", "==", clientId),
          orderBy("createdAt", "desc")
        )
      );
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Docs fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedClient) fetchDocs(selectedClient);
  }, [selectedClient]);

  // ── 3. Upload document for selected client ─────────────────────
  const handleUpload = async (file) => {
    if (!selectedClient) return setError("Please select a client first.");
    if (!ALLOWED_TYPES[file.type]) return setError("Only PDF, JPG, PNG, XLSX files are allowed.");
    if (file.size > 10 * 1024 * 1024) return setError("File size must be under 10MB.");

    setError("");
    setUploading(true);
    setProgress(0);

    try {
      const filePath   = `documents/${selectedClient}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        () => { setError("Upload failed. Try again."); setUploading(false); },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "documents"), {
            clientId:       selectedClient,
            fileName:       file.name,
            fileType:       file.type,
            fileSize:       file.size,
            fileUrl:        downloadUrl,
            uploadedBy:     user.uid,
            uploadedByName: userData?.name || "Staff",
            uploadedByRole: "staff",
            createdAt:      serverTimestamp(),
          });
          setSuccess(`"${file.name}" uploaded for ${clientMap[selectedClient] || "client"}.`);
          setTimeout(() => setSuccess(""), 4000);
          setUploading(false);
          setProgress(0);
          fetchDocs(selectedClient);
        }
      );
    } catch { setError("Something went wrong. Try again."); setUploading(false); }
  };

  // ── Filtered docs ──────────────────────────────────────────────
  const filtered = docs.filter(d => {
    const matchTab =
      activeTab === "all"    ? true :
      activeTab === "client" ? d.uploadedByRole === "client" :
      activeTab === "staff"  ? d.uploadedByRole !== "client" : true;

    const matchSearch =
      !search ||
      d.fileName?.toLowerCase().includes(search.toLowerCase());

    return matchTab && matchSearch;
  });

  const selectedClientName = assignedClients.find(c => c.uid === selectedClient)?.name || "";

  // ─── Render ────────────────────────────────────────────────────
  return (
    <Layout title="Client Documents">

      {/* No clients assigned */}
      {assignedClients.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center
                        shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
          <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-bold text-gray-500">No clients assigned to you yet</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Ask your admin to assign clients to your account
          </p>
        </div>
      )}

      {assignedClients.length > 0 && (
        <>
          {/* Client Selector */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5
                          shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Client
            </p>
            <div className="flex gap-2 flex-wrap">
              {assignedClients.map(client => (
                <button key={client.uid} onClick={() => setSelectedClient(client.uid)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                              transition-all border cursor-pointer
                    ${selectedClient === client.uid
                      ? "bg-[#1D7872] text-white border-[#1D7872] shadow-md"
                      : "bg-white text-gray-500 border-gray-200 hover:border-[#1D7872] hover:text-[#1D7872]"
                    }`}>
                  <User size={14} />
                  {client.name}
                  {client.company && (
                    <span className={`text-xs ${selectedClient === client.uid ? "text-teal-100" : "text-gray-400"}`}>
                      · {client.company}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedClient && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: "Total Files",    value: docs.length,                                          bg: "bg-teal-50"   },
                  { label: "By Client",      value: docs.filter(d => d.uploadedByRole === "client").length, bg: "bg-indigo-50" },
                  { label: "By CA Team",     value: docs.filter(d => d.uploadedByRole !== "client").length, bg: "bg-purple-50" },
                ].map(s => (
                  <div key={s.label}
                    className="bg-white rounded-2xl p-4 border border-gray-100
                               shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <FolderOpen size={20} className="text-[#1D7872]" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-gray-800">{s.value}</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Zone */}
              <div className="mb-5">
                <UploadZone onUpload={handleUpload} uploading={uploading} progress={progress} />
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600
                                text-sm rounded-2xl px-4 py-3 mb-4">
                  <AlertCircle size={16} className="flex-shrink-0 text-red-500" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200
                                text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4">
                  <CheckCircle size={16} className="flex-shrink-0 text-emerald-500" />
                  {success}
                </div>
              )}

              {/* Search + Tabs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search file name…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                               focus:border-[#1D7872] transition-all bg-white" />
                </div>
                <div className="flex gap-2">
                  {[
                    { key: "all",    label: "All Files"  },
                    { key: "client", label: "By Client"  },
                    { key: "staff",  label: "By CA Team" },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
                        ${activeTab === tab.key
                          ? "bg-[#1D7872] text-white shadow-md"
                          : "bg-white text-gray-500 border border-gray-200 hover:text-[#1D7872]"
                        }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document List */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden
                              shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
                {/* List Header */}
                <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
                  <User size={14} className="text-[#1D7872]" />
                  <p className="text-sm font-bold text-gray-700">
                    {selectedClientName}'s Documents
                  </p>
                  <span className="ml-auto text-xs text-gray-400 font-medium">
                    {filtered.length} file{filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-3 p-5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-14 text-gray-400">
                    <FolderOpen size={38} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm font-medium">
                      {docs.length === 0
                        ? "No documents uploaded yet for this client"
                        : "No files match your search"}
                    </p>
                    <p className="text-xs mt-1 text-gray-400">
                      Upload a file above to share it with {selectedClientName}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 divide-y divide-gray-50">
                    {filtered.map(d => (
                      <DocRow key={d.id} doc={d} clientName={clientMap[d.clientId]} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  );
};

export default Documents;