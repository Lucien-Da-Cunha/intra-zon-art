import { useState, useEffect, useRef } from 'react';
import { messagesAPI } from '../api/api';
import { useAuthStore } from '../store/authStore';

export default function Messages() {
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]); // Changé pour sélection multiple
  const [groupName, setGroupName] = useState('');
  const [conversationType, setConversationType] = useState<'direct' | 'group'>('direct');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null); // Pour le menu trois points
  
  // États pour le scroll infini
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const MESSAGE_LIMIT = 50;

  // Charger les conversations au démarrage
  useEffect(() => {
    loadConversations();
  }, []);

  // Polling pour recharger les conversations toutes les 5 secondes (pour mettre à jour les compteurs)
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Charger les messages quand on sélectionne une conversation (marquer comme lu)
  useEffect(() => {
    if (selectedConversation) {
      setMessages([]); // Réinitialiser les messages
      setMessageOffset(0); // Réinitialiser l'offset
      setHasMoreMessages(true); // Réinitialiser le flag
      loadMessages(selectedConversation, true, 0).then(() => {
        // Scroller vers le bas après le chargement initial
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      });
      loadConversations(); // Recharger les conversations pour mettre à jour le compteur
    }
  }, [selectedConversation]);

  // Polling simple : recharger les messages toutes les 3 secondes (SANS marquer comme lu)
  useEffect(() => {
    if (!selectedConversation) return;
    
    const interval = setInterval(() => {
      loadMessages(selectedConversation, false, 0); // false = ne pas marquer comme lu pendant le polling
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  // Détecter le scroll vers le haut pour charger plus de messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, isLoadingMore, selectedConversation, messageOffset]);

  // Fermer le menu trois points quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const loadConversations = async () => {
    try {
      const response = await messagesAPI.getConversations();
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  const loadMessages = async (conversationId: number, markAsRead = false, offset = 0) => {
    try {
      const response = await messagesAPI.getMessages(conversationId, markAsRead, MESSAGE_LIMIT, offset);
      const newMessages = response.data.messages || [];
      
      if (offset === 0) {
        // Premier chargement : remplacer tous les messages
        setMessages(newMessages);
      } else {
        // Chargement de plus de messages : ajouter au début
        setMessages(prev => [...newMessages, ...prev]);
      }
      
      // Si on reçoit moins de messages que la limite, il n'y en a plus
      if (newMessages.length < MESSAGE_LIMIT) {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedConversation || isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    const newOffset = messageOffset + MESSAGE_LIMIT;
    setMessageOffset(newOffset);

    try {
      const container = messagesContainerRef.current;
      const scrollHeightBefore = container?.scrollHeight || 0;

      await loadMessages(selectedConversation, false, newOffset);

      // Maintenir la position de scroll après l'ajout de messages
      if (container) {
        const scrollHeightAfter = container.scrollHeight;
        container.scrollTop = scrollHeightAfter - scrollHeightBefore;
      }
    } catch (error) {
      console.error('Erreur chargement messages supplémentaires:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await messagesAPI.sendMessage(selectedConversation, messageContent);
      // Recharger immédiatement les messages
      await loadMessages(selectedConversation);
      // Scroller vers le bas après l'envoi
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      alert('Erreur lors de l\'envoi du message');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await messagesAPI.getUsers();
      // Filtrer pour ne pas inclure l'utilisateur connecté
      const filteredUsers = (response.data || []).filter((u: any) => u.id !== user?.id);
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const createConversation = async () => {
    if (selectedUsers.length === 0) {
      alert('Veuillez sélectionner au moins un utilisateur');
      return;
    }

    try {
      let name = '';
      let type = 'direct';

      if (selectedUsers.length === 1) {
        // Conversation directe
        const userName = availableUsers.find(u => u.id === selectedUsers[0]);
        name = `${userName?.first_name} ${userName?.last_name}`;
        type = 'direct';
      } else {
        // Groupe
        if (!groupName.trim()) {
          alert('Veuillez entrer un nom pour le groupe');
          return;
        }
        name = groupName.trim();
        type = 'group';
      }
      
      console.log('Création conversation:', { name, type, selectedUsers });
      
      const response = await messagesAPI.createConversation(name, type, selectedUsers);
      
      console.log('Réponse:', response.data);
      
      await loadConversations();
      setShowNewConv(false);
      setSelectedUsers([]);
      setGroupName('');
      setSelectedConversation(response.data.conversation.id);
    } catch (error: any) {
      console.error('Erreur création conversation:', error);
      console.error('Détails:', error.response?.data);
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const toggleConversationPin = async (conversationId: number) => {
    try {
      // Trouver la conversation actuelle
      const conv = conversations.find(c => c.id === conversationId);
      if (!conv) return;

      // Basculer le statut épinglé
      const newPinnedStatus = !conv.is_pinned;
      
      // Appel API pour persister l'épinglage
      await messagesAPI.pinConversation(conversationId, newPinnedStatus);
      
      // Mettre à jour localement
      setConversations(prev => 
        prev.map(c => 
          c.id === conversationId 
            ? { ...c, is_pinned: newPinnedStatus }
            : c
        ).sort((a, b) => {
          // Les épinglées en premier
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return 0;
        })
      );

      setOpenMenuId(null);
    } catch (error: any) {
      console.error('Erreur épinglage conversation:', error);
      alert('Erreur lors de l\'épinglage de la conversation');
    }
  };

  const deleteConversation = async (conversationId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
      return;
    }

    try {
      // Appel API pour supprimer côté backend
      await messagesAPI.deleteConversation(conversationId);
      
      // Supprimer localement
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // Si c'était la conversation sélectionnée, la désélectionner
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
      }

      setOpenMenuId(null);
    } catch (error: any) {
      console.error('Erreur suppression conversation:', error);
      alert('Erreur lors de la suppression de la conversation');
      // Recharger les conversations en cas d'erreur
      loadConversations();
    }
  };

  return (
    <div className="container">
      <h1>Messagerie</h1>

      {showNewConv && (
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Nouvelle conversation</h3>
            <button 
              onClick={() => {
                setShowNewConv(false);
                setSelectedUsers([]);
                setGroupName('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>

          {/* Champ pour le nom du groupe (si plusieurs utilisateurs sélectionnés) */}
          {selectedUsers.length > 1 && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Nom du groupe *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Équipe Marketing"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}

          {/* Compteur de sélection */}
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              {selectedUsers.length === 0 && 'Aucun utilisateur sélectionné'}
              {selectedUsers.length === 1 && '1 utilisateur sélectionné (conversation directe)'}
              {selectedUsers.length > 1 && `${selectedUsers.length} utilisateurs sélectionnés (groupe)`}
            </span>
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setSelectedUsers([])}
                style={{
                  padding: '5px 12px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Effacer
              </button>
            )}
          </div>
          
          {availableUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              Chargement...
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '10px',
                maxHeight: '400px',
                overflowY: 'auto',
                marginBottom: '15px'
              }}>
                {availableUsers.map(u => {
                  const isSelected = selectedUsers.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      style={{
                        padding: '15px',
                        border: '2px solid',
                        borderColor: isSelected ? '#7c3aed' : '#e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: isSelected ? '#f5f3ff' : 'white',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#7c3aed',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}>
                          ✓
                        </div>
                      )}
                      <div style={{ 
                        width: '50px', 
                        height: '50px', 
                        borderRadius: '50%', 
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '10px'
                      }}>
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {u.first_name} {u.last_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {u.position}
                      </div>
                      {u.department_name && (
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
                          {u.department_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bouton pour créer la conversation */}
              <button
                onClick={createConversation}
                disabled={selectedUsers.length === 0}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: selectedUsers.length === 0 ? '#d1d5db' : '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: selectedUsers.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedUsers.length > 0) {
                    e.currentTarget.style.backgroundColor = '#6d28d9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedUsers.length > 0) {
                    e.currentTarget.style.backgroundColor = '#7c3aed';
                  }
                }}
              >
                {selectedUsers.length === 0 && 'Sélectionnez au moins un utilisateur'}
                {selectedUsers.length === 1 && 'Créer la conversation'}
                {selectedUsers.length > 1 && `Créer le groupe avec ${selectedUsers.length} membres`}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 200px)', overflow: 'hidden' }} className="messages-grid">
        
        {/* Liste des conversations */}
        <div className="card conversations-list" style={{ padding: '0', overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ 
            padding: '15px', 
            borderBottom: '1px solid #e0e0e0', 
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Conversations</span>
            <button
              onClick={() => {
                setShowNewConv(!showNewConv);
                if (!showNewConv) loadUsers();
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#7c3aed',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0'
              }}
              title="Nouvelle conversation"
            >
              +
            </button>
          </div>
          
          {conversations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              Aucune conversation
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                style={{
                  padding: '15px',
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  backgroundColor: conv.unread_count > 0 
                    ? (selectedConversation === conv.id ? '#f0e7ff' : '#f8f4ff')
                    : (selectedConversation === conv.id ? '#f5f5f5' : 'white'),
                  borderLeft: conv.unread_count > 0 ? '4px solid #7c3aed' : '4px solid transparent',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div 
                  onClick={() => setSelectedConversation(conv.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: conv.unread_count > 0 ? 'bold' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {conv.is_pinned && <span style={{ fontSize: '12px' }}>📌</span>}
                      {conv.display_name || conv.participants_names || conv.name}
                    </div>
                    {conv.last_message && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: conv.unread_count > 0 ? '#333' : '#666', 
                        marginTop: '5px',
                        fontWeight: conv.unread_count > 0 ? '500' : 'normal'
                      }}>
                        {conv.last_message}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {conv.unread_count > 0 && (
                      <div style={{
                        minWidth: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '0 6px'
                      }}>
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </div>
                    )}
                    
                    {/* Bouton trois points */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '4px 8px',
                          color: '#666',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        ⋮
                      </button>
                      
                      {/* Menu déroulant */}
                      {openMenuId === conv.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '0',
                            top: '100%',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '180px',
                            overflow: 'hidden'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleConversationPin(conv.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <span>{conv.is_pinned ? '📍' : '📌'}</span>
                            <span>{conv.is_pinned ? 'Désépingler' : 'Épingler'}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              color: '#ef4444',
                              transition: 'background-color 0.2s',
                              borderTop: '1px solid #f0f0f0'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <span>🗑️</span>
                            <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Zone de messages */}
        <div className="card messages-area" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 200px)' }}>
          {!selectedConversation ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              Sélectionnez une conversation pour commencer
            </div>
          ) : (
            <>
              {/* Header mobile avec bouton retour */}
              <div className="mobile-message-header" style={{
                display: 'none',
                padding: '15px',
                borderBottom: '1px solid #e0e0e0',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#f9fafb'
              }}>
                <button
                  onClick={() => setSelectedConversation(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '5px',
                    color: '#333'
                  }}
                >
                  ←
                </button>
                <div style={{ flex: 1, fontWeight: '600', fontSize: '16px', color: '#111827' }}>
                  {conversations.find(c => c.id === selectedConversation)?.display_name || 
                   conversations.find(c => c.id === selectedConversation)?.participants_names || 
                   conversations.find(c => c.id === selectedConversation)?.name || 
                   'Conversation'}
                </div>
              </div>

              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  padding: '20px',
                  minHeight: 0  // Important pour que flex fonctionne correctement avec overflow
                }}
              >
                {/* Indicateur de chargement de messages plus anciens */}
                {isLoadingMore && (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#999', fontSize: '14px' }}>
                    Chargement des messages précédents...
                  </div>
                )}
                
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
                    Aucun message
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '15px',
                        display: 'flex',
                        flexDirection: msg.sender_id === user?.id ? 'row-reverse' : 'row',
                        alignItems: 'flex-end',
                        gap: '8px'
                      }}
                    >
                      {/* Avatar / Initiales */}
                      <div
                        className="message-avatar"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: msg.sender_id === user?.id ? '#7c3aed' : '#6b7280',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}
                        title={msg.sender_id === user?.id ? 'Vous' : (msg.sender_first_name + ' ' + msg.sender_last_name)}
                      >
                        {msg.sender_id === user?.id 
                          ? (user?.firstName?.[0] || 'M') + (user?.lastName?.[0] || 'O')
                          : (msg.sender_first_name?.[0] || '?') + (msg.sender_last_name?.[0] || '?')
                        }
                      </div>

                      {/* Contenu du message */}
                      <div style={{ maxWidth: 'calc(70% - 40px)', display: 'flex', flexDirection: 'column', alignItems: msg.sender_id === user?.id ? 'flex-end' : 'flex-start' }}>
                        {/* Nom de l'expéditeur - masqué sur mobile */}
                        <div 
                          className="sender-name-desktop"
                          style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            color: '#6b7280',
                            marginBottom: '2px',
                            paddingLeft: msg.sender_id === user?.id ? '0' : '4px',
                            paddingRight: msg.sender_id === user?.id ? '4px' : '0'
                          }}>
                          {msg.sender_id === user?.id 
                            ? 'Vous' 
                            : `${msg.sender_first_name} ${msg.sender_last_name}`
                          }
                        </div>

                        {/* Bulle de message */}
                        <div
                          className="message-bubble"
                          style={{
                            padding: '12px 16px',
                            borderRadius: msg.sender_id === user?.id ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            backgroundColor: msg.sender_id === user?.id ? '#7c3aed' : '#f0f0f0',
                            color: msg.sender_id === user?.id ? 'white' : 'black',
                            wordBreak: 'break-word',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            maxWidth: '100%'
                          }}
                        >
                          <div>{msg.content}</div>
                          <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '5px', justifyContent: msg.sender_id === user?.id ? 'flex-end' : 'flex-start' }}>
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.sender_id === user?.id && (
                              <span style={{ fontSize: '14px', color: msg.is_read_by_others ? '#4ade80' : 'inherit' }} 
                                    title={msg.is_read_by_others ? 'Lu' : (msg.is_delivered ? 'Distribué' : 'Envoi...')}>
                                {msg.is_read_by_others ? '✓✓' : (msg.is_delivered ? '✓' : '○')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Formulaire d'envoi */}
              <form onSubmit={sendMessage} className="message-input-form" style={{ padding: '20px', borderTop: '1px solid #e0e0e0', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="message-input"
                    style={{
                      flex: 1,
                      padding: '12px 18px',
                      border: '1px solid #dbdbdb',
                      borderRadius: '22px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: '#fafafa'
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-primary send-button"
                    disabled={!newMessage.trim()}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '22px',
                      fontWeight: '600',
                      fontSize: '14px',
                      background: newMessage.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e0e0e0',
                      border: 'none',
                      color: 'white',
                      cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s'
                    }}
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          body {
            margin: 0;
            padding: 0;
          }

          .container {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            height: calc(100vh - 60px);
            height: calc(100dvh - 60px); /* Dynamic viewport height pour iOS */
            margin-top: 60px !important;
          }

          h1 {
            display: none !important;
          }

          .messages-grid {
            grid-template-columns: 1fr !important;
            height: calc(100vh - 60px) !important;
            height: calc(100dvh - 60px) !important; /* Dynamic viewport height pour iOS */
            gap: 0 !important;
            margin: 0 !important;
          }

          .conversations-list {
            display: ${selectedConversation ? 'none' : 'flex'} !important;
            border-radius: 0 !important;
            height: calc(100vh - 60px) !important;
            height: calc(100dvh - 60px) !important;
            max-height: calc(100vh - 60px) !important;
            max-height: calc(100dvh - 60px) !important;
          }

          .messages-area {
            display: ${selectedConversation ? 'flex' : 'none'} !important;
            max-height: calc(100vh - 60px) !important;
            max-height: calc(100dvh - 60px) !important;
            height: calc(100vh - 60px) !important;
            height: calc(100dvh - 60px) !important;
            border-radius: 0 !important;
          }

          .mobile-message-header {
            display: flex !important;
            position: sticky;
            top: 0;
            z-index: 100;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            border-bottom: none !important;
            padding: 12px 15px !important;
            padding-top: max(12px, env(safe-area-inset-top)) !important;
          }

          .mobile-message-header button {
            color: white !important;
            font-size: 28px;
            font-weight: 300;
          }

          .mobile-message-header div {
            color: white !important;
            font-size: 16px !important;
            font-weight: 600 !important;
          }

          .card {
            border-radius: 0 !important;
            margin-bottom: 0 !important;
            box-shadow: none !important;
          }

          /* Style Instagram pour les messages */
          .messages-area > div:nth-child(2) {
            background: #fafafa;
            padding: 15px !important;
            padding-bottom: calc(15px + env(safe-area-inset-bottom)) !important;
          }

          /* Masquer les noms sur mobile */
          .sender-name-desktop {
            display: none !important;
          }

          /* Avatar plus petit sur mobile */
          .message-avatar {
            width: 28px !important;
            height: 28px !important;
            font-size: 11px !important;
          }

          /* Bulles plus compactes sur mobile */
          .message-bubble {
            padding: 10px 14px !important;
            font-size: 15px !important;
            line-height: 1.4 !important;
          }

          /* Input style Instagram avec safe area */
          .message-input-form {
            padding: 12px 15px !important;
            padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;
            border-top: 1px solid #dbdbdb !important;
            background: white !important;
          }

          .message-input {
            padding: 10px 16px !important;
            border: 1px solid #dbdbdb !important;
            background: #fafafa !important;
            border-radius: 20px !important;
            font-size: 15px !important;
          }

          .message-input:focus {
            background: white !important;
            border-color: #999 !important;
          }

          .send-button {
            padding: 8px 20px !important;
            font-size: 14px !important;
            font-weight: 700 !important;
          }

          /* Timestamp plus petit sur mobile */
          .message-bubble > div:last-child {
            font-size: 10px !important;
            margin-top: 3px !important;
          }
        }

        @media (max-width: 480px) {
          .messages-grid {
            height: 100vh !important;
            height: 100dvh !important;
          }
        }
      `}</style>
    </div>
  );
}
