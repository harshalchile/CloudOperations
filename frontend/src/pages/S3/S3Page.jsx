import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatsCards } from '../../components/cards/StatsCards';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  HardDrive,
  Plus,
  Lock,
  FileText,
  Download,
  ShieldCheck,
  X,
  File,
  Folder,
  FolderPlus,
  Trash2,
  Edit2,
  Eye,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Copy,
  ArrowLeft,
  FileCode,
  Image as ImageIcon,
  Archive,
  AlertTriangle,
  Loader2,
  Info,
  Film,
  Music,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper function to return file icons
const getFileIcon = (item) => {
  if (!item) return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  if (item.is_folder) {
    return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
  }
  const ext = item.name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp', 'ico'].includes(ext)) {
    return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
  } else if (['mp4', 'webm', 'mov', 'mkv', 'ogg'].includes(ext)) {
    return <Film className="w-4 h-4 text-rose-400 shrink-0" />;
  } else if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) {
    return <Music className="w-4 h-4 text-amber-400 shrink-0" />;
  } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return <Archive className="w-4 h-4 text-amber-400 shrink-0" />;
  } else if (['pdf', 'docx', 'doc', 'txt', 'csv'].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
  } else if (['js', 'py', 'json', 'html', 'css', 'ts', 'xml', 'yml', 'yaml'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
  }
  return <File className="w-4 h-4 text-slate-400 shrink-0" />;
};

