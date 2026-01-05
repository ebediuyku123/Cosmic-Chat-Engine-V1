const socket = io();

// GLOBAL STATE
let currentUsername = "";
let myServers = [];
let activeServer = null;
let activeChannel = "";
let isOwner = false;
let isAdmin = false;
let serverRoles = {};
let rolePermissions = {};
let userPermissions = [];
let currentChannelsList = [];
let hasPulse = false;
let isPlus = false;
let myAvatar = null;
let myBanner = null;
let myBio = "";
let myThemeColor = "#6f55f2";
let myCredits = 0;
let myJoinDate = "";

// DOM SELECTORS
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const loginBtn = document.getElementById("loginBtn");
const errorP = document.getElementById("error");
const serverListContainer = document.getElementById("serverListContainer");
const channelsContainer = document.getElementById("channelsContainer");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const memberListContainer = document.getElementById("memberListContainer");

/* --- 1. KİMLİK DOĞRULAMA --- */
loginBtn.onclick = () => {
    const u = document.getElementById("usernameInput").value.trim();
    const p = document.getElementById("passwordInput").value.trim();
    if (u && p) {
        currentUsername = u;
        socket.emit("login", { username: u, password: p });
    } else errorP.textContent = "Lütfen alanları doldurun!";
};

socket.on("authError", msg => errorP.textContent = msg);

socket.on("loginSuccess", data => {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    myServers = data.joinedServers;
    hasPulse = data.pulse || false;
    isPlus = data.isPlus || false;
    isAdmin = data.isAdmin || false;
    myAvatar = data.avatar || null;
    myBanner = data.banner || null;
    myBio = data.bio || "";
    myThemeColor = data.themeColor || "#6f55f2";
    myCredits = data.credits || 0;
    myJoinDate = data.joinDate || "";
    updateSocialUI(data.friends, data.requests);
    renderServerIcons();
    updatePulseUI();
    if (isAdmin) {
        console.log("🌟 Tanrı Modu Aktif!");
        showAdminBadge();
    }
    if (myServers.length > 0) selectServer(myServers[0]);
});

/* --- 2. SUNUCU & KANAL YÖNETİMİ --- */
function renderServerIcons() {
    serverListContainer.innerHTML = "";
    myServers.forEach(srv => {
        const div = document.createElement("div");
        div.className = `serverIcon ${activeServer === srv ? 'active' : ''}`;
        div.textContent = srv.substring(0, 2).toUpperCase();
        div.onclick = () => selectServer(srv);
        serverListContainer.appendChild(div);
    });
}

function selectServer(name) {
    activeServer = name;
    activeChannel = ""; // Kanalı sıfırla ki render tetiklensin
    renderServerIcons();
    socket.emit("selectServer", name);
}

socket.on("serverData", (data) => {
    document.getElementById("currentServerName").textContent = data.name;
    isOwner = data.isOwner;
    serverRoles = data.roles || {};
    rolePermissions = data.rolePermissions || {};
    userPermissions = data.userPermissions || [];
    currentChannelsList = data.channels;
    
    renderChannelList();

    // Otomatik kanal seçimi
    if (!activeChannel && data.channels.length > 0) {
        selectChannel(data.channels[0]);
    }

    // Yetki bazlı UI kontrolleri
    const canManageChannels = isOwner || userPermissions.includes("manage_channels");
    document.getElementById("serverSettingsBtn").style.visibility = isOwner ? "visible" : "hidden";
    const addChBtn = document.querySelector(".addChannelBtn");
    if(addChBtn) addChBtn.style.display = canManageChannels ? "inline-block" : "none";
});

function renderChannelList() {
    channelsContainer.innerHTML = "";
    const canManageChannels = isOwner || userPermissions.includes("manage_channels");
    
    currentChannelsList.forEach(ch => {
        const div = document.createElement("div");
        div.className = `channel ${activeChannel === ch ? 'active' : ''}`;
        div.innerHTML = `
            <i class="fa-solid fa-hashtag"></i> 
            <span style="flex: 1;">${ch}</span>
            ${canManageChannels ? `<i class="fa-solid fa-xmark" style="opacity: 0.5; font-size: 10px; padding: 4px;" onclick="event.stopPropagation(); deleteChannel('${ch}')"></i>` : ''}
        `;
        div.onclick = () => selectChannel(ch);
        channelsContainer.appendChild(div);
    });
}

