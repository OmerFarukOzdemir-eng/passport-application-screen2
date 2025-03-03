const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Dosya yükleme konfigürasyonu
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        if(file.mimetype !== 'application/pdf') {
            return cb(new Error('Sadece PDF dosyaları yüklenebilir!'));
        }
        cb(null, true);
    }
});

// Veritabanı bağlantısı
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'mtu_pasaport',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware - Token doğrulama
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Token gerekli' });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz token' });
        req.user = user;
        next();
    });
};

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Kullanıcıyı veritabanında ara
        const [users] = await db.promise().query(
            'SELECT * FROM kullanicilar WHERE email = ?',
            [email]
        );
        
        // Kullanıcı bulunamadıysa
        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.' 
            });
        }

        const user = users[0];
        
        // Şifre kontrolü
        const validPassword = await bcrypt.compare(password, user.sifre);
        if (!validPassword) {
            return res.status(401).json({ error: 'Hatalı şifre!' });
        }
        
        // Son giriş tarihini güncelle
        await db.promise().query(
            'UPDATE kullanicilar SET son_giris_tarihi = NOW() WHERE id = ?',
            [user.id]
        );
        
        // JWT token oluştur
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                yetki_seviyesi: user.yetki_seviyesi 
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Hassas bilgileri kullanıcı objesinden çıkar
        delete user.sifre;
        
        res.json({ 
            success: true,
            token, 
            user
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// Başvuru oluşturma endpoint'i
app.post('/api/basvuru', authenticateToken, upload.fields([
    { name: 'kimlikFoto', maxCount: 1 },
    { name: 'kimlikFotoEs', maxCount: 1 },
    { name: 'cocukKimlik1', maxCount: 1 },
    { name: 'cocukKimlik2', maxCount: 1 }
]), async (req, res) => {
    const basvuruNo = generateBasvuruNo();
    const files = req.files;
    
    try {
        await db.promise().query('START TRANSACTION');
        
        // Başvuru kaydı
        const [result] = await db.promise().query(
            `INSERT INTO basvurular SET ?`,
            {
                basvuru_no: basvuruNo,
                tc_no: req.user.tc_no,
                // ... diğer alanlar
            }
        );
        
        // Dosya kayıtları
        for (const [key, file] of Object.entries(files)) {
            await db.promise().query(
                `INSERT INTO basvuru_dosyalari SET ?`,
                {
                    basvuru_id: result.insertId,
                    dosya_turu: key,
                    dosya_adi: file[0].originalname,
                    dosya_path: file[0].path
                }
            );
        }
        
        await db.promise().query('COMMIT');
        res.json({ success: true, basvuruNo });
    } catch (err) {
        await db.promise().query('ROLLBACK');
        res.status(500).json({ error: 'Başvuru kaydedilemedi' });
    }
});

// Admin başvuru listesi endpoint'i
app.get('/api/admin/basvurular', authenticateToken, async (req, res) => {
    if (req.user.yetki !== 'admin') {
        return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    try {
        const [basvurular] = await db.promise().query(
            `SELECT * FROM aktif_basvurular`
        );
        res.json(basvurular);
    } catch (err) {
        res.status(500).json({ error: 'Başvurular getirilemedi' });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { tcNo, adSoyad, email, telefon, password } = req.body;
    
    try {
        // E-posta kontrolü
        if (!email.endsWith('@mtu.edu.tr')) {
            return res.status(400).json({ error: 'Geçersiz e-posta adresi. Sadece @mtu.edu.tr uzantılı adresler kabul edilmektedir.' });
        }
        
        // TC No ve email benzersizlik kontrolü
        const [existingUser] = await db.promise().query(
            'SELECT * FROM kullanicilar WHERE email = ? OR tc_no = ?',
            [email, tcNo]
        );
        
        if (existingUser.length > 0) {
            if (existingUser[0].email === email) {
                return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
            }
            if (existingUser[0].tc_no === tcNo) {
                return res.status(400).json({ error: 'Bu TC Kimlik numarası zaten kayıtlı.' });
            }
        }
        
        // Şifre hashleme
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Kullanıcı kaydı
        const [result] = await db.promise().query(
            'INSERT INTO kullanicilar SET ?',
            {
                tc_no: tcNo,
                email,
                sifre: hashedPassword,
                ad_soyad: adSoyad,
                telefon,
                yetki_seviyesi: 'kullanici',
                hesap_durumu: 'Aktif',
                created_at: new Date()
            }
        );
        
        res.json({ 
            success: true, 
            message: 'Hesabınız başarıyla oluşturuldu. Giriş yapabilirsiniz.',
            userId: result.insertId
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Kayıt işlemi sırasında bir hata oluştu.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 