// S3 Preview Modal Component
const S3PreviewModal = ({ item, bucketName, onClose, onDownload, onCopyKey, showToast }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [textContent, setTextContent] = useState('');
  const [hasError, setHasError] = useState(false);
  const [retryAttempted, setRetryAttempted] = useState(false);

  const fetchPreviewUrl = async (isRetry = false) => {
    if (!bucketName || !item || item.is_folder) return;
    setLoading(true);
    setHasError(false);
    if (!isRetry) {
      setPreviewUrl('');
      setTextContent('');
    }

    try {
      // Endpoint GET /api/s3/preview?bucket=${bucket}&key=${key}
      const res = await api.get('/s3/preview', {
        params: { bucket: bucketName, key: item.key }
      });

      const url = res.data?.previewUrl || res.data?.url;
      if (url) {
        setPreviewUrl(url);

        const ext = item.name.split('.').pop()?.toLowerCase();
        const textExts = ['txt', 'json', 'log', 'csv', 'md', 'py', 'js', 'css', 'html', 'xml', 'yml', 'yaml'];
        if (textExts.includes(ext)) {
          const rawTextRes = await fetch(url);
          const text = await rawTextRes.text();
          setTextContent(text.slice(0, 50000)); // Cap preview text
        }
      } else {
        setHasError(true);
      }
    } catch (err) {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreviewUrl();
  }, [item, bucketName]);

  const handleMediaError = () => {
    if (!retryAttempted) {
      setRetryAttempted(true);
      fetchPreviewUrl(true);
    } else {
      setHasError(true);
    }
  };

  if (!item) return null;

  const ext = item.name.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'ogg'];
  const audioExts = ['mp3', 'wav', 'm4a', 'aac', 'flac'];
  const textExts = ['txt', 'json', 'log', 'csv', 'md', 'py', 'js', 'css', 'html', 'xml', 'yml', 'yaml'];

  const isImage = imageExts.includes(ext);
  const isVideo = videoExts.includes(ext);
  const isAudio = audioExts.includes(ext);
  const isPdf = ext === 'pdf';
  const isText = textExts.includes(ext);

  const isSupportedType = isImage || isVideo || isAudio || isPdf || isText;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono-tabular">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#090d16] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-12 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 truncate">
            {getFileIcon(item)}
            <span className="font-bold text-white truncate">{item.name}</span>
            <span className="text-slate-400 text-[11px] font-mono">({item.size_formatted})</span>
          </div>

          <div className="flex items-center gap-2">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
                title="Open Raw Presigned URL"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => onDownload(item.key)}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Canvas Body */}
        <div className="flex-1 p-4 bg-slate-950 overflow-auto flex items-center justify-center min-h-[400px]">
          {loading ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Fetching AWS S3 presigned URL & loading preview...</p>
            </div>
          ) : !hasError && previewUrl && isSupportedType ? (
            <>
              {isImage && (
                <div className="relative flex items-center justify-center">
                  {mediaLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                  )}
                  <img
                    src={previewUrl}
                    alt={item.name}
                    onLoad={() => setMediaLoading(false)}
                    onError={handleMediaError}
                    className={`max-h-[70vh] max-w-full object-contain rounded border border-slate-800 shadow-xl transition-opacity duration-300 ${
                      mediaLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                </div>
              )}

              {isPdf && (
                <iframe
                  src={previewUrl}
                  title={item.name}
                  onError={handleMediaError}
                  className="w-full h-[70vh] rounded border border-slate-800"
                />
              )}

              {isVideo && (
                <video
                  controls
                  autoPlay={false}
                  src={previewUrl}
                  onError={handleMediaError}
                  className="max-h-[70vh] max-w-full rounded border border-slate-800 shadow-xl"
                >
                  Your browser does not support video playback.
                </video>
              )}

              {isAudio && (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-4 w-full max-w-md font-mono-tabular">
                  <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                    <Music className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                  <audio controls src={previewUrl} onError={handleMediaError} className="w-full">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {isText && textContent && (
                <pre className="w-full max-h-[70vh] p-4 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
                  {textContent}
                </pre>
              )}
            </>
          ) : (
            /* File Information Card (Fallback for unsupported types or load errors) */
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full text-center space-y-4 font-mono-tabular">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-blue-400">
                {getFileIcon(item)}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.key}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">File Type:</span>
                  <span className="text-blue-400 font-semibold uppercase">{ext || 'File'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">File Size:</span>
                  <span className="text-emerald-400 font-semibold">{item.size_formatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Storage Class:</span>
                  <span className="text-slate-300 font-mono">{item.storage_class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Modified:</span>
                  <span className="text-slate-300">{item.last_modified}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                {hasError ? 'Failed to render inline media.' : `Inline preview is not supported for .${ext || 'file'} format.`}
              </p>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => onDownload(item.key)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                <button
                  onClick={() => onCopyKey(item.key)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Key</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const S3Page = () => {
  const { user, awsAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const params = useParams();

  const urlBucketName = params.bucketName || null;
  const urlPrefixPath = params['*'] || '';
  const currentPrefix = urlPrefixPath ? (urlPrefixPath.endsWith('/') ? urlPrefixPath : urlPrefixPath + '/') : '';

  // Buckets List State
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [refreshingBuckets, setRefreshingBuckets] = useState(false);
  const [searchBucket, setSearchBucket] = useState('');
  const [bucketStats, setBucketStats] = useState({ totalStorage: '0 B', totalObjects: 0 });

  // Current Opened Bucket & Objects State
  const [items, setItems] = useState([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [refreshingObjects, setRefreshingObjects] = useState(false);
  const [searchObject, setSearchObject] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [bucketDetails, setBucketDetails] = useState({ count: 0, totalSizeFormatted: '0 B' });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);

  // Modals & Dialogs State
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState('us-east-1');
  const [isSubmittingBucket, setIsSubmittingBucket] = useState(false);

  // Create Folder Modal State
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Rename Modal State
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [newObjectKey, setNewObjectKey] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Properties / Metadata Modal State
  const [propertiesItem, setPropertiesItem] = useState(null);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [itemProperties, setItemProperties] = useState(null);

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState(null);

  // Confirmation Modals State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    type: null,
    targetBucket: null,
    targetObjectKey: null,
    resourceName: '',
  });

  // Fetch Buckets List
  const fetchBuckets = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshingBuckets(true);
    else setLoadingBuckets(true);

    try {
      const res = await api.get('/s3/buckets');
      if (res.data && res.data.buckets) {
        setBuckets(res.data.buckets);
        setBucketStats({
          totalStorage: res.data.total_storage_formatted || '0 B',
          totalObjects: res.data.total_objects || 0
        });
        if (isManualRefresh) showToast('S3 Bucket list refreshed.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to list S3 buckets.';
      showToast(msg, 'error');
    } finally {
      setLoadingBuckets(false);
      setRefreshingBuckets(false);
    }
  };

  useEffect(() => {
    fetchBuckets();

    const handleAccountChange = () => {
      fetchBuckets(true);
      if (urlBucketName) fetchObjectsAndFolders(urlBucketName, currentPrefix, true);
    };
    window.addEventListener('aws-account-changed', handleAccountChange);
    return () => window.removeEventListener('aws-account-changed', handleAccountChange);
  }, [urlBucketName, currentPrefix]);

  // Fetch Objects & Folders inside active bucket prefix
  const fetchObjectsAndFolders = async (bucketName, prefix = '', isManualRefresh = false) => {
    if (isManualRefresh) setRefreshingObjects(true);
    else setLoadingObjects(true);

    try {
      const res = await api.get(`/s3/buckets/${encodeURIComponent(bucketName)}/objects`, {
        params: { prefix }
      });
      if (res.data) {
        const combined = [
          ...(res.data.folders || []),
          ...(res.data.objects || [])
        ];
        setItems(combined);
        setBucketDetails({
          count: res.data.count || 0,
          totalSizeFormatted: res.data.total_size_formatted || '0 B'
        });
        if (isManualRefresh) showToast(`Refreshed ${bucketName}`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to fetch contents for ${bucketName}.`;
      showToast(msg, 'error');
    } finally {
      setLoadingObjects(false);
      setRefreshingObjects(false);
    }
  };

  useEffect(() => {
    if (urlBucketName) {
      fetchObjectsAndFolders(urlBucketName, currentPrefix);
    }
  }, [urlBucketName, urlPrefixPath]);

  // Context Menu Close Handler
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleRowContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  // Folder & Bucket Double Click / Navigation
  const handleOpenBucket = (bName) => {
    navigate(`/s3/${encodeURIComponent(bName)}`);
  };

  const handleOpenFolder = (folderKey) => {
    navigate(`/s3/${encodeURIComponent(urlBucketName)}/${folderKey}`);
  };

  // Create Bucket Handler
  const handleCreateBucketSubmit = async (e) => {
    e.preventDefault();
    if (!newBucketName.trim()) {
      showToast('Bucket name is required.', 'warning');
      return;
    }

    setIsSubmittingBucket(true);
    try {
      const res = await api.post('/s3/buckets', {
        bucket_name: newBucketName.trim(),
        region: newBucketRegion
      });
      showToast(res.data?.message || `Bucket "${newBucketName}" created successfully!`);
      setIsCreateBucketOpen(false);
      setNewBucketName('');
      await fetchBuckets(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create bucket.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingBucket(false);
    }
  };

  // Create Folder Handler
  const handleCreateFolderSubmit = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !urlBucketName) return;

    setIsSubmittingFolder(true);
    const fullFolderPath = `${currentPrefix}${newFolderName.trim()}/`;

    try {
      const res = await api.post('/s3/folder', {
        bucket_name: urlBucketName,
        folder_path: fullFolderPath
      });
      showToast(res.data?.message || `Folder "${newFolderName}" created successfully.`);
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      await fetchObjectsAndFolders(urlBucketName, currentPrefix, true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create folder.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // Trigger Delete Bucket Confirmation
  const triggerDeleteBucket = (bName) => {
    setConfirmConfig({
      isOpen: true,
      type: 'delete-bucket',
      targetBucket: bName,
      targetObjectKey: null,
      resourceName: bName,
    });
  };

  // Trigger Delete Object/Folder Confirmation
  const triggerDeleteObject = (itemKey) => {
    setConfirmConfig({
      isOpen: true,
      type: 'delete-object',
      targetBucket: urlBucketName,
      targetObjectKey: itemKey,
      resourceName: itemKey,
    });
  };

  // Confirmed Delete Execution
  const handleConfirmedDelete = async () => {
    const { type, targetBucket, targetObjectKey } = confirmConfig;
    setConfirmConfig({ ...confirmConfig, isOpen: false });

    if (type === 'delete-bucket') {
      try {
        showToast(`Deleting bucket "${targetBucket}"...`);
        const res = await api.delete(`/s3/buckets/${encodeURIComponent(targetBucket)}`);
        showToast(res.data?.message || `Bucket "${targetBucket}" deleted.`);
        await fetchBuckets(true);
      } catch (err) {
        const msg = err.response?.data?.error || `Failed to delete bucket "${targetBucket}".`;
        showToast(msg, 'error');
      }
    } else if (type === 'delete-object') {
      try {
        showToast(`Deleting "${targetObjectKey}"...`);
        const res = await api.delete('/s3/object', {
          data: { bucket_name: targetBucket, object_key: targetObjectKey }
        });
        showToast(res.data?.message || `Deleted "${targetObjectKey}".`);
        await fetchObjectsAndFolders(urlBucketName, currentPrefix, true);
      } catch (err) {
        const msg = err.response?.data?.error || `Failed to delete "${targetObjectKey}".`;
        showToast(msg, 'error');
      }
    }
  };

  // Drag & Drop / Multiple Files Upload Handling
  const handleFileSelect = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    
    // Check sizes
    const oversized = selected.filter((f) => f.size > 100 * 1024 * 1024);
    if (oversized.length > 0) {
      showToast(`${oversized.length} file(s) exceed 100 MB maximum size limit.`, 'error');
      return;
    }
    setUploadFiles(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFiles || uploadFiles.length === 0 || !urlBucketName) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('bucket_name', urlBucketName);
    formData.append('prefix', currentPrefix);
    uploadFiles.forEach((f) => formData.append('files', f));

    try {
      const res = await api.post('/s3/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      showToast(res.data?.message || `Uploaded ${uploadFiles.length} file(s) successfully!`);
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      setUploadProgress(0);
      await fetchObjectsAndFolders(urlBucketName, currentPrefix, true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to upload files.';
      showToast(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Download File
  const handleDownloadObject = async (objectKey) => {
    try {
      showToast(`Downloading ${objectKey}...`);
      const response = await api.get('/s3/download', {
        params: { bucket_name: urlBucketName, object_key: objectKey },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const downloadName = objectKey.split('/')[-1] || objectKey;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded ${downloadName} successfully!`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to download file.';
      showToast(msg, 'error');
    }
  };

  // Preview Object Trigger
  const handlePreviewObject = (item) => {
    if (!urlBucketName || item.is_folder) return;
    setPreviewItem(item);
  };

  // Properties / Metadata Inspector (HeadObject)
  const handleShowProperties = async (item) => {
    if (!urlBucketName) return;
    setPropertiesItem(item);
    setPropertiesLoading(true);
    setItemProperties(null);

    try {
      const res = await api.get('/s3/head', {
        params: { bucket_name: urlBucketName, object_key: item.key }
      });
      if (res.data) {
        setItemProperties(res.data);
      }
    } catch (err) {
      showToast('Failed to fetch object metadata.', 'error');
    } finally {
      setPropertiesLoading(false);
    }
  };

  // Rename Object
  const triggerRenameObject = (objectKey) => {
    setRenameTarget(objectKey);
    setNewObjectKey(objectKey);
    setIsRenameModalOpen(true);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!newObjectKey.trim() || !renameTarget || !urlBucketName) return;
    if (newObjectKey.trim() === renameTarget) {
      setIsRenameModalOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await api.put('/s3/rename', {
        bucket_name: urlBucketName,
        source_key: renameTarget,
        new_key: newObjectKey.trim()
      });
      showToast(res.data?.message || `Renamed object to ${newObjectKey.trim()}`);
      setIsRenameModalOpen(false);
      setRenameTarget(null);
      setNewObjectKey('');
      await fetchObjectsAndFolders(urlBucketName, currentPrefix, true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to rename object.';
      showToast(msg, 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  // Copy Object Key
  const handleCopyObjectKey = (key) => {
    navigator.clipboard.writeText(key);
    showToast(`Copied object key "${key}" to clipboard`);
  };

  // Helper for Breadcrumb Segments
  const getBreadcrumbs = () => {
    if (!urlBucketName) return [];
    const parts = currentPrefix.split('/').filter(Boolean);
    const crumbs = [{ label: 'Buckets', path: '/s3' }, { label: urlBucketName, path: `/s3/${encodeURIComponent(urlBucketName)}` }];
    
    let accumulated = '';
    parts.forEach((p) => {
      accumulated += p + '/';
      crumbs.push({
        label: p,
        path: `/s3/${encodeURIComponent(urlBucketName)}/${accumulated}`
      });
    });
    return crumbs;
  };

  // Filtered Buckets
  const filteredBuckets = buckets.filter((b) =>
    b.name.toLowerCase().includes(searchBucket.toLowerCase()) ||
    b.region.toLowerCase().includes(searchBucket.toLowerCase())
  );

  // Filtered & Sorted Objects inside active bucket prefix
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchObject.toLowerCase()) ||
    item.key.toLowerCase().includes(searchObject.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.is_folder && !b.is_folder) return -1;
    if (!a.is_folder && b.is_folder) return 1;

    let comp = 0;
    if (sortBy === 'name') {
      comp = a.name.localeCompare(b.name);
    } else if (sortBy === 'size') {
      comp = a.size_bytes - b.size_bytes;
    } else if (sortBy === 'modified') {
      comp = new Date(a.last_modified) - new Date(b.last_modified);
    }
    return sortOrder === 'asc' ? comp : -comp;
  });

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const statsItems = [
    { title: 'Total Storage Buckets', value: `${buckets.length} Buckets`, change: 'Live AWS', changeType: 'increase', icon: HardDrive, subtitle: 'AES-256 Server-Side Encryption' },
    { title: 'Total Data Volume', value: bucketStats.totalStorage, change: 'Calculated', changeType: 'increase', icon: HardDrive, subtitle: 'S3 Standard & Glacier Tier Storage' },
    { title: 'Public Access Guard', value: 'Block Public Access', change: 'Enforced', changeType: 'increase', icon: Lock, subtitle: 'IAM Bucket Policies Enabled' },
    { title: 'Total Objects Count', value: `${bucketStats.totalObjects} Objects`, change: 'Synced', changeType: 'increase', icon: FileText, subtitle: 'AWS Boto3 Telemetry Active' },
  ];

  return (
    <div className="font-mono-tabular space-y-6 pb-24">

      {/* No AWS Connected Warning */}
      {(!awsAccount || !awsAccount.account_id) && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>No AWS Account connected yet. Connect your AWS credentials to manage S3 Buckets and Objects.</span>
          </div>
        </div>
      )}

      {/* VIEW 1: BUCKETS LIST VIEW */}
      {!urlBucketName ? (
        <>
          <PageHeader
            title="S3 Object Storage Buckets"
            description="Enterprise AWS S3 storage bucket inventory, object management, and security policies."
            arn={awsAccount ? `arn:aws:s3:::*` : 'arn:aws:s3:::unconnected'}
            onRefresh={() => fetchBuckets(true)}
            isRefreshing={refreshingBuckets}
            actions={
              <button
                onClick={() => setIsCreateBucketOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Bucket</span>
              </button>
            }
          />

          <StatsCards items={statsItems} />

          {/* Main Table Container */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden font-mono-tabular">
            {/* Top Controls */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/60">
              <div className="relative w-72">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter buckets by name or region..."
                  value={searchBucket}
                  onChange={(e) => setSearchBucket(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Showing {filteredBuckets.length} buckets</span>
                <button
                  onClick={() => fetchBuckets(true)}
                  className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300"
                  title="Refresh bucket list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingBuckets ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Bucket Table */}
            <div className="overflow-x-auto">
              {loadingBuckets ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-slate-900/70 border border-slate-800/60 rounded-md animate-pulse flex items-center px-4 justify-between">
                      <div className="w-48 h-4 bg-slate-800 rounded" />
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                      <div className="w-32 h-4 bg-slate-800 rounded" />
                      <div className="w-20 h-4 bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredBuckets.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <HardDrive className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No S3 Buckets Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchBucket ? 'No S3 buckets match your search query.' : 'There are currently no S3 storage buckets in your AWS account.'}
                  </p>
                  <button
                    onClick={() => setIsCreateBucketOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold shadow transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Bucket</span>
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse select-none">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="p-3">Bucket Name</th>
                      <th className="p-3">AWS Region</th>
                      <th className="p-3">Creation Date</th>
                      <th className="p-3">Total Objects</th>
                      <th className="p-3">Total Storage</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredBuckets.map((bucket) => (
                      <tr
                        key={bucket.name}
                        onDoubleClick={() => handleOpenBucket(bucket.name)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="p-3">
                          <div
                            onClick={() => handleOpenBucket(bucket.name)}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <HardDrive className="w-4 h-4 text-blue-400 group-hover:text-blue-300 shrink-0" />
                            <span className="font-bold text-white group-hover:text-blue-400 group-hover:underline">
                              {bucket.name}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 text-slate-400">{bucket.region}</td>
                        <td className="p-3 text-slate-400">{bucket.created}</td>
                        <td className="p-3 text-slate-300 font-mono-tabular">{bucket.objects_count}</td>
                        <td className="p-3 text-slate-300 font-semibold">{bucket.size_formatted}</td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenBucket(bucket.name); }}
                              className="px-2.5 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Open Bucket Objects"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-400" /> Open
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); triggerDeleteBucket(bucket.name); }}
                              className="px-2.5 py-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 rounded text-[11px] font-semibold flex items-center gap-1"
                              title="Delete Empty Bucket"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        /* VIEW 2: INSIDE BUCKET EXPLORER VIEW (WITH PREFIX / FOLDERS) */
        <div className="space-y-6">

          {/* AWS Console Style Breadcrumb Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 overflow-x-auto flex-1 font-mono-tabular">
              {getBreadcrumbs().map((crumb, idx, arr) => (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  {idx === arr.length - 1 ? (
                    <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-slate-400 hover:text-blue-400 hover:underline px-1 py-0.5 rounded transition-colors shrink-0"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => fetchObjectsAndFolders(urlBucketName, currentPrefix, true)}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded"
                title="Refresh Prefix Contents"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingObjects ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              <button
                onClick={() => setIsCreateFolderOpen(true)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>Create Folder</span>
              </button>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Upload File(s)</span>
              </button>
            </div>
          </div>

          {/* Bucket Details Banner */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono-tabular">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">BUCKET NAME</span>
              <span className="text-white font-bold truncate block">{urlBucketName}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">CURRENT PREFIX</span>
              <span className="text-slate-300 font-mono truncate block">{currentPrefix || '/ (Root)'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">ITEMS IN VIEW</span>
              <span className="text-blue-400 font-bold">{bucketDetails.count} Items</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">TOTAL SIZE</span>
              <span className="text-emerald-400 font-bold">{bucketDetails.totalSizeFormatted}</span>
            </div>
          </div>

          {/* Main Objects & Folders Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden font-mono-tabular">
            {/* Filter & Sort Bar */}
            <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search objects in current prefix..."
                  value={searchObject}
                  onChange={(e) => setSearchObject(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Sort by:</span>
                <button
                  onClick={() => handleSortToggle('name')}
                  className={`px-2.5 py-1 rounded border ${sortBy === 'name' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSortToggle('size')}
                  className={`px-2.5 py-1 rounded border ${sortBy === 'size' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSortToggle('modified')}
                  className={`px-2.5 py-1 rounded border ${sortBy === 'modified' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  Date {sortBy === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {/* Content Table */}
            <div className="overflow-x-auto">
              {loadingObjects ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-slate-900/70 border border-slate-800/60 rounded-md animate-pulse flex items-center px-4 justify-between">
                      <div className="w-56 h-4 bg-slate-800 rounded" />
                      <div className="w-20 h-4 bg-slate-800 rounded" />
                      <div className="w-32 h-4 bg-slate-800 rounded" />
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 space-y-3">
                  <Folder className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-200">This bucket is empty.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchObject ? 'No items match your search filter.' : 'Upload files or create sub-folders to populate this location.'}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload File</span>
                    </button>

                    <button
                      onClick={() => setIsCreateFolderOpen(true)}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5"
                    >
                      <FolderPlus className="w-4 h-4 text-amber-400" />
                      <span>Create Folder</span>
                    </button>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse select-none">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('name')}>
                        <div className="flex items-center gap-1">
                          <span>File Name</span>
                          {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="p-3">Type</th>
                      <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('size')}>
                        <div className="flex items-center gap-1">
                          <span>Size</span>
                          {sortBy === 'size' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="p-3">Storage Class</th>
                      <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('modified')}>
                        <div className="flex items-center gap-1">
                          <span>Last Modified</span>
                          {sortBy === 'modified' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {sortedItems.map((item) => (
                      <tr
                        key={item.key}
                        onContextMenu={(e) => handleRowContextMenu(e, item)}
                        onDoubleClick={() => {
                          if (item.is_folder) handleOpenFolder(item.key);
                          else handlePreviewObject(item);
                        }}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getFileIcon(item)}
                            <div className="flex flex-col truncate">
                              {item.is_folder ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenFolder(item.key); }}
                                  className="font-bold text-amber-300 hover:underline text-xs text-left truncate"
                                >
                                  {item.name}/
                                </button>
                              ) : (
                                <span
                                  onClick={(e) => { e.stopPropagation(); handlePreviewObject(item); }}
                                  className="font-semibold text-white hover:text-blue-400 hover:underline text-xs truncate"
                                  title={item.key}
                                >
                                  {item.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {item.is_folder ? 'Folder' : (item.name.split('.').pop()?.toUpperCase() || 'FILE')}
                        </td>
                        <td className="p-3 text-slate-300 font-semibold">{item.size_formatted}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 border rounded text-[10px] font-mono ${
                            item.is_folder ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-300 border-slate-700/60'
                          }`}>
                            {item.storage_class}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{item.last_modified}</td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!item.is_folder && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePreviewObject(item); }}
                                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                                  title="Preview File"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownloadObject(item.key); }}
                                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={(e) => { e.stopPropagation(); triggerRenameObject(item.key); }}
                                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                                  title="Rename Object Key"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyObjectKey(item.key); }}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                              title="Copy Object Key"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); triggerDeleteObject(item.key); }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING RIGHT CLICK CONTEXT MENU */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 text-xs font-mono-tabular select-none"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          >
            {!contextMenu.item.is_folder && (
              <>
                <button
                  onClick={() => { handlePreviewObject(contextMenu.item); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" /> Preview File
                </button>

                <button
                  onClick={() => { handleDownloadObject(contextMenu.item.key); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" /> Download
                </button>

                <button
                  onClick={() => { triggerRenameObject(contextMenu.item.key); setContextMenu(null); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" /> Rename
                </button>
              </>
            )}

            <button
              onClick={() => { handleCopyObjectKey(contextMenu.item.key); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy Object Key
            </button>

            <button
              onClick={() => { handleShowProperties(contextMenu.item); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
            >
              <Info className="w-3.5 h-3.5 text-purple-400" /> Properties
            </button>

            <div className="border-t border-slate-800 my-1" />

            <button
              onClick={() => { triggerDeleteObject(contextMenu.item.key); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE BUCKET MODAL */}
      {isCreateBucketOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                Create S3 Storage Bucket
              </h3>
              <button onClick={() => setIsCreateBucketOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBucketSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Bucket Name (Globally Unique)</label>
                <input
                  type="text"
                  required
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="e.g. my-app-assets-prod-2026"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">AWS Region</label>
                <select
                  value={newBucketRegion}
                  onChange={(e) => setNewBucketRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none"
                >
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateBucketOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBucket}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow flex items-center gap-1.5"
                >
                  {isSubmittingBucket && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Bucket</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400" />
                Create Virtual Folder
              </h3>
              <button onClick={() => setIsCreateFolderOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Location:</label>
                <span className="block px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-300 font-mono">
                  {urlBucketName}/{currentPrefix}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Folder Name:</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. photos, documents, videos"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFolder}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow flex items-center gap-1.5"
                >
                  {isSubmittingFolder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Folder</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DRAG & DROP MULTIPLE FILES UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                Upload Files to {urlBucketName}/{currentPrefix}
              </h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-200">Drag & Drop file(s) here or click to browse</p>
              <p className="text-[10px] text-slate-500 mt-1">Supports Images, PDF, DOCX, ZIP, TXT, Videos (Max 100 MB per file)</p>

              {uploadFiles.length > 0 && (
                <div className="mt-4 max-h-32 overflow-y-auto space-y-1.5">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="p-2 bg-slate-900 border border-slate-800 rounded flex items-center justify-between text-xs text-blue-300">
                      <span className="truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Uploading to S3...</span>
                  <span className="font-semibold text-blue-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploadFiles.length === 0 || isUploading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-semibold shadow flex items-center gap-1.5"
              >
                {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isUploading ? 'Uploading...' : `Upload ${uploadFiles.length} File(s)`}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* RENAME OBJECT MODAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Rename Object Key
              </h3>
              <button onClick={() => setIsRenameModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Current Key:</label>
                <input
                  type="text"
                  disabled
                  value={renameTarget || ''}
                  className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded text-slate-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">New Object Key / Path:</label>
                <input
                  type="text"
                  required
                  value={newObjectKey}
                  onChange={(e) => setNewObjectKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shadow flex items-center gap-1.5"
                >
                  {isRenaming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Rename Object</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* PROPERTIES / METADATA MODAL */}
      {propertiesItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono-tabular">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg bg-[#0d121f] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-400" />
                Object Properties: {propertiesItem.name}
              </h3>
              <button onClick={() => setPropertiesItem(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {propertiesLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Fetching HeadObject metadata from AWS S3...</span>
              </div>
            ) : itemProperties ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Object Key:</span>
                    <span className="text-white font-mono truncate max-w-xs">{itemProperties.key}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Content-Type:</span>
                    <span className="text-blue-400 font-mono">{itemProperties.content_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Content-Length:</span>
                    <span className="text-emerald-400 font-semibold">{itemProperties.size_formatted} ({itemProperties.size_bytes} bytes)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Class:</span>
                    <span className="text-slate-300 font-mono">{itemProperties.storage_class}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Modified:</span>
                    <span className="text-slate-300">{itemProperties.last_modified}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ETag (MD5 Checksum):</span>
                    <span className="text-slate-400 font-mono text-[11px]">{itemProperties.etag}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No properties available.</p>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPropertiesItem(null)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* S3 PREVIEW MODAL */}
      {previewItem && (
        <S3PreviewModal
          item={previewItem}
          bucketName={urlBucketName}
          onClose={() => setPreviewItem(null)}
          onDownload={handleDownloadObject}
          onCopyKey={handleCopyObjectKey}
          showToast={showToast}
        />
      )}

      {/* CONFIRMATION MODAL BEFORE DELETE */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={handleConfirmedDelete}
        title={confirmConfig.type === 'delete-bucket' ? 'Delete S3 Bucket' : 'Delete Object or Folder'}
        description={
          confirmConfig.type === 'delete-bucket'
            ? 'Deleting an empty bucket is permanent. The bucket name will be released back to AWS.'
            : 'Deleting this object or folder will permanently erase it from your S3 storage.'
        }
        resourceName={confirmConfig.resourceName}
        confirmButtonText={confirmConfig.type === 'delete-bucket' ? 'Delete Empty Bucket' : 'Delete'}
        requireInputMatch={confirmConfig.type === 'delete-bucket'}
        variant="danger"
      />
    </div>
  );
};
