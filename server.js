const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const DB_PATH = path.join(__dirname, "database.json");

/* =========================
    VERİTABANI YÖNETİMİ
========================= */
let USERS = {};
let SERVERS = {
    "Global": { 
        owner: "system", 
        channels: { "genel": [], "yardım": [] }, 
        roles: { "Mod": "#00ff00" },
        rolePermissions: { "Mod": ["manage_channels", "manage_members"] },
        userRoles: {}, 
        activeUsers: new Set(),
        bannedUsers: []
    }
};

if (fs.existsSync(DB_PATH)) {
    try {
        const rawData = fs.readFileSync(DB_PATH, "utf8");
        const parsed = JSON.parse(rawData);
        USERS = parsed.USERS || {};
        
        if (parsed.SERVERS) {
            Object.keys(parsed.SERVERS).forEach(sName => {
                SERVERS[sName] = parsed.SERVERS[sName];
                SERVERS[sName].activeUsers = new Set();
                if (!SERVERS[sName].userRoles) SERVERS[sName].userRoles = {};
                if (!SERVERS[sName].rolePermissions) SERVERS[sName].rolePermissions = {};
                if (!SERVERS[sName].bannedUsers) SERVERS[sName].bannedUsers = [];
            });
        }
        console.log(">> Cosmic Database v3.2 Loaded Successfully.");
    } catch (err) {
        console.error(">> DB Load Error:", err);
    }
}

