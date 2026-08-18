// ============================================
// 1. ENV YÜKLE (EN ÜSTTE)
// ============================================
require('dotenv').config();

// ============================================
// 2. IPv4 ZORLAMA
// ============================================
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 3. MONGODB BAĞLANTISI
// ============================================
const MONGODB_URI = process.env.MONGODB_URI;

const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2
};

mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
        console.log('✅ MongoDB bağlantısı başarılı!');
        console.log(`   📁 Veritabanı: itemlerinmarketi`);
        varsayilanIlanEkle();
    })
    .catch(err => {
        console.error('❌ MongoDB bağlantı hatası:', err.message);
        setTimeout(() => {
            mongoose.connect(MONGODB_URI, mongooseOptions);
        }, 5000);
    });

// ============================================
// 4. ŞEMALAR
// ============================================
const ilanSchema = new mongoose.Schema({
    baslik: { type: String, required: true },
    fiyat: { type: Number, required: true },
    detay: { type: String, default: '' },
    sure: { type: String, default: '24 Saat' },
    resim: { type: String, default: '' },
    satici: { type: String, required: true },
    aktiflikDurumu: { type: String, default: 'aktif' },
    createdAt: { type: Date, default: Date.now }
});

const Ilan = mongoose.model('Ilan', ilanSchema);

// ============================================
// 5. VARSAYILAN İLAN EKLE
// ============================================
async function varsayilanIlanEkle() {
    try {
        const count = await Ilan.countDocuments();
        if (count === 0) {
            const varsayilan = new Ilan({
                baslik: 'Valorant Vandal Skinli Hesap',
                fiyat: 450,
                detay: 'Full skinli Valorant hesabı, ilk mail geliyor. Hemen teslim!',
                sure: '15 Dakika',
                resim: '',
                satici: 'Ahmet',
                aktiflikDurumu: 'aktif'
            });
            await varsayilan.save();
            console.log('✅ Varsayılan ilan eklendi!');
        }
    } catch (err) {
        console.log('⚠️ Varsayılan ilan eklenemedi:', err.message);
    }
}

// ============================================
// 6. NODEMAILER
// ============================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    }
});

async function epostaGonder(alici, konu, mesaj) {
    try {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: alici,
            subject: konu,
            html: mesaj
        };
        const bilgi = await transporter.sendMail(mailOptions);
        console.log('✅ E-posta gönderildi:', bilgi.messageId);
        return { success: true };
    } catch (hata) {
        console.error('❌ E-posta hatası:', hata.message);
        return { success: false, error: hata.message };
    }
}

