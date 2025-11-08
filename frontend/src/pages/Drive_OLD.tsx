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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DriveFile[]>([]);
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    parent_id: null as number | null
  });
  const [editingFolder, setEditingFolder] = useState<{ id: number; name: string } | null>(null);
  const [editingFile, setEditingFile] = useState<{ id: number; name: string } | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFileValue, setRenameFileValue] = useState('');
  const [viewerFile, setViewerFile] = useState<DriveFile | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string>('');
  const [viewerContent, setViewerContent] = useState<string>('');
  const [showViewer, setShowViewer] = useState(false);

  const canAccess = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (canAccess) {
      loadFolders();
    }
  }, [canAccess]);

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

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
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

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFolder) return;

    const formElement = e.target as HTMLFormElement;
    const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement;
    const descInput = formElement.querySelector('textarea') as HTMLTextAreaElement;
    
    const file = fileInput.files?.[0];
    if (!file) {
      alert('Veuillez sélectionner un fichier');
      return;
    }

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
      alert('Erreur lors du téléchargement');
    }
  };

  const handleDeleteFile = async (fileId: number, fileName: string) => {
    try {
      await driveAPI.deleteFile(fileId);
      if (currentFolder) {
        loadFolderFiles(currentFolder.id);
      }
    } catch (error: any) {
      console.error('Erreur suppression fichier:', error);
    }
  };

  const handleRenameFolder = async (folderId: number) => {
    if (!renameFolderValue.trim()) return;
    try {
      await driveAPI.updateFolder(folderId, { name: renameFolderValue });
      setEditingFolder(null);
      setRenameFolderValue('');
      loadFolders();
    } catch (error: any) {
      console.error('Erreur renommage dossier:', error);
    }
  };

  const handleRenameFile = async (fileId: number) => {
    if (!renameFileValue.trim()) return;
    try {
      await driveAPI.updateFile(fileId, { original_name: renameFileValue });
      setEditingFile(null);
      setRenameFileValue('');
      if (currentFolder) {
        loadFolderFiles(currentFolder.id);
      }
    } catch (error: any) {
      console.error('Erreur renommage fichier:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await driveAPI.searchFiles(searchQuery);
      setSearchResults(response.data.files || []);
    } catch (error) {
      console.error('Erreur recherche:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'IMG';
    if (mimeType.startsWith('video/')) return 'VID';
    if (mimeType.startsWith('audio/')) return 'AUD';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLS';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PPT';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return 'ZIP';
    if (mimeType.startsWith('text/')) return 'TXT';
    return 'FILE';
  };

  const renderFilePreview = (file: DriveFile) => {
    // Pour les images, afficher une miniature
    if (file.mime_type.startsWith('image/')) {
      return (
        <img
          src={`${import.meta.env.VITE_API_URL}/api/drive/files/${file.id}/download`}
          alt={file.original_name}
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '8px'
          }}
          onError={(e: any) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }

    // Pour les vidéos
    if (file.mime_type.startsWith('video/')) {
      return (
        <div style={{
          width: '100%',
          height: '120px',
          backgroundColor: '#000',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px'
        }}>
          🎬
        </div>
      );
    }

    // Pour les PDF
    if (file.mime_type === 'application/pdf') {
      return (
        <div style={{
          width: '100%',
          height: '120px',
          backgroundColor: '#dc2626',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          color: 'white'
        }}>
          📕 PDF
        </div>
      );
    }

    // Pour les fichiers texte
    if (file.mime_type.startsWith('text/')) {
      return (
        <div style={{
          width: '100%',
          height: '120px',
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          color: '#d4d4d4'
        }}>
          📝
        </div>
      );
    }

    // Par défaut, afficher l'icône
    return (
      <div style={{
        width: '100%',
        height: '120px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px'
      }}>
        {getFileIcon(file.mime_type)}
      </div>
    );
  };

  const canPreview = (mimeType: string) => {
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/')
    );
  };

  const handlePreviewFile = async (file: DriveFile) => {
    if (!canPreview(file.mime_type)) {
      alert('Ce type de fichier ne peut pas être prévisualisé. Veuillez le télécharger.');
      return;
    }

    try {
      const response = await driveAPI.downloadFile(file.id);
      const blob = new Blob([response.data], { type: file.mime_type });
      const url = window.URL.createObjectURL(blob);
      
      // Pour les fichiers texte, lire le contenu
      if (file.mime_type.startsWith('text/')) {
        const text = await blob.text();
        setViewerContent(text);
      }
      
      setViewerFile(file);
      setViewerUrl(url);
      setShowViewer(true);
    } catch (error: any) {
      console.error('Erreur prévisualisation:', error);
      alert('Erreur lors de la prévisualisation du fichier');
    }
  };

  const closeViewer = () => {
    setShowViewer(false);
    if (viewerUrl) {
      window.URL.revokeObjectURL(viewerUrl);
    }
    setViewerUrl('');
    setViewerContent('');
    setViewerFile(null);
  };

  const openFolder = (folder: Folder) => {
    setCurrentFolder(folder);
    setSearchQuery('');
    setSearchResults([]);
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
        <h1>🚫 Accès refusé</h1>
        <div className="card">
          <p>Seuls les managers et administrateurs ont accès au Drive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📁 Drive - Gestion de fichiers</h1>

      {/* Barre de recherche */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Rechercher des fichiers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔍 Rechercher
          </button>
        </div>
      </div>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>Résultats de recherche ({searchResults.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {searchResults.map((file) => (
              <div key={file.id} style={{
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  {renderFilePreview(file)}
                  <div style={{ display: 'none', fontSize: '32px', textAlign: 'center', padding: '20px' }}>
                    {getFileIcon(file.mime_type)}
                  </div>
                </div>
                <h3 style={{ fontSize: '14px', marginBottom: '5px', wordBreak: 'break-word' }}>
                  {file.original_name}
                </h3>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  {formatFileSize(file.file_size)}
                </p>
                <p style={{ fontSize: '11px', color: '#999', marginBottom: '10px' }}>
                  Dossier: {file.folder_name || 'Racine'}
                </p>
                <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                  {canPreview(file.mime_type) && (
                    <button
                      onClick={() => handlePreviewFile(file)}
                      style={{
                        padding: '6px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      👁️ Prévisualiser
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={() => handleDownloadFile(file.id, file.original_name)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      ⬇️ Télécharger
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.original_name)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {currentFolder && (
              <button
                onClick={goBack}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                ← Retour
              </button>
            )}
            <h2 style={{ margin: 0 }}>
              {currentFolder ? `📂 ${currentFolder.name}` : '📁 Tous les dossiers'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {currentFolder && (
              <button
                onClick={() => setShowUploadModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ⬆️ Upload fichier
              </button>
            )}
            <button
              onClick={() => {
                setFolderForm({ name: '', description: '', color: '#3b82f6', parent_id: currentFolder?.id || null });
                setShowFolderModal(true);
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              + Nouveau dossier
            </button>
          </div>
        </div>

        {/* Liste des dossiers */}
        {!currentFolder && rootFolders.length > 0 && (
          <div>
            <h3>Dossiers racine</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              {rootFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    padding: '20px',
                    border: '2px solid ' + folder.color,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: folder.color + '10',
                    position: 'relative'
                  }}
                  onClick={() => openFolder(folder)}
                >
                  <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '10px' }}>
                    📁
                  </div>
                  <h3 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '16px' }}>
                    {folder.name}
                  </h3>
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    {folder.file_count} fichier(s) • {folder.subfolder_count} dossier(s)
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id, folder.name);
                    }}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sous-dossiers */}
        {currentFolder && subFolders.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Sous-dossiers</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
              {subFolders.map((folder) => (
                <div
                  key={folder.id}
                  style={{
                    padding: '20px',
                    border: '2px solid ' + folder.color,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: folder.color + '10',
                    position: 'relative'
                  }}
                  onClick={() => openFolder(folder)}
                >
                  <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '10px' }}>
                    📁
                  </div>
                  <h3 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '16px' }}>
                    {folder.name}
                  </h3>
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
                    {folder.file_count} fichier(s)
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id, folder.name);
                    }}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fichiers du dossier courant */}
        {currentFolder && files.length > 0 && (
          <div>
            <h3>Fichiers</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {files.map((file) => (
                <div key={file.id} style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    {renderFilePreview(file)}
                    <div style={{ display: 'none', fontSize: '48px', textAlign: 'center', padding: '20px' }}>
                      {getFileIcon(file.mime_type)}
                    </div>
                  </div>
                  <h3 style={{ fontSize: '14px', marginBottom: '5px', wordBreak: 'break-word' }}>
                    {file.original_name}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    {formatFileSize(file.file_size)}
                  </p>
                  <p style={{ fontSize: '11px', color: '#999', marginBottom: '10px' }}>
                    Par {file.first_name} {file.last_name}
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                    {canPreview(file.mime_type) && (
                      <button
                        onClick={() => handlePreviewFile(file)}
                        style={{
                          padding: '8px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        👁️ Prévisualiser
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={() => handleDownloadFile(file.id, file.original_name)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ⬇️ Télécharger
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.original_name)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentFolder && files.length === 0 && subFolders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            Ce dossier est vide
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
          <div className="card" style={{ width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>📁 Nouveau dossier</h2>
            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
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
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  placeholder="Description du dossier..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Couleur
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899'].map(color => (
                    <div
                      key={color}
                      onClick={() => setFolderForm({ ...folderForm, color })}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: color,
                        cursor: 'pointer',
                        border: folderForm.color === color ? '3px solid #000' : '2px solid #ddd'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
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
          <div className="card" style={{ width: '500px' }}>
            <h2 style={{ marginTop: 0 }}>⬆️ Upload fichier</h2>
            <form onSubmit={handleFileUpload}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Fichier *
                </label>
                <input
                  type="file"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description (optionnel)
                </label>
                <textarea
                  placeholder="Description du fichier..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualiseur de fichiers */}
      {showViewer && viewerFile && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={closeViewer}
        >
          <div 
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header du visualiseur */}
            <div style={{
              padding: '15px 20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', marginBottom: '5px' }}>
                  {getFileIcon(viewerFile.mime_type)} {viewerFile.original_name}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                  {formatFileSize(viewerFile.file_size)} • {viewerFile.mime_type}
                </p>
              </div>
              <button
                onClick={closeViewer}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ✕ Fermer
              </button>
            </div>

            {/* Contenu du visualiseur */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              minHeight: '400px'
            }}>
              {/* Images */}
              {viewerFile.mime_type.startsWith('image/') && (
                <img
                  src={viewerUrl}
                  alt={viewerFile.original_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}

              {/* Vidéos */}
              {viewerFile.mime_type.startsWith('video/') && (
                <video
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                >
                  <source src={viewerUrl} type={viewerFile.mime_type} />
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              )}

              {/* Audio */}
              {viewerFile.mime_type.startsWith('audio/') && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎵</div>
                  <audio
                    controls
                    style={{
                      width: '400px',
                      maxWidth: '100%'
                    }}
                  >
                    <source src={viewerUrl} type={viewerFile.mime_type} />
                    Votre navigateur ne supporte pas la lecture audio.
                  </audio>
                </div>
              )}

              {/* PDF */}
              {viewerFile.mime_type === 'application/pdf' && (
                <iframe
                  src={viewerUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '600px',
                    border: 'none',
                    backgroundColor: '#525659'
                  }}
                  title={viewerFile.original_name}
                />
              )}

              {/* Fichiers texte */}
              {viewerFile.mime_type.startsWith('text/') && (
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: '20px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textAlign: 'left',
                  lineHeight: '1.6'
                }}>
                  {viewerContent}
                </div>
              )}
            </div>

            {/* Footer avec actions */}
            <div style={{
              padding: '15px 20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              backgroundColor: '#f9fafb'
            }}>
              <button
                onClick={() => handleDownloadFile(viewerFile.id, viewerFile.original_name)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⬇️ Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drive;
