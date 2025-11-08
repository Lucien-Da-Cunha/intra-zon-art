import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { driveAPI } from '../api/api';

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_by: number;
  description: string;
  color: string;
  is_public: boolean;
  first_name: string;
  last_name: string;
  file_count: number;
  subfolder_count: number;
  created_at: string;
}

interface DriveFile {
  id: number;
  folder_id: number;
  name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  description: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

function Drive() {
  const { user } = useAuthStore();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editingFile, setEditingFile] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [openMenuFolder, setOpenMenuFolder] = useState<number | null>(null);
  const [openMenuFile, setOpenMenuFile] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    parent_id: null as number | null
  });

  const canAccess = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (canAccess) {
      loadFolders();
    }
  }, [canAccess]);

  // Fermer les menus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuFolder(null);
      setOpenMenuFile(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fermer la prévisualisation avec ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewFile) {
        closePreview();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [previewFile]);

  const loadFolders = async () => {
    try {
      const response = await driveAPI.getFolders();
      setFolders(response.data.folders || []);
    } catch (error) {
      console.error('Erreur chargement dossiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderFiles = async (folderId: number) => {
    try {
      const response = await driveAPI.getFolderFiles(folderId);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Erreur chargement fichiers:', error);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await driveAPI.createFolder(folderForm);
      setShowFolderModal(false);
      setFolderForm({ name: '', description: '', color: '#3b82f6', parent_id: null });
      loadFolders();
    } catch (error: any) {
      console.error('Erreur création dossier:', error);
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      await driveAPI.deleteFolder(folderId);
      loadFolders();
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
        setFiles([]);
      }
    } catch (error: any) {
      console.error('Erreur suppression dossier:', error);
    }
  };

  const handleRenameFolder = async (folderId: number) => {
    if (!renameValue.trim()) return;
    try {
      await driveAPI.updateFolder(folderId, { name: renameValue });
      setEditingFolder(null);
      setRenameValue('');
      loadFolders();
    } catch (error: any) {
      console.error('Erreur renommage dossier:', error);
    }
  };

  const handleRenameFile = async (fileId: number) => {
    if (!renameValue.trim()) return;
    try {
      await driveAPI.updateFile(fileId, { original_name: renameValue });
      setEditingFile(null);
      setRenameValue('');
      if (currentFolder) {
        loadFolderFiles(currentFolder.id);
      }
    } catch (error: any) {
      console.error('Erreur renommage fichier:', error);
    }
  };

  const handlePreviewFile = async (file: DriveFile) => {
    try {
      const response = await driveAPI.downloadFile(file.id);
      const blob = new Blob([response.data], { type: file.mime_type });
      const url = window.URL.createObjectURL(blob);
      
      // Pour les fichiers texte, lire le contenu
      if (file.mime_type.startsWith('text/')) {
        const text = await blob.text();
        setPreviewContent(text);
      }
      
      setPreviewFile(file);
      setPreviewUrl(url);
    } catch (error: any) {
      console.error('Erreur prévisualisation:', error);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl('');
    setPreviewContent('');
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFolder) return;

    const formElement = e.target as HTMLFormElement;
    const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement;
    const descInput = formElement.querySelector('textarea') as HTMLTextAreaElement;
    
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      await driveAPI.uploadFile(currentFolder.id, file, descInput.value);
      setShowUploadModal(false);
      loadFolderFiles(currentFolder.id);
    } catch (error: any) {
      console.error('Erreur upload fichier:', error);
    }
  };

  const handleDownloadFile = async (fileId: number, fileName: string) => {
    try {
      const response = await driveAPI.downloadFile(fileId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      console.error('Erreur téléchargement:', error);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await driveAPI.deleteFile(fileId);
      if (currentFolder) {
        loadFolderFiles(currentFolder.id);
      }
    } catch (error: any) {
      console.error('Erreur suppression fichier:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📄';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
    if (mimeType.startsWith('text/')) return '📝';
    return '📎';
  };

  const openFolder = (folder: Folder) => {
    setCurrentFolder(folder);
    loadFolderFiles(folder.id);
  };

  const goBack = () => {
    if (currentFolder?.parent_id) {
      const parentFolder = folders.find(f => f.id === currentFolder.parent_id);
      if (parentFolder) {
        openFolder(parentFolder);
      }
    } else {
      setCurrentFolder(null);
      setFiles([]);
    }
  };

  const rootFolders = folders.filter(f => f.parent_id === null);
  const subFolders = currentFolder ? folders.filter(f => f.parent_id === currentFolder.id) : [];

  if (!canAccess) {
    return (
      <div className="container">
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Accès refusé
          </h1>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            Seuls les managers et administrateurs ont accès au Drive.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
          Drive
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Gestion centralisée des documents et fichiers de l'entreprise
        </p>
      </div>

      {/* Navigation et actions */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentFolder && (
              <button
                onClick={goBack}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Retour
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                {currentFolder ? `📂 ${currentFolder.name}` : '📁 Tous les dossiers'}
              </h2>
              {currentFolder && currentFolder.description && (
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {currentFolder.description}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentFolder && (
              <button
                onClick={() => setShowUploadModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <span>⬆️</span> Uploader un fichier
              </button>
            )}
            <button
              onClick={() => {
                setFolderForm({ name: '', description: '', color: '#3b82f6', parent_id: currentFolder?.id || null });
                setShowFolderModal(true);
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <span>+</span> Nouveau dossier
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="card" style={{ padding: '24px' }}>
        {/* Dossiers racine */}
        {!currentFolder && rootFolders.length > 0 && (
          <div style={{ marginBottom: subFolders.length > 0 ? '32px' : 0 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Dossiers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {rootFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    padding: '20px',
                    border: `2px solid ${folder.color}20`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    backgroundColor: `${folder.color}08`,
                    position: 'relative',
                    transition: 'all 0.2s',
                    ':hover': { transform: 'translateY(-2px)' }
                  }}
                  onClick={() => openFolder(folder)}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${folder.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '12px'
                  }}>
                    📁
                  </div>
                  
                  {editingFolder === folder.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameFolder(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') { setEditingFolder(null); setRenameValue(''); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}
                    />
                  ) : (
                    <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '8px', wordBreak: 'break-word' }}>
                      {folder.name}
                    </h4>
                  )}
                  
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                    {folder.file_count} fichier{folder.file_count > 1 ? 's' : ''} • {folder.subfolder_count} dossier{folder.subfolder_count > 1 ? 's' : ''}
                  </p>
                  
                  {/* Menu trois points */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuFolder(openMenuFolder === folder.id ? null : folder.id);
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                      title="Options"
                    >
                      ⋮
                    </button>
                    
                    {/* Menu déroulant */}
                    {openMenuFolder === folder.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '40px',
                          right: '0',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          minWidth: '160px',
                          overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolder(folder.id);
                            setRenameValue(folder.name);
                            setOpenMenuFolder(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#111827',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>✏️</span> Renommer
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                            setOpenMenuFolder(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>🗑️</span> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sous-dossiers */}
        {currentFolder && subFolders.length > 0 && (
          <div style={{ marginBottom: files.length > 0 ? '32px' : 0 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Sous-dossiers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {subFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    padding: '20px',
                    border: `2px solid ${folder.color}20`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    backgroundColor: `${folder.color}08`,
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => openFolder(folder)}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${folder.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '12px'
                  }}>
                    📁
                  </div>
                  
                  {editingFolder === folder.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameFolder(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') { setEditingFolder(null); setRenameValue(''); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}
                    />
                  ) : (
                    <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '8px', wordBreak: 'break-word' }}>
                      {folder.name}
                    </h4>
                  )}
                  
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>
                    {folder.file_count} fichier{folder.file_count > 1 ? 's' : ''}
                  </p>
                  
                  {/* Menu trois points */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuFolder(openMenuFolder === folder.id ? null : folder.id);
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                      title="Options"
                    >
                      ⋮
                    </button>
                    
                    {/* Menu déroulant */}
                    {openMenuFolder === folder.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '40px',
                          right: '0',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          minWidth: '160px',
                          overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolder(folder.id);
                            setRenameValue(folder.name);
                            setOpenMenuFolder(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#111827',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>✏️</span> Renommer
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                            setOpenMenuFolder(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>🗑️</span> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fichiers */}
        {currentFolder && files.length > 0 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Fichiers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  onClick={() => handlePreviewFile(file)}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '12px'
                  }}>
                    {getFileIcon(file.mime_type)}
                  </div>
                  
                  {editingFile === file.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameFile(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFile(file.id);
                        if (e.key === 'Escape') { setEditingFile(null); setRenameValue(''); }
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        marginBottom: '8px'
                      }}
                    />
                  ) : (
                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '8px', wordBreak: 'break-word' }}>
                      {file.original_name}
                    </h4>
                  )}
                  
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {formatFileSize(file.file_size)}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                    Par {file.first_name} {file.last_name}
                  </p>
                  
                  {/* Menu trois points */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuFile(openMenuFile === file.id ? null : file.id);
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                      title="Options"
                    >
                      ⋮
                    </button>
                    
                    {/* Menu déroulant */}
                    {openMenuFile === file.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '40px',
                          right: '0',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          minWidth: '160px',
                          overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFile(file.id);
                            setRenameValue(file.original_name);
                            setOpenMenuFile(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#111827',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>✏️</span> Renommer
                        </button>
                        <button
                          onClick={() => {
                            handleDownloadFile(file.id, file.original_name);
                            setOpenMenuFile(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#10b981',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d1fae5'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>⬇️</span> Télécharger
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteFile(file.id);
                            setOpenMenuFile(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>🗑️</span> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message dossier vide */}
        {currentFolder && files.length === 0 && subFolders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📂</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
              Ce dossier est vide
            </h3>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              Commencez par uploader des fichiers ou créer des sous-dossiers
            </p>
          </div>
        )}

        {/* Message aucun dossier */}
        {!currentFolder && rootFolders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📁</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
              Aucun dossier
            </h3>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              Créez votre premier dossier pour organiser vos fichiers
            </p>
          </div>
        )}
      </div>

      {/* Modal Créer Dossier */}
      {showFolderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0, fontSize: '24px', fontWeight: '600', color: '#111827' }}>
              Nouveau dossier
            </h2>
            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                  Nom du dossier *
                </label>
                <input
                  type="text"
                  required
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="Ex: Documents comptables"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                  Description (optionnel)
                </label>
                <textarea
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  placeholder="Description du dossier..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                  Couleur
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                    <div
                      key={color}
                      onClick={() => setFolderForm({ ...folderForm, color })}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: color,
                        cursor: 'pointer',
                        border: folderForm.color === color ? '3px solid #111827' : '2px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#f3f4f6',
                    color: '#111827',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload Fichier */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90vw' }}>
            <h2 style={{ marginTop: 0, fontSize: '24px', fontWeight: '600', color: '#111827' }}>
              Uploader un fichier
            </h2>
            <form onSubmit={handleFileUpload}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                  Fichier *
                </label>
                <input
                  type="file"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: '#374151' }}>
                  Description (optionnel)
                </label>
                <textarea
                  placeholder="Description du fichier..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#f3f4f6',
                    color: '#111827',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  Uploader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closePreview}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: '1000px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                  {previewFile.original_name}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {previewFile.mime_type} • {(previewFile.file_size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={closePreview}
                style={{
                  padding: '8px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: '1',
                  color: '#6b7280',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                ✕
              </button>
            </div>

            {/* Contenu */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9fafb'
            }}>
              {previewFile.mime_type.startsWith('image/') && previewUrl && (
                <img
                  src={previewUrl}
                  alt={previewFile.original_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              )}

              {previewFile.mime_type === 'application/pdf' && previewUrl && (
                <iframe
                  src={previewUrl}
                  style={{
                    width: '100%',
                    height: '70vh',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  title={previewFile.original_name}
                />
              )}

              {previewFile.mime_type.startsWith('video/') && previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    borderRadius: '8px'
                  }}
                />
              )}

              {previewFile.mime_type.startsWith('audio/') && previewUrl && (
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <audio
                    src={previewUrl}
                    controls
                    style={{
                      width: '100%',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              )}

              {previewFile.mime_type.startsWith('text/') && previewContent && (
                <pre
                  style={{
                    width: '100%',
                    maxHeight: '70vh',
                    overflow: 'auto',
                    padding: '16px',
                    backgroundColor: '#1f2937',
                    color: '#f9fafb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    lineHeight: '1.5',
                    margin: 0
                  }}
                >
                  {previewContent}
                </pre>
              )}

              {!previewFile.mime_type.startsWith('image/') &&
               !previewFile.mime_type.startsWith('video/') &&
               !previewFile.mime_type.startsWith('audio/') &&
               !previewFile.mime_type.startsWith('text/') &&
               previewFile.mime_type !== 'application/pdf' && (
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                    Aperçu non disponible pour ce type de fichier
                  </p>
                  <p style={{ fontSize: '14px', marginBottom: '24px' }}>
                    {previewFile.mime_type}
                  </p>
                  <button
                    onClick={() => handleDownloadFile(previewFile)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    Télécharger le fichier
                  </button>
                </div>
              )}
            </div>

            {/* Pied de page */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => handleDownloadFile(previewFile)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                <span>⬇</span>
                Télécharger
              </button>
              <button
                onClick={closePreview}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drive;