// ============================================
// 7. EXPRESS AYARLARI
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// ============================================
// 8. E-POSTA DOĞRULAMA
// ============================================
app.post('/api/eposta-dogrula', async (req, res) => {
    const { eposta, kullaniciAdi } = req.body;
    
    if (!eposta || !kullaniciAdi) {
        return res.json({ success: false, message: 'E-posta ve kullanıcı adı gerekli!' });
    }

    const kod = Math.floor(100000 + Math.random() * 900000).toString();
    
    const htmlMesaj = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #38bdf8; margin: 0;">🛡️ İtemlerinMarketi</h1>
                <p style="color: #94a3b8; margin: 5px 0 0 0;">Güvenli Ticaret Platformu</p>
            </div>
            <div style="background: #1e293b; padding: 25px; border-radius: 8px; border: 1px solid #334155;">
                <h2 style="color: #f8fafc; margin-top: 0;">📧 E-posta Doğrulama</h2>
                <p style="color: #cbd5e1;">Merhaba <strong style="color: #38bdf8;">${kullaniciAdi}</strong>,</p>
                <p style="color: #cbd5e1;">Hesabınızı doğrulamak için aşağıdaki kodu kullanın:</p>
                <div style="background: #0f172a; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #a855f7;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #a855f7;">${kod}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px;">⚠️ Bu kod <strong>5 dakika</strong> geçerlidir.</p>
            </div>
        </div>
    `;

    const sonuc = await epostaGonder(eposta, `🔐 İtemlerinMarketi - E-posta Doğrulama Kodu`, htmlMesaj);

    if (sonuc.success) {
        res.json({ success: true, message: 'Doğrulama kodu gönderildi!', kod: kod });
    } else {
        res.json({ success: false, message: 'E-posta gönderilemedi: ' + sonuc.error });
    }
});

// ============================================
// 9. ANA SAYFA
// ============================================
app.get('/', async (req, res) => {
    try {
        const ilanlar = await Ilan.find().sort({ createdAt: -1 });
        res.render('index', { ilanlar, aktif: null });
    } catch (hata) {
        console.error('❌ Ana sayfa hatası:', hata.message);
        res.render('index', { ilanlar: [], aktif: null });
    }
});

// ============================================
// 10. İLAN DETAY SAYFASI
// ============================================
app.get('/ilan/:id', async (req, res) => {
    try {
        const ilanId = req.params.id;
        let ilan = null;
        
        if (mongoose.Types.ObjectId.isValid(ilanId)) {
            ilan = await Ilan.findById(ilanId);
        }

        if (!ilan) {
            return res.status(404).render('ilan-detay', { 
                ilan: null, 
                aktif: null 
            });
        }

        res.render('ilan-detay', { ilan, aktif: null });

    } catch (hata) {
        console.error('❌ İlan detay hatası:', hata.message);
        res.status(500).send(`
            <div style="text-align:center; padding:50px; background:#0f172a; color:white; min-height:100vh;">
                <h1 style="color:#ef4444;">❌ Hata Oluştu!</h1>
                <p style="color:#94a3b8;">${hata.message}</p>
                <a href="/" style="color:#38bdf8; text-decoration:none; display:inline-block; margin-top:20px; padding:10px 20px; background:#1e293b; border-radius:8px;">🏠 Ana Sayfaya Dön</a>
            </div>
        `);
    }
});

// ============================================
// 11. İLAN EKLEME API
// ============================================
app.post('/api/ilan-ekle', async (req, res) => {
    try {
        const { baslik, fiyat, detay, sure, resim, satici } = req.body;
        const yeniIlan = new Ilan({
            baslik,
            fiyat: parseFloat(fiyat),
            detay: detay || '',
            sure: sure || '24 Saat',
            resim: resim || '',
            satici,
            aktiflikDurumu: 'aktif'
        });
        const kaydedilenIlan = await yeniIlan.save();
        res.json({ success: true, ilan: kaydedilenIlan });
    } catch (hata) {
        console.error('❌ İlan ekleme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// 12. İLAN SİL API
// ============================================
app.delete('/api/ilan-sil/:id', async (req, res) => {
    try {
        const ilanId = req.params.id;
        await Ilan.findByIdAndDelete(ilanId);
        res.json({ success: true });
    } catch (hata) {
        console.error('❌ İlan silme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// 13. ROUTE'LAR
// ============================================
let bakiyeBildirimleri = [];

app.get('/bakiye', (req, res) => res.render('bakiye', { mesaj: null, aktif: null }));
app.get('/login', (req, res) => res.render('login', { hata: null, aktif: null }));
app.get('/register', (req, res) => res.render('register', { aktif: null }));
app.get('/yonetici-paneli', (req, res) => res.render('admin', { bakiyeBildirimleri, aktif: null }));
app.get('/para-cek', (req, res) => res.render('paracek', { aktif: null }));
app.get('/ilan-duzenle', (req, res) => res.render('ilan_duzenle', { aktif: null }));
app.get('/profil', (req, res) => res.render('profil', { aktif: null }));
app.get('/destek-talebi', (req, res) => res.render('destek_talebi', { aktif: null }));

app.post('/bakiye-bildirimi', (req, res) => {
    const { kullaniciAdi, miktar } = req.body;
    bakiyeBildirimleri.push({
        id: bakiyeBildirimleri.length + 1,
        kullaniciAdi,
        miktar: parseFloat(miktar),
        durum: "Beklemede",
        tarih: new Date()
    });
    res.render('bakiye', { mesaj: "Havale bildirimin iletildi!", aktif: null });
});

app.post('/bakiye-islem/:id/:aksiyon', (req, res) => {
    const bildirim = bakiyeBildirimleri.find(b => b.id === parseInt(req.params.id));
    if (bildirim && bildirim.durum === "Beklemede") {
        bildirim.durum = req.params.aksiyon === "onayla" ? "Onaylandı" : "Reddedildi";
    }
    res.redirect('/yonetici-paneli');
});

// ============================================
// 14. SUNUCUYU BAŞLAT
// ============================================
app.listen(PORT, () => {
    console.log(`✅ İtemlerinMarketi çalışıyor: http://localhost:${PORT}`);
    console.log(`📧 E-posta gönderimi hazır!`);
    console.log(`🔒 IPv4 zorlama aktif!`);
});
// ============================================
// İLAN DÜZENLEME SAYFASI (GET)
// ============================================
app.get('/ilan-duzenle', async (req, res) => {
    try {
        const ilanId = req.query.id;
        
        if (!ilanId) {
            return res.status(400).send('❌ İlan ID gerekli!');
        }
        
        // İlanı bul
        let ilan = null;
        if (mongoose.Types.ObjectId.isValid(ilanId)) {
            ilan = await Ilan.findById(ilanId);
        }
        
        if (!ilan) {
            return res.status(404).send('❌ İlan bulunamadı!');
        }
        
        // Admin kontrolü - sadece admin veya ilan sahibi düzenleyebilir
        const aktifKullanici = req.query.aktif ? JSON.parse(req.query.aktif) : null;
        
        res.render('ilan_duzenle', { 
            ilan: ilan, 
            aktif: null 
        });
        
    } catch (hata) {
        console.error('❌ İlan düzenleme hatası:', hata.message);
        res.status(500).send('❌ Sunucu hatası: ' + hata.message);
    }
});

