import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { messagesAPI } from '../api/api';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface Conversation {
  id: number;
  name: string;
  display_name?: string;
  last_message?: string;
  unread_count: number;
  type: 'direct' | 'group';
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  department_name: string;
}

function Messages() {
  const { token, user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedConvRef = useRef<number | null>(null);

  // Garder la référence de la conversation sélectionnée à jour
  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Modal nouvelle conversation
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [conversationName, setConversationName] = useState('');

  // Connexion WebSocket
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connecté');
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'auth' && data.status === 'success') {
          console.log('✅ Authentification WebSocket réussie');
        }
        
        // Notification de nouveau message - recharger les messages
        if (data.type === 'message_notification') {
          console.log('📨 Notification nouveau message, conversation:', data.conversationId);
          console.log('Conversation actuellement affichée:', selectedConvRef.current);
          
          // Recharger la liste des conversations pour mettre à jour le dernier message
          loadConversations();
          
          // Recharger les messages SEULEMENT si c'est la conversation actuellement affichée
          if (selectedConvRef.current === data.conversationId) {
            console.log('🔄 Rechargement des messages de la conversation active');
            messagesAPI.getMessages(data.conversationId).then(response => {
              setMessages(response.data.messages || []);
              console.log('✅ Messages rechargés:', response.data.messages?.length);
            }).catch(err => console.error('Erreur rechargement messages:', err));
          } else {
            console.log('ℹ️ Message reçu pour une autre conversation (notif seulement)');
          }
        }
      } catch (error) {
        console.error('❌ Erreur parsing message WebSocket:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Erreur WebSocket:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket déconnecté');
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token]);

  // Charger les conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Charger les messages quand une conversation est sélectionnée
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await messagesAPI.getConversations();
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await messagesAPI.getMessages(conversationId);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Erreur chargement messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedImage) || !selectedConversation) {
      return;
    }

    const messageContent = newMessage.trim();
    const imageFile = selectedImage;

    // Réinitialiser le formulaire immédiatement
    setNewMessage('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      // Envoyer le message au serveur
      const response = await messagesAPI.sendMessage(selectedConversation, messageContent, imageFile || undefined);
      const realMessage = response.data.message;
      console.log('✅ Message envoyé:', realMessage);

      // Ajouter le message localement
      setMessages(prev => [...prev, realMessage]);

      // Notifier les autres clients via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'new_message_notification',
          conversationId: selectedConversation,
          messageId: realMessage.id
        }));
      }

      // Recharger les conversations pour mettre à jour le dernier message
      loadConversations();
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      alert('Erreur lors de l\'envoi du message');
    }
  };


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('L\'image ne doit pas dépasser 10 MB');
        return;
      }
      setSelectedImage(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };




  const openNewConversationModal = async () => {
    try {
      const response = await messagesAPI.getUsers();
      setAvailableUsers(response.data);
      setShowNewConversation(true);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createConversation = async () => {
    if (selectedUsers.length === 0) {
      alert('Sélectionnez au moins un utilisateur');
      return;
    }

    try {
      const name = conversationName.trim() || 
        (selectedUsers.length === 1 
          ? availableUsers.find(u => u.id === selectedUsers[0])?.first_name + ' ' + 
            availableUsers.find(u => u.id === selectedUsers[0])?.last_name
          : 'Nouvelle conversation');

      const type = selectedUsers.length === 1 ? 'direct' : 'group';

      const response = await messagesAPI.createConversation(name, type, selectedUsers);
      
      // Recharger les conversations
      await loadConversations();
      
      // Fermer le modal et réinitialiser
      setShowNewConversation(false);
      setSelectedUsers([]);
      setConversationName('');
      
      // Sélectionner la nouvelle conversation
      setSelectedConversation(response.data.conversation.id);
    } catch (error) {
      console.error('Erreur création conversation:', error);
      alert('Erreur lors de la création de la conversation');
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📨 Messagerie</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: wsConnected ? '#4caf50' : '#f44336',
            display: 'inline-block'
          }}></span>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {wsConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
        {/* Liste des conversations */}
        <div className="card" style={{ padding: '0', overflow: 'auto' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Conversations</span>
            <button
              onClick={openNewConversationModal}
              style={{
                padding: '5px 12px',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              + Nouveau
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
                onClick={() => setSelectedConversation(conv.id)}
                style={{
                  padding: '15px',
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  backgroundColor: selectedConversation === conv.id ? '#f5f5f5' : 'white',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {conv.display_name || conv.name}
                  {conv.type === 'group' && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '11px', 
                      backgroundColor: '#e0e0e0', 
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      fontWeight: 'normal'
                    }}>
                      Groupe
                    </span>
                  )}
                </div>
                {conv.last_message && (
                  <div style={{ fontSize: '13px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message}
                  </div>
                )}
                {conv.unread_count > 0 && (
                  <span style={{
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    marginTop: '5px',
                    display: 'inline-block'
                  }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Zone de messages */}
        <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          {!selectedConversation ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              Sélectionnez une conversation pour commencer
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '15px',
                      display: 'flex',
                      justifyContent: msg.sender_id === user?.id ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: '10px 15px',
                        borderRadius: '15px',
                        backgroundColor: msg.sender_id === user?.id ? '#7c3aed' : '#f0f0f0',
                        color: msg.sender_id === user?.id ? 'white' : 'black'
                      }}
                    >
                      {msg.sender_id !== user?.id && msg.sender_name && (
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', opacity: 0.8 }}>
                          {msg.sender_name}
                        </div>
                      )}
                      <div>
                        {msg.content && <div>{msg.content}</div>}
                        {msg.image_name && (
                          <div style={{ marginTop: msg.content ? '10px' : '0' }}>
                            <img
                              src={`${import.meta.env.VITE_API_URL}/api/messages/messages/${msg.id}/image`}
                              alt={msg.image_name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                              onClick={() => window.open(`${import.meta.env.VITE_API_URL}/api/messages/messages/${msg.id}/image`, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.7 }}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Formulaire d'envoi */}
              <form onSubmit={sendMessage} style={{ padding: '20px', borderTop: '1px solid #e0e0e0' }}>
                {selectedImage && (
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>📎 {selectedImage.name}</span>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '25px',
                      cursor: 'pointer',
                      fontSize: '20px'
                    }}
                    title="Joindre une image"
                  >
                    📎
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message..."
                    style={{
                      flex: 1,
                      padding: '10px 15px',
                      border: '1px solid #ddd',
                      borderRadius: '25px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() && !selectedImage}
                    style={{
                      padding: '10px 25px',
                      backgroundColor: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '25px',
                      cursor: (newMessage.trim() || selectedImage) ? 'pointer' : 'not-allowed',
                      opacity: (newMessage.trim() || selectedImage) ? 1 : 0.5
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

      {/* Modal Nouvelle Conversation */}
      {showNewConversation && (
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
          <div className="card" style={{ width: '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>📝 Nouvelle Conversation</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Nom de la conversation (optionnel)
              </label>
              <input
                type="text"
                value={conversationName}
                onChange={(e) => setConversationName(e.target.value)}
                placeholder="Ex: Projet X, Équipe Support..."
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Sélectionner les participants ({selectedUsers.length} sélectionné{selectedUsers.length > 1 ? 's' : ''})
              </label>
              <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '5px' }}>
                {availableUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      backgroundColor: selectedUsers.includes(u.id) ? '#f3e8ff' : 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {u.position} - {u.department_name}
                      </div>
                    </div>
                    {selectedUsers.includes(u.id) && (
                      <span style={{ color: '#7c3aed', fontSize: '18px' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowNewConversation(false);
                  setSelectedUsers([]);
                  setConversationName('');
                }}
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
                onClick={createConversation}
                disabled={selectedUsers.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: selectedUsers.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: selectedUsers.length > 0 ? 1 : 0.5
                }}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages;
