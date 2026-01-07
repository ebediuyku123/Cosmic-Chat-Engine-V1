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

    // Update User Area with current user info
    document.getElementById("currentUserNameDisplay").textContent = currentUsername;
    document.getElementById("currentUserAvatar").textContent = currentUsername.charAt(0).toUpperCase();
    document.getElementById("currentUserTag").textContent = "#" + Math.floor(1000 + Math.random() * 9000);

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
    // Hide DM panel if open
    if (dmOpen) {
        hideDMPanel();
    }

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
    if (addChBtn) addChBtn.style.display = canManageChannels ? "inline-block" : "none";
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

        if (canManageMembers && m.name !== currentUsername) {
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

    let usernameClass = "";
    let usernameExtra = "";
    if (data.isBot) {
        usernameClass = 'style="color:#00ff00;"';
        usernameExtra = "🤖 ";
    } else if (data.isPlus) {
        usernameClass = 'class="username-rainbow"';
        usernameExtra = '<span class="plus-badge-small">⭐</span>';
    } else if (data.pulse) {
        usernameClass = 'class="username-pulse"';
    } else {
        usernameClass = `style="color:${data.roleColor || 'white'}"`;
    }

    const avatarLetter = data.user ? data.user.charAt(0).toUpperCase() : "?";

    div.innerHTML = `
        <div class="msg-avatar">${avatarLetter}</div>
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-username" ${usernameClass}>${usernameExtra}${data.user}</span>
                <span class="msg-time">${data.time}</span>
            </div>
            ${displayText ? `<div class="msg-text">${escapeHtml(displayText)}</div>` : ''}
            ${data.imageUrl ? `<img src="${data.imageUrl}" class="msg-image" alt="Resim" onerror="this.style.display='none';" />` : ''}
        </div>
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
    if (currentUsername === d.to) alert(d.from + " sana arkadaşlık isteği gönderdi!");
});

socket.on("friendUpdate", d => updateSocialUI(d.friends, d.requests));

function updateSocialUI(friends, requests) {
    const reqSec = document.getElementById("friendRequestsSection");
    const listSec = document.getElementById("friendsListSection");

    // Pending Requests
    reqSec.innerHTML = "";
    if (requests.length === 0) {
        reqSec.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Bekleyen istek yok</div>`;
    } else {
        requests.forEach(r => {
            const d = document.createElement("div");
            d.className = "friend-item";
            d.innerHTML = `
                <div class="friend-item-avatar">${r.charAt(0).toUpperCase()}</div>
                <div class="friend-item-info">
                    <div class="friend-item-name">${r}</div>
                    <div class="friend-item-status">Arkadaşlık isteği gönderdi</div>
                </div>
                <div class="friend-item-actions">
                    <button class="accept-btn" onclick="socket.emit('acceptFriend','${r}')" title="Kabul Et">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button title="Reddet">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            reqSec.appendChild(d);
        });
    }

    // Friends List
    listSec.innerHTML = "";
    if (friends.length === 0) {
        listSec.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Henüz arkadaşın yok</div>`;
    } else {
        friends.forEach(f => {
            const d = document.createElement("div");
            d.className = "friend-item";
            d.innerHTML = `
                <div class="friend-item-avatar">${f.charAt(0).toUpperCase()}</div>
                <div class="friend-item-info">
                    <div class="friend-item-name">${f}</div>
                    <div class="friend-item-status">Çevrimiçi</div>
                </div>
                <div class="friend-item-actions">
                    <button class="dm-btn" onclick="closeAllModals(); showDMPanel(); setTimeout(() => openDMChat('${f}'), 100);" title="Mesaj Gönder">
                        <i class="fa-solid fa-comment"></i>
                    </button>
                </div>
            `;
            listSec.appendChild(d);
        });
    }
}

// Friend Tab Switching
function showFriendTab(tab) {
    const tabs = document.querySelectorAll(".friend-tab");
    tabs.forEach(t => t.classList.remove("active"));

    const reqSec = document.getElementById("friendRequestsSection");
    const listSec = document.getElementById("friendsListSection");

    if (tab === "all") {
        tabs[0]?.classList.add("active");
        reqSec.style.display = "none";
        listSec.style.display = "block";
    } else if (tab === "pending") {
        tabs[1]?.classList.add("active");
        reqSec.style.display = "block";
        listSec.style.display = "none";
    }
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
    if (v) { socket.emit("createServer", v); closeAllModals(); }
};

document.getElementById("btnJoinServer").onclick = () => {
    const v = document.getElementById("joinServerName").value.trim();
    if (v) { socket.emit("joinGuild", v); closeAllModals(); }
};

document.getElementById("btnCreateChannel").onclick = () => {
    const v = document.getElementById("newChannelName").value.trim();
    if (v) { socket.emit("createChannel", v); closeAllModals(); }
};

document.getElementById("btnCreateRole").onclick = () => {
    const n = document.getElementById("newRoleName").value.trim();
    const c = document.getElementById("newRoleColor").value;
    if (n) {
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
    if (!myServers.includes(name)) { myServers.push(name); renderServerIcons(); }
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

// --- ENGINE PLUS AVATAR/BANNER SELECTION ---
function selectPlusAvatar(url) {
    if (!isPlus && !hasPulse) {
        alert("⚠️ Bu özellik sadece Engine Plus üyelerine açıktır. Önce Plus'ı aktif edin!");
        return;
    }

    // Update visual selection
    document.querySelectorAll(".avatar-item").forEach(item => item.classList.remove("selected"));
    event.currentTarget.classList.add("selected");

    // Send to server
    socket.emit("updateAvatar", url);

    // Also update profile input if exists
    const profileAvatarInput = document.getElementById("profileAvatar");
    if (profileAvatarInput) {
        profileAvatarInput.value = url;
    }

    alert("✅ Avatar seçildi! Kaydetmek için Profil Ayarlarından onaylayın.");
}

function selectPlusBanner(url) {
    if (!isPlus && !hasPulse) {
        alert("⚠️ Bu özellik sadece Engine Plus üyelerine açıktır. Önce Plus'ı aktif edin!");
        return;
    }

    // Update visual selection
    document.querySelectorAll(".banner-item").forEach(item => item.classList.remove("selected"));
    event.currentTarget.classList.add("selected");

    // Update profile input if exists
    const profileBannerInput = document.getElementById("profileBanner");
    if (profileBannerInput) {
        profileBannerInput.value = url;
    }

    // Send to server
    socket.emit("updateProfile", { banner: url });

    alert("✅ Banner seçildi!");
}

/* ============================================
   DISCORD-STYLE NEW FEATURES
   ============================================ */

// --- TOGGLE MEMBER LIST ---
function toggleMemberList() {
    const bar = document.getElementById("membersBar");
    if (bar.style.display === "none") {
        bar.style.display = "flex";
    } else {
        bar.style.display = "none";
    }
}

// --- VOICE CHANNEL SYSTEM ---
let currentVoiceChannel = null;

function joinVoiceChannel(element) {
    // Leave previous voice channel
    if (currentVoiceChannel) {
        currentVoiceChannel.classList.remove("connected");
    }

    // Join new voice channel
    currentVoiceChannel = element;
    element.classList.add("connected");

    const channelName = element.getAttribute("data-channel");

    // Show voice status
    const voiceStatus = document.getElementById("voiceStatus");
    const voiceChannelName = document.getElementById("voiceChannelName");
    voiceStatus.style.display = "flex";
    voiceChannelName.textContent = channelName;

    // Notify server (for demo, just log)
    console.log("🎧 Ses kanalına bağlanıldı:", channelName);
    socket.emit("joinVoice", { channel: channelName, server: activeServer });
}

function disconnectVoice() {
    if (currentVoiceChannel) {
        currentVoiceChannel.classList.remove("connected");
        currentVoiceChannel = null;
    }

    const voiceStatus = document.getElementById("voiceStatus");
    voiceStatus.style.display = "none";

    console.log("📴 Ses kanalından ayrıldı");
    socket.emit("leaveVoice");
}

// Voice events from server
socket.on("voiceUserJoined", data => {
    console.log(`🎧 ${data.user} ses kanalına katıldı: ${data.channel}`);
});

socket.on("voiceUserLeft", data => {
    console.log(`📴 ${data.user} ses kanalından ayrıldı`);
});

// --- DM (DIRECT MESSAGE) SYSTEM ---
let dmOpen = false;
let currentDMUser = null;
let dmMessagesCache = {};
let myFriendsList = [];

// Toggle between server view and DM panel
function showDMPanel() {
    dmOpen = true;

    // Hide server chat elements
    document.getElementById("chatArea").style.display = "none";
    document.getElementById("membersBar").style.display = "none";
    document.getElementById("sidebar").style.display = "none";

    // Show DM panel
    const dmPanel = document.getElementById("dmPanel");
    dmPanel.classList.remove("hidden");

    // Update home button to active
    document.getElementById("homeBtn").classList.add("active");

    // Deselect servers
    document.querySelectorAll("#serverListContainer .serverIcon").forEach(s => s.classList.remove("active"));

    // Render friends list
    renderDMFriendsList();
}

function hideDMPanel() {
    dmOpen = false;

    // Show server chat elements
    document.getElementById("chatArea").style.display = "flex";
    document.getElementById("membersBar").style.display = "flex";
    document.getElementById("sidebar").style.display = "flex";

    // Hide DM panel
    const dmPanel = document.getElementById("dmPanel");
    dmPanel.classList.add("hidden");

    // Deactivate home button
    document.getElementById("homeBtn").classList.remove("active");
}

// Render friends in DM sidebar
function renderDMFriendsList() {
    const container = document.getElementById("dmFriendsList");
    if (!container) return;

    container.innerHTML = "";

    if (myFriendsList.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">
            <p>Henüz arkadaşın yok!</p>
            <button class="btn-primary" onclick="openModal('modalSocial')" style="margin-top: 10px;">
                Arkadaş Ekle
            </button>
        </div>`;
        return;
    }

    myFriendsList.forEach(friend => {
        const div = document.createElement("div");
        div.className = `dm-friend-item ${currentDMUser === friend ? 'active' : ''}`;
        div.onclick = () => openDMChat(friend);
        div.innerHTML = `
            <div class="dm-friend-avatar online">${friend.charAt(0).toUpperCase()}</div>
            <div class="dm-friend-info">
                <div class="dm-friend-name">${friend}</div>
                <div class="dm-friend-status">Çevrimiçi</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Open a DM chat with specific user
function openDMChat(username) {
    currentDMUser = username;

    // Update UI - use style.display to ensure visibility
    const dmWelcome = document.getElementById("dmWelcome");
    const dmChatArea = document.getElementById("dmChatArea");

    if (dmWelcome) {
        dmWelcome.style.display = "none";
    }
    if (dmChatArea) {
        dmChatArea.style.display = "flex";
        dmChatArea.classList.remove("hidden");
    }

    document.getElementById("dmChatUsername").textContent = username;

    // Clear previous messages
    const msgContainer = document.getElementById("dmMessages");
    if (msgContainer) msgContainer.innerHTML = "";

    // Update active state in friends list
    document.querySelectorAll(".dm-friend-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".dm-friend-item").forEach(item => {
        if (item.querySelector(".dm-friend-name")?.textContent === username) {
            item.classList.add("active");
        }
    });

    // Load DM history
    socket.emit("loadDMs", username);

    // Focus on input
    setTimeout(() => {
        document.getElementById("dmInput")?.focus();
    }, 100);
}

// Render DM messages
function renderDMMessages(messages) {
    const container = document.getElementById("dmMessages");
    if (!container) return;

    container.innerHTML = "";

    messages.forEach(msg => {
        const div = document.createElement("div");
        div.className = "msg-row";

        const isMe = msg.from === currentUsername;
        const displayName = isMe ? currentUsername : msg.from;

        div.innerHTML = `
            <div class="msg-avatar">${displayName.charAt(0).toUpperCase()}</div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-username" style="color: ${isMe ? 'var(--accent)' : 'white'}">${displayName}</span>
                    <span class="msg-time">${msg.time || ''}</span>
                </div>
                <div class="msg-text">${escapeHtml(msg.text)}</div>
            </div>
        `;
        container.appendChild(div);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// DM Input Handler
document.getElementById("dmInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && currentDMUser) {
        const input = document.getElementById("dmInput");
        const text = input.value.trim();
        if (text) {
            socket.emit("sendDM", { to: currentDMUser, text: text });
            input.value = "";

            // Optimistically add message to UI
            const container = document.getElementById("dmMessages");
            const div = document.createElement("div");
            div.className = "msg-row";
            div.innerHTML = `
                <div class="msg-avatar">${currentUsername.charAt(0).toUpperCase()}</div>
                <div class="msg-content">
                    <div class="msg-header">
                        <span class="msg-username" style="color: var(--accent)">${currentUsername}</span>
                        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="msg-text">${escapeHtml(text)}</div>
                </div>
            `;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }
    }
});

// Update home button click handler
document.getElementById("homeBtn").onclick = function () {
    if (dmOpen) {
        hideDMPanel();
        if (myServers.length > 0) selectServer(myServers[0]);
    } else {
        showDMPanel();
    }
};

// DM Socket Events
socket.on("dmReceived", data => {
    console.log(`💬 DM alındı: ${data.from}: ${data.text}`);

    // If we're chatting with this user, show the message
    if (currentDMUser === data.from && dmOpen) {
        const container = document.getElementById("dmMessages");
        const div = document.createElement("div");
        div.className = "msg-row";
        div.innerHTML = `
            <div class="msg-avatar">${data.from.charAt(0).toUpperCase()}</div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-username">${data.from}</span>
                    <span class="msg-time">${data.time || ''}</span>
                </div>
                <div class="msg-text">${escapeHtml(data.text)}</div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    } else {
        // Show notification
        console.log(`💬 Bildirim: ${data.from} sana mesaj gönderdi`);
    }
});

socket.on("dmHistory", data => {
    dmMessagesCache[data.user] = data.messages || [];
    renderDMMessages(data.messages || []);
});

// Update the social panel to store friends list
const originalUpdateSocialUI = updateSocialUI;
updateSocialUI = function (friends, requests) {
    myFriendsList = friends || [];
    originalUpdateSocialUI(friends, requests);

    // If DM panel is open, update the friends list
    if (dmOpen) {
        renderDMFriendsList();
    }
};
