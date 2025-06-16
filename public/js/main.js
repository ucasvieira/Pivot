let socket;

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar Socket.IO
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', function() {
            console.log('Conectado ao servidor');
        });
        
        socket.on('disconnect', function() {
            console.log('Desconectado do servidor');
        });
    }
    
    // Gerenciar formulários globalmente
    setupFormHandlers();
    
    // Verificar se é página de chat
    if (document.body.getAttribute('data-page') === 'chat-conversation') {
        initializeChat();
    }
    
    console.log('Pivot Platform initialized');
});

// Configurar manipuladores de formulários globais
function setupFormHandlers() {
    // Interceptar todos os formulários para gerenciar loading state
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form.tagName === 'FORM') {
            const submitButton = form.querySelector('button[type="submit"]');
            
            if (submitButton && !form.hasAttribute('data-no-loading')) {
                // Não aplicar loading para formulário de chat (será gerenciado separadamente)
                if (form.id !== 'message-form') {
                    setButtonLoading(submitButton, true);
                    
                    // Reset após um tempo ou quando a página mudar
                    setTimeout(() => {
                        setButtonLoading(submitButton, false);
                    }, 3000);
                }
            }
        }
    });
}

// Inicializar funcionalidades específicas do chat
function initializeChat() {
    if (!window.chatData) {
        console.error('Dados do chat não encontrados');
        return;
    }
    
    // PROTEÇÃO: Verificar se o chat já foi inicializado
    if (window.chatInitialized) {
        console.log('Chat já foi inicializado, pulando...');
        return;
    }
    window.chatInitialized = true;
    
    console.log('Inicializando chat...', window.chatData);
    
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const submitButton = messageForm.querySelector('button[type="submit"]');
    const typingIndicator = document.getElementById('typing-indicator');
    
    let typingTimer;
    let chatSocket = socket;
    let lastSentMessage = null;
    
    // Configurar Socket.IO para chat se disponível
    if (chatSocket) {
        // Join conversation room
        chatSocket.emit('join-conversation', window.chatData.conversationId);
        
        // Listen for new messages from other users
        chatSocket.on('new-message', function(data) {
            console.log('Mensagem recebida via socket:', data);
            
            // FILTROS MELHORADOS para evitar duplicação
            const isFromOtherUser = parseInt(data.senderId) !== parseInt(window.chatData.currentUserId);
            const isDifferentFromLastSent = !lastSentMessage || 
                (data.message !== lastSentMessage.message || 
                 Math.abs(new Date(data.created_at) - lastSentMessage.timestamp) > 2000);
            
            if (isFromOtherUser && isDifferentFromLastSent) {
                console.log('Adicionando mensagem de outro usuário');
                addMessageToChat({
                    sender_id: data.senderId,
                    message: data.message,
                    created_at: data.created_at || new Date().toISOString(),
                    first_name: data.senderName ? data.senderName.split(' ')[0] : '',
                    last_name: data.senderName ? data.senderName.split(' ').slice(1).join(' ') : ''
                });
                scrollToBottom();
            } else {
                console.log('Mensagem filtrada (própria ou duplicada)');
            }
        });
        
        // Typing indicators
        messageInput.addEventListener('input', function() {
            chatSocket.emit('typing', {
                conversationId: window.chatData.conversationId,
                userId: window.chatData.currentUserId,
                isTyping: true
            });
            
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                chatSocket.emit('typing', {
                    conversationId: window.chatData.conversationId,
                    userId: window.chatData.currentUserId,
                    isTyping: false
                });
            }, 1000);
        });
        
        chatSocket.on('user-typing', function(data) {
            if (parseInt(data.userId) !== parseInt(window.chatData.currentUserId)) {
                if (data.isTyping) {
                    document.getElementById('typing-user').textContent = window.chatData.otherUserName;
                    typingIndicator.style.display = 'block';
                } else {
                    typingIndicator.style.display = 'none';
                }
            }
        });
    }
    
    // Manipular envio de mensagens
    messageForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // PROTEÇÃO: Verificar se já está enviando
        if (submitButton.disabled) {
            console.log('Envio já em andamento, ignorando...');
            return;
        }
        
        // Gerenciar estado do botão
        setButtonLoading(submitButton, true);
        
        // Salvar referência da mensagem enviada
        lastSentMessage = {
            message: message,
            timestamp: new Date()
        };
        
        console.log('Enviando mensagem para o servidor:', {
            conversationId: window.chatData.conversationId,
            message: message
        });
        
        // Enviar mensagem via AJAX
        fetch('/chat/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversationId: window.chatData.conversationId,
                message: message
            })
        })
        .then(response => {
            console.log('Resposta do servidor:', response.status);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Mensagem salva no banco com sucesso, ID:', data.message.id);
                
                // Adicionar mensagem à UI (APENAS UMA VEZ)
                addMessageToChat({
                    sender_id: window.chatData.currentUserId,
                    message: message,
                    created_at: new Date().toISOString(),
                    first_name: window.chatData.currentUserFirstName,
                    last_name: window.chatData.currentUserLastName
                });
                
                messageInput.value = '';
                scrollToBottom();
            } else {
                console.error('Erro do servidor:', data.error);
                alert('Erro ao enviar mensagem: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Erro de rede:', error);
            alert('Erro ao enviar mensagem');
        })
        .finally(() => {
            console.log('Finalizando envio, restaurando botão');
            setButtonLoading(submitButton, false);
        });
    });
    
    // Enter para enviar
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // Scroll to bottom on load
    scrollToBottom();
}

// Função para gerenciar estado de loading dos botões
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        // Salvar conteúdo original se não foi salvo ainda
        if (!button.hasAttribute('data-original-content')) {
            button.setAttribute('data-original-content', button.innerHTML);
        }
        
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Enviando...';
    } else {
        button.disabled = false;
        const originalContent = button.getAttribute('data-original-content');
        if (originalContent) {
            button.innerHTML = originalContent;
        }
    }
}

// Funções específicas do chat
function addMessageToChat(message) {
    const isOwnMessage = parseInt(message.sender_id) === parseInt(window.chatData.currentUserId);
    
    const messageTime = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const messageHtml = `
        <div class="message-item ${isOwnMessage ? 'own-message' : 'other-message'}">
            <div class="message-content">
                <div class="message-bubble p-3 rounded-3 ${isOwnMessage ? 'bg-primary text-white' : 'bg-light'}">
                    <p class="mb-1">${escapeHtml(message.message)}</p>
                    <small class="${isOwnMessage ? 'text-white-50' : 'text-muted'}">
                        ${messageTime}
                    </small>
                </div>
                <div class="message-label">
                    <small class="text-muted">
                        ${isOwnMessage ? 'Você' : `${message.first_name || window.chatData.otherUserFirstName} ${message.last_name || window.chatData.otherUserLastName}`}
                    </small>
                </div>
            </div>
        </div>
    `;
    
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}