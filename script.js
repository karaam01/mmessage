// ========== ВСТАВЬ СВОЙ КОНФИГ FIREBASE ==========
  const firebaseConfig = {
    apiKey: "AIzaSyAapgTOCdUqvzmXT782oYEwcWvTfqEVY8g",
    authDomain: "mmesage-c85d1.firebaseapp.com",
    databaseURL: "https://mmesage-c85d1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mmesage-c85d1",
    storageBucket: "mmesage-c85d1.firebasestorage.app",
    messagingSenderId: "760081596830",
    appId: "1:760081596830:web:fbe27db8bff147b159d68f"
  };
// ================================================

import { initializeApp } from "firebase/app";
import { 
    getDatabase, 
    ref, 
    push, 
    onChildAdded, 
    serverTimestamp, 
    query, 
    limitToLast,
    off
} from "firebase/database";

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Список комнат
const ROOMS = {
    lobby: { name: "Лобби", needPassword: false },
    gaming: { name: "Игровая", needPassword: false },
    vip: { name: "VIP", needPassword: true, password: "vip2024" }
};

// Состояние
let currentRoomId = "lobby";
let isVipUnlocked = false;
let currentMessagesRef = null;
let currentMessagesCallback = null;

// DOM элементы
const messagesContainer = document.getElementById("messagesContainer");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const roomNameSpan = document.getElementById("roomName");
const roomBadge = document.getElementById("roomBadge");

// Модальное окно
const modal = document.getElementById("passwordModal");
const passwordInput = document.getElementById("passwordInput");
const passwordSubmit = document.getElementById("passwordSubmit");
const passwordCancel = document.getElementById("passwordCancel");
const passwordError = document.getElementById("passwordError");

let pendingRoomId = null;

// Сохранение имени
if (localStorage.getItem("chatUsername")) {
    usernameInput.value = localStorage.getItem("chatUsername");
}
usernameInput.addEventListener("change", () => {
    localStorage.setItem("chatUsername", usernameInput.value);
});

// Утилита для экранирования HTML
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, (m) => {
        if (m === "&") return "&amp;";
        if (m === "<") return "&lt;";
        if (m === ">") return "&gt;";
        return m;
    });
}

// Очистка области сообщений
function clearMessagesArea() {
    messagesContainer.innerHTML = '<div class="welcome-message">✨ Выберите комнату и начните общение ✨</div>';
}

// Добавление сообщения в DOM
function addMessageToDom(messageData, isFromCurrentUser) {
    // Удаляем приветственное сообщение, если оно есть
    if (messagesContainer.children.length === 1 && 
        messagesContainer.children[0].classList?.contains("welcome-message")) {
        messagesContainer.innerHTML = "";
    }
    
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isFromCurrentUser ? "message-self" : "message-other"}`;
    
    const time = messageData.timestamp ? new Date(messageData.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-name">${escapeHtml(messageData.name || "Аноним")}</div>
        <div class="message-text">${escapeHtml(messageData.text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отписка от текущей комнаты
function unsubscribeFromCurrentRoom() {
    if (currentMessagesRef && currentMessagesCallback) {
        off(currentMessagesRef, "child_added", currentMessagesCallback);
        console.log("Отписались от комнаты");
        currentMessagesRef = null;
        currentMessagesCallback = null;
    }
}

// Загрузка сообщений комнаты
function loadMessagesForRoom(roomId) {
    unsubscribeFromCurrentRoom();
    clearMessagesArea();
    
    const roomPath = `messages/${roomId}`;
    console.log(`Подключаемся к ${roomPath}`);
    currentMessagesRef = ref(db, roomPath);
    const messagesQuery = query(currentMessagesRef, limitToLast(100));
    
    currentMessagesCallback = (snapshot) => {
        const msg = snapshot.val();
        if (msg) {
            const isSelf = (msg.name === usernameInput.value);
            addMessageToDom(msg, isSelf);
        }
    };
    
    onChildAdded(messagesQuery, currentMessagesCallback);
}

// Отправка сообщения
async function sendMessage() {
    // Проверка, что выбрана комната
    if (!currentRoomId) {
        alert("Сначала выберите комнату");
        return;
    }
    
    // Проверка доступа к VIP
    if (currentRoomId === "vip" && !isVipUnlocked) {
        alert("VIP-комната заблокирована. Нажмите на кнопку VIP и введите пароль.");
        return;
    }
    
    let name = usernameInput.value.trim();
    if (!name) name = "Аноним";
    
    const text = messageInput.value.trim();
    if (!text) return;
    if (text.length > 500) {
        alert("Сообщение слишком длинное (макс 500 символов)");
        return;
    }
    
    try {
        const roomRef = ref(db, `messages/${currentRoomId}`);
        await push(roomRef, {
            name: name,
            text: text,
            timestamp: serverTimestamp()
        });
        messageInput.value = "";
        messageInput.focus();
        console.log(`Сообщение отправлено в ${currentRoomId}`);
    } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка отправки: " + error.message + "\nПроверьте правила Firebase.");
    }
}

// Переключение комнаты
function switchToRoom(roomId) {
    if (roomId === currentRoomId) return;
    
    // Если пытаемся войти в VIP без разблокировки
    if (roomId === "vip" && !isVipUnlocked) {
        pendingRoomId = roomId;
        modal.style.display = "flex";
        passwordInput.value = "";
        passwordError.innerText = "";
        return;
    }
    
    // Переключаемся
    currentRoomId = roomId;
    roomNameSpan.textContent = ROOMS[roomId].name;
    roomBadge.textContent = ROOMS[roomId].needPassword ? "🔒 Приватная" : "🌐 Открытая";
    
    // Обновляем активную кнопку
    document.querySelectorAll(".room-btn").forEach(btn => {
        if (btn.dataset.room === roomId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    loadMessagesForRoom(roomId);
}

// Проверка пароля
function checkVipPassword() {
    const enteredPassword = passwordInput.value;
    if (enteredPassword === ROOMS.vip.password) {
        isVipUnlocked = true;
        modal.style.display = "none";
        if (pendingRoomId === "vip") {
            switchToRoom("vip");
        }
        pendingRoomId = null;
    } else {
        passwordError.innerText = "Неверный пароль!";
    }
}

// Закрытие модалки
function closeModal() {
    modal.style.display = "none";
    pendingRoomId = null;
}

// Обработчики событий
document.querySelectorAll(".room-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        switchToRoom(btn.dataset.room);
    });
});

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

passwordSubmit.addEventListener("click", checkVipPassword);
passwordCancel.addEventListener("click", closeModal);
window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

// Запускаем с комнатой "lobby"
switchToRoom("lobby");