function deleteChannel(channelName) {
    if (confirm(`"${channelName}" kanalını silmek istediğinize emin misiniz?`)) {
        socket.emit("deleteChannel", channelName);
    }
}

function selectChannel(chName) {
    activeChannel = chName;
    document.getElementById("headerTitle").textContent = chName;
    renderChannelList(); // CSS 'active' sınıfını güncellemek için
    socket.emit("selectChannel", chName);
}

/* --- 3. ÜYELER & ROL ATAMA SİSTEMİ --- */
socket.on("memberListUpdate", (members) => {
    document.getElementById("memberCount").textContent = members.length;
    memberListContainer.innerHTML = "";
    const canManageMembers = isOwner || userPermissions.includes("manage_members") || isAdmin;
    const canBan = isOwner || userPermissions.includes("ban_users") || isAdmin;
    
    members.forEach(m => {
        const div = document.createElement("div");
        div.className = "member-item";
        div.style.cursor = (canManageMembers || canBan || isAdmin) && m.name !== currentUsername ? "pointer" : "default";
        
        const avatarContent = m.avatar && (m.pulse || m.isPlus)
            ? `<img src="${m.avatar}" class="gif-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
            : '';
        const avatarFallback = `<div class="member-avatar ${(m.pulse || m.isPlus) ? 'gif-avatar' : ''}" style="border: 2px solid ${m.color}; display: ${m.avatar && (m.pulse || m.isPlus) ? 'none' : 'flex'};">${m.name.substring(0, 1).toUpperCase()}</div>`;
        
        const usernameDisplay = m.isPlus 
            ? `<span class="username-rainbow">${m.name}</span> <span class="plus-badge-small">⭐</span>`
            : m.pulse 
            ? `<span class="username-pulse">${m.name}</span>`
            : m.name;
        
        div.innerHTML = `
            ${avatarContent}
            ${avatarFallback}
            <div class="member-name" style="color:${m.color}">
                ${usernameDisplay}
                ${m.isAdmin ? ' <span style="color:#ff0000; font-size:10px;">👑</span>' : ''}
                <br> 
                <small style="opacity:0.6; font-size:10px;">${m.role || 'Üye'}</small>
            </div>
            ${(canBan || isAdmin) && m.name !== currentUsername ? `<i class="fa-solid fa-ban" style="margin-left: auto; opacity: 0.5; cursor: pointer;" onclick="event.stopPropagation(); banUser('${m.name}')" title="Yasakla"></i>` : ''}
        `;
        
        // Sağ tıklama menüsü (Admin için)
        if (isAdmin && m.name !== currentUsername) {
            div.oncontextmenu = (e) => {
                e.preventDefault();
                showAdminContextMenu(e, m.name);
            };
        }
        
        if(canManageMembers && m.name !== currentUsername) {
            div.onclick = () => openRoleAssignModal(m.name);
        }
        memberListContainer.appendChild(div);
    });
});

function banUser(username) {
    if (confirm(`${username} kullanıcısını bu sunucudan yasaklamak istediğinize emin misiniz?`)) {
        socket.emit("banUser", { targetUsername: username });
    }
}

function openRoleAssignModal(target) {
    openModal("modalAssignUserRole");
    document.getElementById("assignTargetName").textContent = target;
    const cont = document.getElementById("roleOptionsContainer");
    cont.innerHTML = "";
    
    Object.keys(serverRoles).forEach(rName => {
        const btn = document.createElement("button");
        btn.className = "btn-primary";
        btn.style.background = serverRoles[rName];
        btn.textContent = rName;
        btn.onclick = () => { socket.emit("assignRole", { target, roleName: rName }); closeAllModals(); };
        cont.appendChild(btn);
    });
    
    const delBtn = document.createElement("button");
    delBtn.textContent = "Rolü Kaldır";
    delBtn.className = "btn-primary btn-secondary";
    delBtn.style.marginTop = "10px";
    delBtn.onclick = () => { socket.emit("assignRole", { target, roleName: null }); closeAllModals(); };
    cont.appendChild(delBtn);
}

/* --- 4. MESAJLAŞMA AKIŞI --- */
socket.on("loadMessages", msgs => {
    messagesDiv.innerHTML = "";
    msgs.forEach(appendMessageToUI);
    scrollToBottom();
});

socket.on("message", data => {
    if (data.channel === activeChannel) {
        appendMessageToUI(data);
        scrollToBottom();
    }
});

function appendMessageToUI(data) {
    const div = document.createElement("div");
    div.className = `msg-row ${data.isBot ? 'bot-message' : ''}`;
    
    // Resim URL'sini text'ten çıkar
    let displayText = data.text || "";
    if (data.imageUrl) {
        const urlPattern = data.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        displayText = displayText.replace(new RegExp(urlPattern, 'gi'), "").trim();
    }
    
    let usernameDisplay = "";
    if (data.isBot) {
        usernameDisplay = `<span style="color:#00ff00; font-weight:bold;">🤖 ${data.user}</span>`;
    } else if (data.isPlus) {
        usernameDisplay = `<span class="username-rainbow">${data.user}</span> <span class="plus-badge-small">⭐</span>`;
    } else if (data.pulse) {
        usernameDisplay = `<span class="username-pulse">${data.user}</span>`;
    } else {
        usernameDisplay = `<strong style="color:${data.roleColor}">${data.user}</strong>`;
    }
    
    div.innerHTML = `
        <div>
            ${usernameDisplay}
            <small style="color:var(--text-muted); font-size:10px; margin-left:8px;">${data.time}</small>
        </div>
        ${displayText ? `<div style="color:#ddd; margin-top:2px; line-height:1.4; white-space: pre-wrap;">${escapeHtml(displayText)}</div>` : ''}
        ${data.imageUrl ? `<img src="${data.imageUrl}" class="msg-image" alt="Gönderilen resim" onerror="this.style.display='none';" />` : ''}
    `;
    messagesDiv.appendChild(div);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() { messagesDiv.scrollTop = messagesDiv.scrollHeight; }

msgInput.onkeydown = e => {
    if (e.key === "Enter" && msgInput.value.trim()) {
        socket.emit("chat", msgInput.value.trim());
        msgInput.value = "";
    }
};

/* --- 5. SOSYAL PANEL VE ARKADAŞLIK --- */
function sendFriendRequest() {
    const val = document.getElementById("friendSearchInput").value.trim();
    if (val) {
        socket.emit("sendFriendRequest", val);
        alert("İstek gönderildi!");
        document.getElementById("friendSearchInput").value = "";
    }
}

socket.on("newFriendNotify", d => {
    if(currentUsername === d.to) alert(d.from + " sana arkadaşlık isteği gönderdi!");
});

socket.on("friendUpdate", d => updateSocialUI(d.friends, d.requests));

function updateSocialUI(friends, requests) {
    const reqSec = document.getElementById("friendRequestsSection");
    const listSec = document.getElementById("friendsListSection");
    
    reqSec.innerHTML = "<h4 style='margin-bottom:10px; font-size:12px; color:var(--accent)'>BEKLEYEN İSTEKLER</h4>";
    requests.forEach(r => {
        const d = document.createElement("div");
        d.className = "member-item";
        d.style.justifyContent = "space-between";
        d.innerHTML = `<span>${r}</span> <button onclick="socket.emit('acceptFriend','${r}')" class="btn-primary" style="width:60px; padding:4px; font-size:10px;">Kabul</button>`;
        reqSec.appendChild(d);
    });

    listSec.innerHTML = "<h4 style='margin:15px 0 10px; font-size:12px; color:var(--accent)'>ARKADAŞLAR</h4>";
    friends.forEach(f => {
        const d = document.createElement("div");
        d.className = "member-item";
        d.innerHTML = `<div class="member-avatar">${f[0].toUpperCase()}</div><span>${f}</span>`;
        listSec.appendChild(d);
    });
}

/* --- 6. MODAL VE UI KONTROLLERİ --- */
function openModal(id) {
    document.getElementById("modalOverlay").classList.remove("hidden");
    document.querySelectorAll(".modal-box").forEach(b => b.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    
    // Pulse modal açıldığında durumu güncelle
    if (id === "modalPulse") {
        updatePulseUI();
    }
    
    // Profil modal açıldığında değerleri doldur
    if (id === "modalProfile") {
        updatePulseUI();
    }
}

function closeAllModals() { document.getElementById("modalOverlay").classList.add("hidden"); }

// Modal Buton Atamaları
document.getElementById("btnCreateServer").onclick = () => {
    const v = document.getElementById("newServerName").value.trim();
    if(v) { socket.emit("createServer", v); closeAllModals(); }
};

document.getElementById("btnJoinServer").onclick = () => {
    const v = document.getElementById("joinServerName").value.trim();
    if(v) { socket.emit("joinGuild", v); closeAllModals(); }
};

document.getElementById("btnCreateChannel").onclick = () => {
    const v = document.getElementById("newChannelName").value.trim();
    if(v) { socket.emit("createChannel", v); closeAllModals(); }
};

document.getElementById("btnCreateRole").onclick = () => {
    const n = document.getElementById("newRoleName").value.trim();
    const c = document.getElementById("newRoleColor").value;
    if(n) {
        const permissions = [];
        if (document.getElementById("permManageChannels")?.checked) permissions.push("manage_channels");
        if (document.getElementById("permManageMembers")?.checked) permissions.push("manage_members");
        if (document.getElementById("permBanUsers")?.checked) permissions.push("ban_users");
        if (document.getElementById("permChangeColors")?.checked) permissions.push("change_colors");
        
        socket.emit("createRole", { name: n, color: c, permissions: permissions }); 
        closeAllModals(); 
    }
};

// UI Tetikleyiciler
document.getElementById("addServerBtn").onclick = () => openModal("modalServer");
document.getElementById("addChannelBtn").onclick = () => openModal("modalChannel");
document.getElementById("serverSettingsBtn").onclick = () => openModal("modalRole");

socket.on("serverCreated", name => {
    myServers.push(name);
    selectServer(name);
});

socket.on("serverJoined", name => {
    if(!myServers.includes(name)) { myServers.push(name); renderServerIcons(); }
    selectServer(name);
});

// Admin İşlemleri
function showAdminBadge() {
    const header = document.getElementById("chatHeader");
    if (header && !document.getElementById("adminBadge")) {
        const badge = document.createElement("div");
        badge.id = "adminBadge";
        badge.innerHTML = "👑 TANRI MODU";
        badge.style.cssText = "position: absolute; right: 20px; background: linear-gradient(135deg, #ff0000, #ff6b6b); padding: 5px 15px; border-radius: 20px; font-size: 11px; font-weight: bold; cursor: pointer;";
        badge.onclick = () => openModal("modalAdmin");
        header.appendChild(badge);
    }
}

function showAdminContextMenu(e, username) {
    let menu = document.getElementById("contextMenu");
    if (!menu) {
        const newMenu = document.createElement("div");
        newMenu.id = "contextMenu";
        newMenu.className = "context-menu";
        newMenu.innerHTML = `
            <div class="context-item" onclick="adminGivePlus('${username}')">⭐ Engine Plus Ver</div>
            <div class="context-item" onclick="adminKickUser('${username}')">👢 Sunucudan At</div>
            <div class="context-item" onclick="adminBanUser('${username}')">🚫 Yasakla</div>
        `;
        document.body.appendChild(newMenu);
        menu = newMenu;
    }
    menu.style.display = "block";
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
    
    setTimeout(() => {
        document.addEventListener("click", function closeMenu() {
            menu.style.display = "none";
            document.removeEventListener("click", closeMenu);
        });
    }, 100);
}

function adminGivePlus(username) {
    if (confirm(`${username} kullanıcısına Engine Plus vermek istediğinize emin misiniz?`)) {
        socket.emit("adminGivePlus", { targetUsername: username });
    }
}

function adminKickUser(username) {
    if (confirm(`${username} kullanıcısını ${activeServer} sunucusundan atmak istediğinize emin misiniz?`)) {
        socket.emit("adminKickUser", { targetUsername: username, serverName: activeServer });
    }
}

function adminBanUser(username) {
    if (confirm(`${username} kullanıcısını tüm sunuculardan yasaklamak istediğinize emin misiniz?`)) {
        socket.emit("adminBanUser", { targetUsername: username });
    }
}

socket.on("adminSuccess", (msg) => {
    alert("✅ " + msg);
});

socket.on("plusGranted", (data) => {
    if (data.username === currentUsername) {
        isPlus = true;
        alert("🎉 Engine Plus size verildi! Sayfayı yenileyin.");
    }
});

socket.on("kickedFromServer", (serverName) => {
    alert(`👢 ${serverName} sunucusundan atıldınız!`);
    if (activeServer === serverName) {
        activeServer = null;
        activeChannel = "";
        if (myServers.length > 0) {
            selectServer(myServers[0]);
        }
    }
});

socket.on("creditsUpdated", (credits) => {
    myCredits = credits;
});

// Profil Güncelleme
function updateProfile() {
    const bio = document.getElementById("profileBio")?.value || "";
    const banner = document.getElementById("profileBanner")?.value || "";
    const themeColor = document.getElementById("profileThemeColor")?.value || "#6f55f2";
    
    socket.emit("updateProfile", { bio, banner, themeColor });
}

socket.on("profileUpdated", (data) => {
    myBio = data.bio || "";
    myBanner = data.banner || null;
    myThemeColor = data.themeColor || "#6f55f2";
    alert("✅ Profil güncellendi!");
    closeAllModals();
});

// Pulse Sistemi
function updatePulseUI() {
    const pulseIndicator = document.getElementById("pulseIndicator");
    const pulseStatusText = document.getElementById("pulseStatusText");
    if (pulseIndicator) {
        pulseIndicator.style.display = (hasPulse || isPlus) ? "block" : "none";
    }
    if (pulseStatusText) {
        pulseStatusText.textContent = (hasPulse || isPlus) ? "Durum: ✨ Aktif" : "Durum: Aktif Değil";
    }
    
    // Profil modal açıldığında değerleri doldur
    if (document.getElementById("profileBio")) {
        document.getElementById("profileBio").value = myBio || "";
        document.getElementById("profileAvatar").value = myAvatar || "";
        document.getElementById("profileBanner").value = myBanner || "";
        document.getElementById("profileThemeColor").value = myThemeColor || "#6f55f2";
    }
}

socket.on("pulseActivated", () => {
    hasPulse = true;
    updatePulseUI();
    if (socket.data.currentServer) {
        socket.emit("selectServer", socket.data.currentServer);
    }
    alert("✨ Cosmic Pulse aktif edildi! Artık özel özelliklere erişebilirsiniz.");
});

socket.on("avatarUpdated", (url) => {
    myAvatar = url;
    alert("Avatar güncellendi!");
});

socket.on("error", (msg) => {
    alert("Hata: " + msg);
});

socket.on("banSuccess", (username) => {
    alert(`${username} yasaklandı.`);
    if (socket.data.currentServer) {
        socket.emit("selectServer", socket.data.currentServer);
    }
});

function activatePulse() {
    if (confirm("Cosmic Pulse'u aktif etmek istediğinize emin misiniz? (Demo amaçlı ücretsiz)")) {
        socket.emit("activatePulse");
    }
}

function updateAvatar() {
    const url = prompt("Avatar URL'sini girin (GIF desteklenir):");
    if (url) {
        socket.emit("updateAvatar", url);
    }
}

function updateAvatarFromProfile() {
    const url = document.getElementById("profileAvatar")?.value;
    if (url) {
        socket.emit("updateAvatar", url);
    }
}