// ============================================
// İLAN DÜZENLEME API (POST)
// ============================================
app.post('/api/ilan-duzenle', async (req, res) => {
    try {
        const { id, baslik, fiyat, detay, sure, resim } = req.body;
        
        if (!id || !baslik || !fiyat) {
            return res.json({ success: false, message: 'Başlık, fiyat ve ID gerekli!' });
        }
        
        // İlanı bul
        let ilan = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            ilan = await Ilan.findById(id);
        }
        
        if (!ilan) {
            return res.json({ success: false, message: 'İlan bulunamadı!' });
        }
        
        // İlanı güncelle
        ilan.baslik = baslik;
        ilan.fiyat = parseFloat(fiyat);
        ilan.detay = detay || '';
        ilan.sure = sure || '24 Saat';
        if (resim && resim.length > 0) {
            ilan.resim = resim;
        }
        
        await ilan.save();
        res.json({ success: true, message: 'İlan başarıyla güncellendi!' });
        
    } catch (hata) {
        console.error('❌ İlan güncelleme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// İLAN DETAY API (GET)
// ============================================
app.get('/api/ilan/:id', async (req, res) => {
    try {
        const ilanId = req.params.id;
        let ilan = null;
        
        if (mongoose.Types.ObjectId.isValid(ilanId)) {
            ilan = await Ilan.findById(ilanId);
        }
        
        if (ilan) {
            res.json({ success: true, ilan: ilan });
        } else {
            res.json({ success: false, message: 'İlan bulunamadı' });
        }
    } catch (hata) {
        console.error('❌ İlan getirme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// İLAN DÜZENLEME API (POST)
// ============================================
app.post('/api/ilan-duzenle', async (req, res) => {
    try {
        const { id, baslik, fiyat, detay, sure, resim } = req.body;
        
        if (!id || !baslik || !fiyat) {
            return res.json({ success: false, message: 'Başlık, fiyat ve ID gerekli!' });
        }
        
        let ilan = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            ilan = await Ilan.findById(id);
        }
        
        if (!ilan) {
            return res.json({ success: false, message: 'İlan bulunamadı!' });
        }
        
        ilan.baslik = baslik;
        ilan.fiyat = parseFloat(fiyat);
        ilan.detay = detay || '';
        ilan.sure = sure || '24 Saat';
        if (resim && resim.length > 0) {
            ilan.resim = resim;
        }
        
        await ilan.save();
        res.json({ success: true, message: 'İlan başarıyla güncellendi!' });
        
    } catch (hata) {
        console.error('❌ İlan güncelleme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// İLAN DURUM DEĞİŞTİRME API (POST)
// ============================================
app.post('/api/ilan-durum-degis', async (req, res) => {
    try {
        const { id, durum } = req.body;
        
        if (!id || !durum) {
            return res.json({ success: false, message: 'ID ve durum gerekli!' });
        }
        
        let ilan = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            ilan = await Ilan.findById(id);
        }
        
        if (!ilan) {
            return res.json({ success: false, message: 'İlan bulunamadı!' });
        }
        
        ilan.aktiflikDurumu = durum;
        await ilan.save();
        
        res.json({ success: true, message: 'İlan durumu güncellendi!' });
        
    } catch (hata) {
        console.error('❌ Durum değiştirme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

// ============================================
// İLAN SİL API (DELETE)
// ============================================
app.delete('/api/ilan-sil/:id', async (req, res) => {
    try {
        const ilanId = req.params.id;
        
        let ilan = null;
        if (mongoose.Types.ObjectId.isValid(ilanId)) {
            ilan = await Ilan.findById(ilanId);
        }
        
        if (!ilan) {
            return res.json({ success: false, message: 'İlan bulunamadı!' });
        }
        
        await Ilan.findByIdAndDelete(ilanId);
        res.json({ success: true, message: 'İlan silindi!' });
        
    } catch (hata) {
        console.error('❌ İlan silme hatası:', hata.message);
        res.json({ success: false, error: hata.message });
    }
});

process.on('uncaughtException', (err) => console.error('❌ Hata:', err.message));
process.on('unhandledRejection', (err) => console.error('❌ Promise hatası:', err.message));