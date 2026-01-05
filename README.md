# 🚀 Cosmic Chat Engine v3.3 - Evolution & Admin Edition

Modern, gerçek zamanlı chat uygulaması. Node.js, Express, Socket.io ve Vanilla JavaScript ile geliştirilmiştir.

## ✨ Özellikler

### 🎨 Modern UI/UX
- **Neon-Glassmorphism v2** tasarım dili
- Yumuşak animasyonlar ve geçiş efektleri
- Responsive ve kullanıcı dostu arayüz
- Özelleştirilebilir tema renkleri

### 👑 Admin Sistemi
- **Özel Admin Hesabı**: Kullanıcı adı ``, Şifre ``
- **Tanrı Modu** yetkileri
- Sağ tıklama menüsü ile hızlı işlemler
- Engine Plus verme
- Kullanıcı yasaklama (ban)
- Sunucudan atma (kick)

### ⭐ Engine Plus (Premium)
- Gökkuşağı animasyonlu kullanıcı adları
- Özel Pulse rozeti
- GIF profil resmi desteği
- Özel profil banner'ı
- Premium görsel efektler

### 🤖 Cosmic-Bot
Chat içerisinde çalışan oyun botu:
- `!zar` - Rastgele zar atar (1-6)
- `!para` - Yazı mı tura mı?
- `!günlük` - Her gün rastgele Cosmic Kredi kazan
- `!profil` - Profil bilgilerini göster

### 🔐 Gelişmiş Rol & Yetki Sistemi
- Rol bazlı izinler
- Kanal yönetimi (ekleme/silme)
- Üye yönetimi (rol atama)
- Kullanıcı yasaklama
- Renk özelleştirme

### 💬 Zengin İçerik Desteği
- Otomatik resim render (jpg, png, gif, webp, svg, bmp, ico)
- Mesaj geçmişi saklama
- Gerçek zamanlı mesajlaşma

### 👥 Sosyal Özellikler
- Arkadaşlık sistemi
- Arkadaşlık istekleri
- Üye listesi görüntüleme

### ⚙️ Profil Özelleştirme
- Bio (Hakkında) düzenleme
- Avatar URL (Plus: GIF, Normal: Statik)
- Banner URL (Sadece Plus)
- Tema rengi seçimi

## 📦 Kurulum

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın:**
```bash
git clone <repository-url>
cd Chat1
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Sunucuyu başlatın:**
```bash
node server/server.js
```

4. **Tarayıcıda açın:**
```
http://localhost:3000
```

## 🎮 Kullanım

### İlk Giriş
1. Herhangi bir kullanıcı adı ve şifre ile giriş yapın (otomatik kayıt)
2. Admin hesabı: `+` / `2013`

### Sunucu Oluşturma
1. Sol sidebar'daki `+` butonuna tıklayın
2. Sunucu adını girin
3. "Sunucu Oluştur" butonuna tıklayın

### Kanal Yönetimi
- Sunucu sahipleri kanal ekleyebilir/silebilir
- Kanal listesindeki `X` ikonu ile kanal silme

### Rol Oluşturma
1. Sunucu ayarları (⚙️) butonuna tıklayın
2. Rol adı ve rengi seçin
3. İzinleri seçin (checkbox'lar)
4. "Rolü Kaydet" butonuna tıklayın

### Cosmic-Bot Komutları
Chat içerisinde şu komutları kullanabilirsiniz:
- `!zar` - Zar at
- `!para` - Para at
- `!günlük` - Günlük ödül al
- `!profil` - Profil bilgilerini göster

### Admin İşlemleri
Admin hesabı ile giriş yaptıktan sonra:
- Sağ üstte "👑 TANRI MODU" rozeti görünür
- Üye listesinde kullanıcılara sağ tıklayarak menü açılır
- Admin panelinden toplu işlemler yapılabilir

### Profil Düzenleme
1. Sol sidebar'daki "Profil Ayarları" butonuna tıklayın
2. Bio, Avatar, Banner ve Tema rengini düzenleyin
3. "Kaydet" butonuna tıklayın

## 📁 Dosya Yapısı

```
Chat1/
├── server/
│   ├── server.js          # Ana sunucu dosyası
│   └── database.json      # Veritabanı (otomatik oluşturulur)
├── public/
│   ├── index.html         # Ana HTML dosyası
│   ├── script.js          # Client-side JavaScript
│   └── style.css          # Stil dosyası
├── package.json           # NPM bağımlılıkları
└── README.md             # Bu dosya
```

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Veritabanı**: JSON dosyası (database.json)

### Socket Events

#### Client → Server
- `login` - Giriş yap
- `chat` - Mesaj gönder
- `createServer` - Sunucu oluştur
- `createChannel` - Kanal oluştur
- `createRole` - Rol oluştur
- `assignRole` - Rol ata
- `banUser` - Kullanıcı yasakla
- `deleteChannel` - Kanal sil
- `updateProfile` - Profil güncelle
- `adminGivePlus` - Plus ver (Admin)
- `adminKickUser` - Kullanıcı at (Admin)
- `adminBanUser` - Kullanıcı yasakla (Admin)

#### Server → Client
- `loginSuccess` - Giriş başarılı
- `authError` - Giriş hatası
- `message` - Yeni mesaj
- `serverData` - Sunucu verisi
- `memberListUpdate` - Üye listesi güncelleme
- `error` - Hata mesajı
- `adminSuccess` - Admin işlemi başarılı

## 🎯 Özellikler Detayı

### Engine Plus vs Normal
| Özellik | Normal | Engine Plus |
|---------|--------|-------------|
| Avatar | Statik (jpg, png) | GIF destekli |
| Banner | ❌ | ✅ |
| İsim Animasyonu | Standart | Gökkuşağı |
| Rozet | ❌ | ⭐ Pulse |

### Yetki Seviyeleri
1. **Normal Kullanıcı**: Temel mesajlaşma
2. **Rol Sahibi**: Rol bazlı izinler
3. **Sunucu Sahibi**: Tam kontrol
4. **Admin (Tanrı Modu)**: Tüm sunucularda tam yetki

## 🐛 Bilinen Sorunlar
- Yok (şu an için)

## 🔮 Gelecek Özellikler
- Sesli mesaj desteği
- Dosya paylaşımı
- Özel mesajlaşma (DM)
- Sunucu şablonları
- Daha fazla bot komutu

## 📝 Lisans
Bu proje eğitim amaçlı geliştirilmiştir.

## 👨‍💻 Geliştirici
Cosmic Chat Engine - v3.3 Evolution & Admin Edition

## 🙏 Teşekkürler
- Socket.io ekibine
- Tüm açık kaynak topluluğuna

---

**Not**: Admin hesabı (`+` / `2013`) güvenlik açısından production ortamında değiştirilmelidir.
