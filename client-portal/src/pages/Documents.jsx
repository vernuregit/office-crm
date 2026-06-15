import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, orderBy
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import { useDropzone } from "react-dropzone";
import {
  FileText, Image, Paperclip, Download,
  Upload, FolderOpen, AlertCircle, CheckCircle
} from "lucide-react";

const ALLOWED_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg":      "JPG",
  "image/png":       "PNG",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
};

const FileIcon = ({ type }) => {
  if (type?.includes("pdf"))   return <FileText size={22} className="text-red-400" />;
  if (type?.includes("image")) return <Image    size={22} className="text-blue-400" />;
  if (type?.includes("sheet") || type?.includes("excel")) return <FileText size={22} className="text-green-500" />;
  return <Paperclip size={22} className="text-gray-400" />;
};

const formatSize = (bytes) => {
  if (!bytes)              return "—";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocRow = ({ doc }) => (
  <div className="flex items-center justify-between py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-colors group">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <FileIcon type={doc.fileType} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 truncate max-w-xs  transition-colors">
          {doc.fileName}
        </p>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          {formatSize(doc.fileSize)} •{" "}
          {doc.createdAt
            ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })
            : "—"}{" "}
          • <span className="font-semibold">{doc.uploadedByName || "CA Team"}</span>
        </p>
      </div>
    </div>
    <a
      href={doc.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600  hover:text-[#153485] transition-all font-medium"
    >
      <Download size={12} /> Download
    </a>
  </div>
);

const Documents = () => {
  const { user, userData }   = useAuthStore();
  const [docs,      setDocs]       = useState([]);
  const [loading,   setLoading]    = useState(true);
  const [uploading, setUploading]  = useState(false);
  const [progress,  setProgress]   = useState(0);
  const [error,     setError]      = useState("");
  const [success,   setSuccess]    = useState("");
  const [activeTab, setActiveTab]  = useState("all");

  const fetchDocs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "documents"),
        where("clientId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [user]);

  const handleUpload = async (file) => {
    if (!ALLOWED_TYPES[file.type]) return setError("Only PDF, JPG, PNG, XLSX files are allowed.");
    if (file.size > 10 * 1024 * 1024) return setError("File size must be under 10MB.");

    setError("");
    setUploading(true);
    setProgress(0);

    try {
      const filePath    = `documents/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef  = ref(storage, filePath);
      const uploadTask  = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        () => { setError("Upload failed. Please try again."); setUploading(false); },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "documents"), {
            clientId:       user.uid,
            fileName:       file.name,
            fileType:       file.type,
            fileSize:       file.size,
            fileUrl:        downloadUrl,
            uploadedBy:     user.uid,
            uploadedByName: userData?.name || "Client",
            uploadedByRole: "client",
            createdAt:      serverTimestamp(),
          });
          setSuccess(`"${file.name}" uploaded successfully!`);
          setTimeout(() => setSuccess(""), 4000);
          setUploading(false);
          setProgress(0);
          fetchDocs();
        }
      );
    } catch { setError("Something went wrong. Try again."); setUploading(false); }
  };

  const onDrop = useCallback((files) => {
    if (files.length > 0) handleUpload(files[0]);
  }, [user, userData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const filteredDocs = docs.filter((d) => {
    if (activeTab === "mine") return d.uploadedByRole === "client";
    if (activeTab === "ca")   return d.uploadedByRole !== "client";
    return true;
  });

  return (
    <Layout title="Documents">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Files",     value: docs.length,                                         Icon: FolderOpen, color: "text-gray-700",  bg: "bg-green-50"  },
          { label: "Uploaded by You", value: docs.filter(d => d.uploadedByRole === "client").length, Icon: Upload,     color: "text-gray-700",  bg: "bg-green-50"  },
          { label: "From CA Team",    value: docs.filter(d => d.uploadedByRole !== "client").length, Icon: FileText,   color: "text-gray-700", bg: "bg-green-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={22}  className='text-[#153485]' />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center mb-6 cursor-pointer transition-all
          ${isDragActive
            ? "border-[#153485] bg-[#153485]"
            : "border-gray-200 bg-white hover:border-[#153485] hover:bg-indigo-50/30"
          }`}
      >
        <input {...getInputProps()} />
        <Upload size={32} className={`mx-auto mb-3 ${isDragActive ? "text-[#153485]" : "text-gray-300"}`} />
        <p className="text-sm font-bold text-gray-700">
          {isDragActive ? "Drop the file here..." : "Drag & drop a file, or click to select"}
        </p>
        <p className="text-xs text-gray-400 mt-1 font-medium">Supports PDF, JPG, PNG, XLSX — Max 10MB</p>
      </div>

      {/* Progress */}
      {uploading && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Uploading...</p>
            <p className="text-sm font-black text-gray-700">{progress}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="flex-shrink-0 text-red-500" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4">
          <CheckCircle size={16} className="flex-shrink-0 text-emerald-500" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all",  label: "All Files"     },
          { key: "mine", label: "Uploaded by Me" },
          { key: "ca",   label: "From CA Team"  },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer
              ${activeTab === tab.key
                ? "bg-[#153485] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200  hover:text-[#153485]"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">No documents found</p>
            <p className="text-xs mt-1">Upload a file using the area above</p>
          </div>
        ) : (
          <div className="p-2 divide-y divide-gray-50">
            {filteredDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Documents;
