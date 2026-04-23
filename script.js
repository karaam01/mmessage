// ========== ВСТАВЬТЕ СВОЙ КОНФИГ FIREBASE ==========
  const firebaseConfig = {
    apiKey: "AIzaSyAapgTOCdUqvzmXT782oYEwcWvTfqEVY8g",
    authDomain: "mmesage-c85d1.firebaseapp.com",
    databaseURL: "https://mmesage-c85d1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mmesage-c85d1",
    storageBucket: "mmesage-c85d1.firebasestorage.app",
    messagingSenderId: "760081596830",
    appId: "1:760081596830:web:fbe27db8bff147b159d68f"
  };
// =================================================

import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast } from "firebase/database";

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Комнаты
const rooms = {
    lobby: { name: "Лобби", needPassword: false },
    gaming: { name: "Игровая", needPassword: false },
    vip: { name: "VIP", needPassword: true, password: "vip2024" }   // ← смените пароль
};

let currentRoom = null;         // 'lobby', 'gaming', 'vip'
let privateUnlocked = false;    // флаг для VIP
let currentUnsubscribe = null;   // функция отписки от сообщений

// DOM элементы
const roomsList = document.getElementById("roomsList");
const roomNameSpan = document.getElementById("roomName");
const roomBadge = document.getElementById("roomBadge");
const messagesContainer = document.getElementById("messagesContainer");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// Модалка пароля
const modal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const passwordSubmit = document.getElementById("passwordSubmit");
const passwordCancel = document.getElementById("passwordCancel");
const passwordError = document.getElementById("passwordError");

// Сохранение имени
if (localStorage.getItem("chatUsername")) {
    usernameInput.value = localStorage.getItem("chatUsername");
}
usernameInput.addEventListener("change", () => {
    localStorage.setItem("chatUsername", usernameInput.value);
});

// Очистка сообщений и отписка
function clearMessages() {
    messagesContainer.innerHTML = '<div class="welcome-message">✨ Выберите комнату и начните общение ✨</div>';
    if (currentUnsubscribe) {
        // отписка: onChildAdded возвращает функцию отписки? Нет, в Web SDK onChildAdded не возвращает отписку. 
        // Просто пересоздадим ref, старый listener останется, но его можно игнорировать, установив флаг.
        // Лучше запоминать ref и отключать через off(). Но для простоты назначим currentUnsubscribe как callback.
        // Реализуем правильно: при смене комнаты вызываем off() у старого ref.
        if (currentRef) {
            currentRef.off(); // отключаем все слушатели
            currentRef = null;
        }
    }
}

let currentRef = null; // храним текущую ссылку на ref, чтобы отписаться

// Добавление сообщения в DOM
function addMessageToDOM(data, isSelf) {
    // Удаляем заглушку приветствия, если она есть
    if (messagesContainer.children.length === 1 && messagesContainer.children[0].classList?.contains("welcome-message")) {
        messagesContainer.innerHTML = "";
    }
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isSelf ? "message-self" : "message-other"}`;
    
    const nameSpan = document.createElement("div");
    nameSpan.className = "message-name";
    nameSpan.textContent = data.name || "Аноним";
    
    const textSpan = document.createElement("div");
    textSpan.className = "message-text";
    textSpan.textContent = data.text;
    
    const timeSpan = document.createElement("div");
    timeSpan.className = "message-time";
    const date = data.timestamp ? new Date(data.timestamp) : new Date();
    timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Загрузка комнаты
function loadRoom(roomId) {
    if (currentRef) {
        currentRef.off(); // отписываемся от старых событий
        currentRef = null;
    }
    clearMessages();
    
    const roomPath = `messages/${roomId}`;
    currentRef = ref(db, roomPath);
    const limitedQuery = query(currentRef, limitToLast(100));
    
    // Подписываемся на новые сообщения
    onChildAdded(limitedQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const isSelf = (data.name === usernameInput.value);
            addMessageToDOM(data, isSelf);
        }
    });
}

// Отправка сообщения
async function sendMessage() {
    if (!currentRoom) {
        alert("Сначала выберите комнату");
        return;
    }
    if (currentRoom === 'vip' && !privateUnlocked) {
        alert("VIP-комната заблокирована. Нажмите на кнопку VIP и введите пароль.");
        return;
    }
    let name = usernameInput.value.trim();
    const text = messageInput.value.trim();
    if (!name) name = "Аноним";
    if (!text) return;
    if (text.length > 500) {
        alert("Сообщение слишком длинное (макс 500 символов)");
        return;
    }
    try {
        const roomRef = ref(db, `messages/${currentRoom}`);
        await push(roomRef, {
            name: name,
            text: text,
            timestamp: serverTimestamp()
        });
        messageInput.value = "";
        messageInput.focus();
    } catch (error) {
        console.error(error);
        alert("Ошибка отправки. Проверьте настройки Firebase и правила БД.");
    }
}

// Переключение комнаты
async function switchRoom(roomId) {
    if (roomId === currentRoom) return;
    
    // Проверка пароля для VIP
    if (roomId === 'vip' && !privateUnlocked) {
        showPasswordModal(roomId);
        return;
    }
    
    currentRoom = roomId;
    roomNameSpan.textContent = rooms[roomId].name;
    roomBadge.textContent = rooms[roomId].needPassword ? "🔒 Приватная" : "🌐 Открытая";
    // Обновляем активную кнопку
    document.querySelectorAll('.room-btn').forEach(btn => {
        if (btn.dataset.room === roomId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    loadRoom(roomId);
}

// Модальное окно
let pendingRoom = null;

function showPasswordModal(roomId) {
    pendingRoom = roomId;
    modal.style.display = 'flex';
    passwordInput.value = '';
    passwordError.innerText = '';
}

function hidePasswordModal() {
    modal.style.display = 'none';
    pendingRoom = null;
}

function checkPassword() {
    const pwd = passwordInput.value;
    const correctPassword = rooms.vip.password; // "vip2024"
    if (pwd === correctPassword) {
        privateUnlocked = true;
        hidePasswordModal();
        // Переключаемся на VIP комнату
        if (pendingRoom === 'vip') {
            switchRoom('vip');
        }
    } else {
        passwordError.innerText = 'Неверный пароль! Попробуйте ещё раз.';
    }
}

// Обработчики событий
document.querySelectorAll('.room-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const roomId = btn.dataset.room;
        switchRoom(roomId);
    });
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

passwordSubmit.addEventListener('click', checkPassword);
passwordCancel.addEventListener('click', () => {
    hidePasswordModal();
    // Если текущая комната не выбрана, можно оставить как есть
});

// Закрытие модалки по клику вне окна (дополнительно)
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        hidePasswordModal();
    }
});

// По умолчанию загружаем лобби
switchRoom('lobby');