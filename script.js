// ========== ТВОЙ КОНФИГ FIREBASE ==========
  const firebaseConfig = {
    apiKey: "AIzaSyAapgTOCdUqvzmXT782oYEwcWvTfqEVY8g",
    authDomain: "mmesage-c85d1.firebaseapp.com",
    databaseURL: "https://mmesage-c85d1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mmesage-c85d1",
    storageBucket: "mmesage-c85d1.firebasestorage.app",
    messagingSenderId: "760081596830",
    appId: "1:760081596830:web:fbe27db8bff147b159d68f"
  };
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Комнаты
const rooms = {
    lobby: { name: "Лобби", needPassword: false },
    gaming: { name: "Игровая", needPassword: false },
    vip: { name: "VIP", needPassword: true, password: "vip2024" }
};

let currentRoom = null;
let privateUnlocked = false;
let currentListenerRef = null; // текущая ссылка на ref для отписки
let currentOffFunction = null;  // функция отписки

// DOM
const messagesContainer = document.getElementById("messagesContainer");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const roomNameSpan = document.getElementById("roomName");
const roomBadge = document.getElementById("roomBadge");

// Modal
const modal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const passwordSubmit = document.getElementById("passwordSubmit");
const passwordCancel = document.getElementById("passwordCancel");
const passwordError = document.getElementById("passwordError");

let pendingRoom = null;

// Имя пользователя
if (localStorage.getItem("chatUsername")) {
    usernameInput.value = localStorage.getItem("chatUsername");
}
usernameInput.addEventListener("change", () => {
    localStorage.setItem("chatUsername", usernameInput.value);
});

function clearMessages() {
    messagesContainer.innerHTML = '<div class="welcome-message">✨ Выберите комнату и начните общение ✨</div>';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, (m) => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function addMessageToDOM(data, isSelf) {
    if (messagesContainer.children.length === 1 && messagesContainer.children[0].classList?.contains("welcome-message")) {
        messagesContainer.innerHTML = "";
    }
    const div = document.createElement("div");
    div.className = `message ${isSelf ? "message-self" : "message-other"}`;
    const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    div.innerHTML = `
        <div class="message-name">${escapeHtml(data.name || "Аноним")}</div>
        <div class="message-text">${escapeHtml(data.text)}</div>
        <div class="message-time">${time}</div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отписка от старой комнаты
function unsubscribeFromRoom() {
    if (currentListenerRef && currentOffFunction) {
        off(currentListenerRef, 'child_added', currentOffFunction);
        console.log("Отписались от комнаты");
    }
    currentListenerRef = null;
    currentOffFunction = null;
}

// Загрузка комнаты
function loadRoom(roomId) {
    unsubscribeFromRoom();
    clearMessages();
    
    const roomPath = `messages/${roomId}`;
    console.log(`Загружаем комнату: ${roomPath}`);
    currentListenerRef = ref(db, roomPath);
    const limitedQuery = query(currentListenerRef, limitToLast(100));
    
    // Подписываемся
    const callback = (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log(`Сообщение в ${roomId}:`, data.text);
            addMessageToDOM(data, data.name === usernameInput.value);
        }
    };
    onChildAdded(limitedQuery, callback);
    currentOffFunction = callback;
}

// Отправка сообщения
async function sendMessage() {
    if (!currentRoom) {
        alert("Выберите комнату");
        return;
    }
    if (currentRoom === 'vip' && !privateUnlocked) {
        alert("Введите пароль для VIP");
        return;
    }
    let name = usernameInput.value.trim();
    const text = messageInput.value.trim();
    if (!name) name = "Аноним";
    if (!text) return;

    console.log(`Отправляем в комнату ${currentRoom}: ${text}`);
    try {
        const roomRef = ref(db, `messages/${currentRoom}`);
        await push(roomRef, {
            name: name,
            text: text,
            timestamp: serverTimestamp()
        });
        messageInput.value = "";
        messageInput.focus();
    } catch (err) {
        console.error("Ошибка отправки:", err);
        alert("Ошибка: " + err.message);
    }
}

// Переключение комнаты
function switchRoom(roomId) {
    if (roomId === currentRoom) return;
    if (roomId === 'vip' && !privateUnlocked) {
        pendingRoom = roomId;
        modal.style.display = 'flex';
        passwordInput.value = "";
        passwordError.innerText = "";
        return;
    }
    currentRoom = roomId;
    roomNameSpan.textContent = rooms[roomId].name;
    roomBadge.textContent = rooms[roomId].needPassword ? "🔒 Приватная" : "🌐 Открытая";
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.room === roomId);
    });
    loadRoom(roomId);
}

function checkPassword() {
    if (passwordInput.value === rooms.vip.password) {
        privateUnlocked = true;
        modal.style.display = 'none';
        if (pendingRoom === 'vip') switchRoom('vip');
    } else {
        passwordError.innerText = "Неверный пароль!";
    }
}

// Обработчики событий
document.querySelectorAll('.room-btn').forEach(btn => {
    btn.addEventListener('click', () => switchRoom(btn.dataset.room));
});
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
passwordSubmit.addEventListener('click', checkPassword);
passwordCancel.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

// Старт
switchRoom('lobby');