function saveDB() {
    try {
        const dataToSave = { USERS: USERS, SERVERS: {} };
        Object.keys(SERVERS).forEach(sName => {
            const { activeUsers, ...rest } = SERVERS[sName];
            dataToSave.SERVERS[sName] = rest;
        });
        fs.writeFileSync(DB_PATH, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
        console.error(">> DB Save Error:", err);
    }
}

/* =========================
    SOCKET.IO CORE LOGIC
========================= */
io.on("connection", socket => {
    socket.data.auth = false;

    // --- GİRİŞ & KAYIT ---
    socket.on("login", ({ username, password }) => {
        try {
            if (!username || !password) return;

            // Özel Admin Hesabı Kontrolü
            const isAdmin = (username === "+" && password === "2013");
            
            if (!USERS[username] && !isAdmin) {
                USERS[username] = { 
                    password, 
                    servers: ["Global"], 
                    friends: [], 
                    requests: [],
                    pulse: false,
                    isPlus: false,
                    avatar: null,
                    banner: null,
                    bio: "",
                    themeColor: "#6f55f2",
                    credits: 0,
                    dailyClaimed: null,
                    joinDate: new Date().toISOString()
                };
                saveDB();
            } else if (isAdmin) {
                // Admin hesabı yoksa oluştur
                if (!USERS["+"]) {
                    USERS["+"] = {
                        password: "2013",
                        servers: ["Global"],
                        friends: [],
                        requests: [],
                        pulse: true,
                        isPlus: true,
                        avatar: null,
                        banner: null,
                        bio: "🌟 Tanrı Modu Aktif",
                        themeColor: "#ff0000",
                        credits: 999999,
                        dailyClaimed: null,
                        joinDate: new Date().toISOString(),
                        isAdmin: true
                    };
                    saveDB();
                }
            } else if (USERS[username].password !== password) {
                return socket.emit("authError", "Şifre yanlış!");
            }
            
            // Eksik alanları doldur
            if (!USERS[username].pulse) USERS[username].pulse = false;
            if (!USERS[username].isPlus) USERS[username].isPlus = false;
            if (!USERS[username].avatar) USERS[username].avatar = null;
            if (!USERS[username].banner) USERS[username].banner = null;
            if (!USERS[username].bio) USERS[username].bio = "";
            if (!USERS[username].themeColor) USERS[username].themeColor = "#6f55f2";
            if (!USERS[username].credits) USERS[username].credits = 0;
            if (!USERS[username].joinDate) USERS[username].joinDate = new Date().toISOString();

            socket.data.auth = true;
            socket.data.username = username;
            socket.data.isAdmin = isAdmin || (USERS[username].isAdmin === true);
            
            socket.emit("loginSuccess", { 
                username, 
                joinedServers: USERS[username].servers,
                friends: USERS[username].friends || [],
                requests: USERS[username].requests || [],
                pulse: USERS[username].pulse || false,
                isPlus: USERS[username].isPlus || false,
                avatar: USERS[username].avatar || null,
                banner: USERS[username].banner || null,
                bio: USERS[username].bio || "",
                themeColor: USERS[username].themeColor || "#6f55f2",
                credits: USERS[username].credits || 0,
                joinDate: USERS[username].joinDate || new Date().toISOString(),
                isAdmin: socket.data.isAdmin
            });
        } catch (err) {
            console.error(">> login Error:", err);
            socket.emit("authError", "Giriş sırasında bir hata oluştu!");
        }
    });

    // --- SUNUCU YÖNETİMİ ---
    socket.on("createServer", (name) => {
        if(!socket.data.auth || !name || SERVERS[name]) return; 

        SERVERS[name] = {
            owner: socket.data.username,
            channels: { "genel": [] },
            roles: { "Admin": "#ff4757" },
            rolePermissions: { "Admin": ["manage_channels", "manage_members", "ban_users", "change_colors"] },
            userRoles: {},
            activeUsers: new Set(),
            bannedUsers: []
        };
        SERVERS[name].userRoles[socket.data.username] = "Admin";
        
        USERS[socket.data.username].servers.push(name);
        saveDB();
        socket.emit("serverCreated", name);
    });

    socket.on("joinGuild", (name) => {
        if(!socket.data.auth || !SERVERS[name]) return;
        const userSrvs = USERS[socket.data.username].servers;
        if(!userSrvs.includes(name)) {
            userSrvs.push(name);
            saveDB();
            socket.emit("serverJoined", name);
        }
    });

    socket.on("selectServer", (serverName) => {
        if(!socket.data.auth || !SERVERS[serverName]) return;
        
        if (socket.data.currentServer && SERVERS[socket.data.currentServer]) {
            SERVERS[socket.data.currentServer].activeUsers.delete(socket.data.username);
            updateMemberList(socket.data.currentServer);
            socket.leave(socket.data.currentServer);
        }

        const srv = SERVERS[serverName];
        socket.join(serverName); 
        socket.data.currentServer = serverName;
        srv.activeUsers.add(socket.data.username);
        
        const userRole = srv.userRoles[socket.data.username] || "";
        const userPermissions = srv.rolePermissions[userRole] || [];
        
        socket.emit("serverData", {
            name: serverName,
            channels: Object.keys(srv.channels),
            roles: srv.roles,
            rolePermissions: srv.rolePermissions || {},
            isOwner: srv.owner === socket.data.username,
            userRole: userRole,
            userPermissions: userPermissions
        });

        updateMemberList(serverName);
    });

    // --- ROL & KANAL İŞLEMLERİ ---
    socket.on("assignRole", ({ target, roleName }) => {
        const srv = SERVERS[socket.data.currentServer];
        if(srv && srv.owner === socket.data.username) {
            if (roleName === null) delete srv.userRoles[target];
            else srv.userRoles[target] = roleName;
            
            saveDB();
            updateMemberList(socket.data.currentServer);
        }
    });

    socket.on("createChannel", (channelName) => {
        const srv = SERVERS[socket.data.currentServer];
        if(srv && srv.owner === socket.data.username) {
            if(!srv.channels[channelName]) {
                srv.channels[channelName] = [];
                saveDB();
                io.to(socket.data.currentServer).emit("serverData", {
                    name: socket.data.currentServer,
                    channels: Object.keys(srv.channels),
                    roles: srv.roles,
                    isOwner: true
                });
            }
        }
    });

    socket.on("createRole", ({ name, color, permissions }) => {
        try {
            const srv = SERVERS[socket.data.currentServer];
            if(srv && srv.owner === socket.data.username) {
                srv.roles[name] = color;
                if (!srv.rolePermissions) srv.rolePermissions = {};
                srv.rolePermissions[name] = permissions || [];
                saveDB();
                io.to(socket.data.currentServer).emit("serverData", {
                    name: socket.data.currentServer,
                    channels: Object.keys(srv.channels),
                    roles: srv.roles,
                    rolePermissions: srv.rolePermissions,
                    isOwner: true
                });
                updateMemberList(socket.data.currentServer);
            }
        } catch (err) {
            console.error(">> createRole Error:", err);
        }
    });
    
    socket.on("updateRolePermissions", ({ roleName, permissions }) => {
        try {
            const srv = SERVERS[socket.data.currentServer];
            if(srv && srv.owner === socket.data.username) {
                if (!srv.rolePermissions) srv.rolePermissions = {};
                srv.rolePermissions[roleName] = permissions || [];
                saveDB();
                io.to(socket.data.currentServer).emit("serverData", {
                    name: socket.data.currentServer,
                    channels: Object.keys(srv.channels),
                    roles: srv.roles,
                    rolePermissions: srv.rolePermissions,
                    isOwner: true
                });
            }
        } catch (err) {
            console.error(">> updateRolePermissions Error:", err);
        }
    });
    
    socket.on("deleteChannel", (channelName) => {
        try {
            const srv = SERVERS[socket.data.currentServer];
            if (!srv || !srv.channels[channelName]) return;
            
            const userRole = srv.userRoles[socket.data.username] || "";
            const userPermissions = srv.rolePermissions[userRole] || [];
            const isOwner = srv.owner === socket.data.username;
            
            if (isOwner || userPermissions.includes("manage_channels")) {
                delete srv.channels[channelName];
                saveDB();
                io.to(socket.data.currentServer).emit("serverData", {
                    name: socket.data.currentServer,
                    channels: Object.keys(srv.channels),
                    roles: srv.roles,
                    rolePermissions: srv.rolePermissions,
                    isOwner: isOwner
                });
            }
        } catch (err) {
            console.error(">> deleteChannel Error:", err);
        }
    });
    
    socket.on("banUser", ({ targetUsername }) => {
        try {
            const srv = SERVERS[socket.data.currentServer];
            if (!srv) return;
            
            const userRole = srv.userRoles[socket.data.username] || "";
            const userPermissions = srv.rolePermissions[userRole] || [];
            const isOwner = srv.owner === socket.data.username;
            
            if ((isOwner || userPermissions.includes("ban_users")) && targetUsername !== socket.data.username) {
                if (!srv.bannedUsers) srv.bannedUsers = [];
                if (!srv.bannedUsers.includes(targetUsername)) {
                    srv.bannedUsers.push(targetUsername);
                    saveDB();
                    socket.emit("banSuccess", targetUsername);
                }
            }
        } catch (err) {
            console.error(">> banUser Error:", err);
        }
    });

    // --- MESAJLAŞMA SİSTEMİ ---
    socket.on("selectChannel", (channelName) => {
        const srv = SERVERS[socket.data.currentServer];
        if(srv && srv.channels[channelName]) {
            socket.data.currentChannel = channelName;
            socket.emit("loadMessages", srv.channels[channelName]);
        }
    });

    socket.on("chat", (text) => {
        try {
            const srv = SERVERS[socket.data.currentServer];
            if(!srv || !socket.data.currentChannel) return;
            
            // Ban kontrolü
            if (srv.bannedUsers && srv.bannedUsers.includes(socket.data.username)) {
                return socket.emit("error", "Bu sunucudan yasaklandınız!");
            }

            // Cosmic-Bot Komut Kontrolü
            if (text.startsWith("!")) {
                handleBotCommand(socket, text, srv);
                return;
            }

            const role = srv.userRoles[socket.data.username];
            const userData = USERS[socket.data.username] || {};
            const isPulse = userData.pulse || false;
            const isPlus = userData.isPlus || false;
            
            // Resim link kontrolü - Daha gelişmiş regex
            const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|ico))(\?[^\s]*)?/gi;
            const hasImage = imageRegex.test(text);
            let imageUrl = null;
            if (hasImage) {
                const match = text.match(imageRegex);
                if (match && match.length > 0) {
                    imageUrl = match[0].trim();
                }
            }
            
            const msgObj = { 
                user: socket.data.username, 
                text, 
                roleColor: srv.roles[role] || userData.themeColor || "#ddd",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                pulse: isPulse,
                isPlus: isPlus,
                avatar: userData.avatar || null,
                imageUrl: imageUrl
            };
            
            srv.channels[socket.data.currentChannel].push(msgObj);
            saveDB();
            
            io.to(socket.data.currentServer).emit("message", { 
                ...msgObj, 
                channel: socket.data.currentChannel 
            });
        } catch (err) {
            console.error(">> chat Error:", err);
            socket.emit("error", "Mesaj gönderilirken bir hata oluştu!");
        }
    });

    // --- SOSYAL SİSTEM ---
    socket.on("sendFriendRequest", (target) => {
        if(USERS[target] && target !== socket.data.username) {
            if(!USERS[target].requests.includes(socket.data.username) && !USERS[target].friends.includes(socket.data.username)) {
                USERS[target].requests.push(socket.data.username);
                saveDB();
                io.emit("newFriendNotify", { to: target, from: socket.data.username });
            }
        }
    });

    socket.on("acceptFriend", (from) => {
        const me = socket.data.username;
        if(USERS[me] && USERS[me].requests.includes(from)) {
            if(!USERS[me].friends) USERS[me].friends = [];
            USERS[me].friends.push(from);
            if(!USERS[from].friends) USERS[from].friends = [];
            USERS[from].friends.push(me);
            USERS[me].requests = USERS[me].requests.filter(u => u !== from);
            saveDB();
            socket.emit("friendUpdate", { friends: USERS[me].friends, requests: USERS[me].requests });
        }
    });

    function updateMemberList(serverName) {
        try {
            const srv = SERVERS[serverName];
            if (srv) {
                const members = Array.from(srv.activeUsers).map(u => {
                    const userData = USERS[u] || {};
                    return {
                        name: u,
                        role: srv.userRoles[u] || "",
                        color: srv.roles[srv.userRoles[u]] || userData.themeColor || "#ddd",
                        pulse: userData.pulse || false,
                        isPlus: userData.isPlus || false,
                        avatar: userData.avatar || null,
                        isAdmin: userData.isAdmin || false
                    };
                });
                io.to(serverName).emit("memberListUpdate", members);
            }
        } catch (err) {
            console.error(">> updateMemberList Error:", err);
        }
    }
    
    // Pulse Sistemi
    socket.on("activatePulse", () => {
        try {
            if (!socket.data.auth) return;
            USERS[socket.data.username].pulse = true;
            saveDB();
            socket.emit("pulseActivated", true);
            if (socket.data.currentServer) {
                updateMemberList(socket.data.currentServer);
            }
        } catch (err) {
            console.error(">> activatePulse Error:", err);
        }
    });
    
    socket.on("updateAvatar", (avatarUrl) => {
        try {
            if (!socket.data.auth) return;
            const userData = USERS[socket.data.username];
            if (!userData) return;
            
            // Plus kullanıcıları GIF, normal kullanıcılar sadece statik
            if (userData.isPlus) {
                userData.avatar = avatarUrl; // GIF desteklenir
            } else {
                // Statik resim kontrolü (GIF değilse)
                if (avatarUrl && !avatarUrl.toLowerCase().endsWith('.gif')) {
                    userData.avatar = avatarUrl;
                } else {
                    return socket.emit("error", "GIF avatar sadece Engine Plus üyelerine özeldir!");
                }
            }
            saveDB();
            socket.emit("avatarUpdated", avatarUrl);
            if (socket.data.currentServer) {
                updateMemberList(socket.data.currentServer);
            }
        } catch (err) {
            console.error(">> updateAvatar Error:", err);
        }
    });
    
    // Profil Güncelleme
    socket.on("updateProfile", ({ bio, banner, themeColor }) => {
        try {
            if (!socket.data.auth) return;
            const userData = USERS[socket.data.username];
            if (!userData) return;
            
            if (bio !== undefined) userData.bio = bio;
            if (banner !== undefined && userData.isPlus) {
                userData.banner = banner; // Banner sadece Plus'a özel
            } else if (banner !== undefined && !userData.isPlus) {
                return socket.emit("error", "Banner sadece Engine Plus üyelerine özeldir!");
            }
            if (themeColor !== undefined) userData.themeColor = themeColor;
            
            saveDB();
            socket.emit("profileUpdated", { bio: userData.bio, banner: userData.banner, themeColor: userData.themeColor });
        } catch (err) {
            console.error(">> updateProfile Error:", err);
        }
    });
    
    // Admin İşlemleri
    socket.on("adminGivePlus", ({ targetUsername }) => {
        try {
            if (!socket.data.auth || !socket.data.isAdmin) {
                return socket.emit("error", "Bu işlem için admin yetkisi gereklidir!");
            }
            if (!USERS[targetUsername]) {
                return socket.emit("error", "Kullanıcı bulunamadı!");
            }
            USERS[targetUsername].isPlus = true;
            saveDB();
            socket.emit("adminSuccess", `${targetUsername} kullanıcısına Engine Plus verildi!`);
            // Kullanıcıya bildir
            io.emit("plusGranted", { username: targetUsername });
        } catch (err) {
            console.error(">> adminGivePlus Error:", err);
        }
    });
    
    socket.on("adminKickUser", ({ targetUsername, serverName }) => {
        try {
            if (!socket.data.auth || !socket.data.isAdmin) {
                return socket.emit("error", "Bu işlem için admin yetkisi gereklidir!");
            }
            if (!SERVERS[serverName]) {
                return socket.emit("error", "Sunucu bulunamadı!");
            }
            
            const srv = SERVERS[serverName];
            srv.activeUsers.delete(targetUsername);
            updateMemberList(serverName);
            
            // Kullanıcıyı sunucudan çıkar
            const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.username === targetUsername);
            if (targetSocket && targetSocket.data.currentServer === serverName) {
                targetSocket.leave(serverName);
                targetSocket.data.currentServer = null;
                targetSocket.emit("kickedFromServer", serverName);
            }
            
            socket.emit("adminSuccess", `${targetUsername} kullanıcısı ${serverName} sunucusundan atıldı!`);
        } catch (err) {
            console.error(">> adminKickUser Error:", err);
        }
    });
    
    socket.on("adminBanUser", ({ targetUsername }) => {
        try {
            if (!socket.data.auth || !socket.data.isAdmin) {
                return socket.emit("error", "Bu işlem için admin yetkisi gereklidir!");
            }
            if (!USERS[targetUsername]) {
                return socket.emit("error", "Kullanıcı bulunamadı!");
            }
            
            // Tüm sunuculardan banla
            Object.keys(SERVERS).forEach(sName => {
                if (!SERVERS[sName].bannedUsers) SERVERS[sName].bannedUsers = [];
                if (!SERVERS[sName].bannedUsers.includes(targetUsername)) {
                    SERVERS[sName].bannedUsers.push(targetUsername);
                }
            });
            
            saveDB();
            socket.emit("adminSuccess", `${targetUsername} kullanıcısı tüm sunuculardan yasaklandı!`);
        } catch (err) {
            console.error(">> adminBanUser Error:", err);
        }
    });

    // Cosmic-Bot Komut İşleyici
    function handleBotCommand(socket, text, srv) {
        try {
            const command = text.split(" ")[0].toLowerCase();
            const userData = USERS[socket.data.username] || {};
            
            if (command === "!zar") {
                const roll = Math.floor(Math.random() * 6) + 1;
                const botMsg = {
                    user: "CosmicBot",
                    text: `🎲 ${socket.data.username} zar attı: **${roll}**`,
                    roleColor: "#00ff00",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    pulse: false,
                    isPlus: false,
                    avatar: null,
                    imageUrl: null,
                    isBot: true
                };
                srv.channels[socket.data.currentChannel].push(botMsg);
                saveDB();
                io.to(socket.data.currentServer).emit("message", { ...botMsg, channel: socket.data.currentChannel });
            }
            
            else if (command === "!para") {
                const result = Math.random() < 0.5 ? "Yazı" : "Tura";
                const emoji = result === "Yazı" ? "🪙" : "🪙";
                const botMsg = {
                    user: "CosmicBot",
                    text: `${emoji} ${socket.data.username} para attı: **${result}**`,
                    roleColor: "#00ff00",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    pulse: false,
                    isPlus: false,
                    avatar: null,
                    imageUrl: null,
                    isBot: true
                };
                srv.channels[socket.data.currentChannel].push(botMsg);
                saveDB();
                io.to(socket.data.currentServer).emit("message", { ...botMsg, channel: socket.data.currentChannel });
            }
            
            else if (command === "!günlük") {
                const today = new Date().toDateString();
                if (userData.dailyClaimed === today) {
                    const botMsg = {
                        user: "CosmicBot",
                        text: `⏰ ${socket.data.username}, bugün zaten günlük ödülünü aldın! Yarın tekrar dene.`,
                        roleColor: "#ffaa00",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        pulse: false,
                        isPlus: false,
                        avatar: null,
                        imageUrl: null,
                        isBot: true
                    };
                    srv.channels[socket.data.currentChannel].push(botMsg);
                    saveDB();
                    io.to(socket.data.currentServer).emit("message", { ...botMsg, channel: socket.data.currentChannel });
                } else {
                    const credits = Math.floor(Math.random() * 100) + 50;
                    userData.credits = (userData.credits || 0) + credits;
                    userData.dailyClaimed = today;
                    saveDB();
                    
                    const botMsg = {
                        user: "CosmicBot",
                        text: `💰 ${socket.data.username} günlük ödülünü aldı! **+${credits} Cosmic Kredi** (Toplam: ${userData.credits})`,
                        roleColor: "#00ff00",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        pulse: false,
                        isPlus: false,
                        avatar: null,
                        imageUrl: null,
                        isBot: true
                    };
                    srv.channels[socket.data.currentChannel].push(botMsg);
                    saveDB();
                    io.to(socket.data.currentServer).emit("message", { ...botMsg, channel: socket.data.currentChannel });
                    socket.emit("creditsUpdated", userData.credits);
                }
            }
            
            else if (command === "!profil") {
                const joinDate = new Date(userData.joinDate || new Date()).toLocaleDateString('tr-TR');
                const botMsg = {
                    user: "CosmicBot",
                    text: `📋 **${socket.data.username} Profil Bilgileri**\n━━━━━━━━━━━━━━━━━━━━\n💰 Cosmic Kredi: **${userData.credits || 0}**\n📅 Kayıt Tarihi: **${joinDate}**\n${userData.bio ? `📝 Bio: ${userData.bio}\n` : ''}${userData.isPlus ? '⭐ Engine Plus Aktif\n' : ''}━━━━━━━━━━━━━━━━━━━━`,
                    roleColor: "#6f55f2",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    pulse: false,
                    isPlus: false,
                    avatar: null,
                    imageUrl: null,
                    isBot: true
                };
                srv.channels[socket.data.currentChannel].push(botMsg);
                saveDB();
                io.to(socket.data.currentServer).emit("message", { ...botMsg, channel: socket.data.currentChannel });
            }
        } catch (err) {
            console.error(">> handleBotCommand Error:", err);
        }
    }

    socket.on("disconnect", () => {
        if (socket.data.currentServer && SERVERS[socket.data.currentServer]) {
            SERVERS[socket.data.currentServer].activeUsers.delete(socket.data.username);
            updateMemberList(socket.data.currentServer);
        }
    });
});

server.listen(3000, () => {
    console.log(">> Cosmic Engine v3.3 - Evolution & Admin Edition");
    console.log(">> Admin Account: + / 2013");
    console.log(">> Cosmic-Bot Active: !zar, !para, !günlük, !profil");
    console.log(">> Server Live on Port 3000");
});