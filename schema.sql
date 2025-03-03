CREATE DATABASE mtu_pasaport;
USE mtu_pasaport;

-- Kullanıcılar tablosu
CREATE TABLE kullanicilar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tc_no VARCHAR(11) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    sifre VARCHAR(255) NOT NULL,
    ad_soyad VARCHAR(100) NOT NULL,
    telefon VARCHAR(15) NOT NULL,
    kadro_derecesi VARCHAR(50),
    kadro_unvani VARCHAR(100),
    kurum_sicil_no VARCHAR(50),
    yetki_seviyesi ENUM('kullanici', 'admin') DEFAULT 'kullanici',
    son_giris_tarihi DATETIME,
    hesap_durumu ENUM('Aktif', 'Pasif') DEFAULT 'Aktif',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Başvurular tablosu
CREATE TABLE basvurular (
    id INT AUTO_INCREMENT PRIMARY KEY,
    basvuru_no VARCHAR(20) UNIQUE NOT NULL,
    tc_no VARCHAR(11) NOT NULL,
    pasaport_turu ENUM('hususi', 'hizmet') NOT NULL,
    nufus_mudurlugu VARCHAR(100) NOT NULL,
    kimlik_fotokopisi_path VARCHAR(255) NOT NULL,
    es_kimlik_fotokopisi_path VARCHAR(255) NOT NULL,
    cocuk_kimlik1_path VARCHAR(255),
    cocuk_kimlik2_path VARCHAR(255),
    cocuk_sayisi INT NOT NULL DEFAULT 0,
    basvuru_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    durum ENUM('Beklemede', 'Onaylandı', 'Reddedildi') DEFAULT 'Beklemede',
    gerekce TEXT,
    degerlendirilme_tarihi DATETIME,
    degerlendiren_admin_id INT,
    FOREIGN KEY (tc_no) REFERENCES kullanicilar(tc_no),
    FOREIGN KEY (degerlendiren_admin_id) REFERENCES kullanicilar(id)
);

-- Başvuru dosyaları tablosu
CREATE TABLE basvuru_dosyalari (
    id INT AUTO_INCREMENT PRIMARY KEY,
    basvuru_id INT NOT NULL,
    dosya_turu ENUM('kimlik', 'es_kimlik', 'cocuk1_kimlik', 'cocuk2_kimlik') NOT NULL,
    dosya_adi VARCHAR(255) NOT NULL,
    dosya_path VARCHAR(255) NOT NULL,
    yukleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (basvuru_id) REFERENCES basvurular(id)
);

-- Başvuru log tablosu
CREATE TABLE basvuru_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    basvuru_id INT NOT NULL,
    islem_tipi ENUM('Oluşturuldu', 'Güncellendi', 'Onaylandı', 'Reddedildi', 'Görüntülendi') NOT NULL,
    islem_yapan_id INT NOT NULL,
    islem_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    aciklama TEXT,
    ip_adresi VARCHAR(45),
    FOREIGN KEY (basvuru_id) REFERENCES basvurular(id),
    FOREIGN KEY (islem_yapan_id) REFERENCES kullanicilar(id)
);

-- Bildirimler tablosu
CREATE TABLE bildirimler (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kullanici_id INT NOT NULL,
    basvuru_id INT NOT NULL,
    bildirim_tipi ENUM('Onay', 'Red', 'Güncelleme') NOT NULL,
    mesaj TEXT NOT NULL,
    okundu BOOLEAN DEFAULT FALSE,
    olusturulma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (basvuru_id) REFERENCES basvurular(id)
);

-- Örnek admin kullanıcısı oluşturma
INSERT INTO kullanicilar (
    tc_no, 
    email, 
    sifre, 
    ad_soyad, 
    telefon,
    kadro_derecesi,
    kadro_unvani,
    kurum_sicil_no,
    yetki_seviyesi
) VALUES (
    '11111111111', 
    'admin@mtu.edu.tr', 
    'hashedpassword', -- Gerçek uygulamada hash'lenmiş şifre kullanılmalı
    'Admin Kullanıcı',
    '5551112233',
    '1',
    'Sistem Yöneticisi',
    'ADM001',
    'admin'
);

-- İndeksler
CREATE INDEX idx_basvuru_durum ON basvurular(durum);
CREATE INDEX idx_basvuru_tarihi ON basvurular(basvuru_tarihi);
CREATE INDEX idx_bildirim_okundu ON bildirimler(okundu);
CREATE INDEX idx_log_tarih ON basvuru_log(islem_tarihi);

-- Görünümler (Views)
CREATE VIEW aktif_basvurular AS
SELECT 
    b.basvuru_no,
    k.ad_soyad,
    k.tc_no,
    b.pasaport_turu,
    b.basvuru_tarihi,
    b.durum
FROM basvurular b
JOIN kullanicilar k ON b.tc_no = k.tc_no
WHERE b.durum = 'Beklemede';

CREATE VIEW onaylanan_basvurular AS
SELECT 
    b.basvuru_no,
    k.ad_soyad,
    k.tc_no,
    b.pasaport_turu,
    b.degerlendirilme_tarihi,
    a.ad_soyad as onaylayan_admin
FROM basvurular b
JOIN kullanicilar k ON b.tc_no = k.tc_no
JOIN kullanicilar a ON b.degerlendiren_admin_id = a.id
WHERE b.durum = 'Onaylandı';

-- Stored Procedure: Başvuru Durumu Güncelleme
DELIMITER //
CREATE PROCEDURE UpdateBasvuruDurumu(
    IN p_basvuru_id INT,
    IN p_durum ENUM('Beklemede', 'Onaylandı', 'Reddedildi'),
    IN p_admin_id INT,
    IN p_gerekce TEXT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Güncelleme işlemi başarısız';
    END;

    START TRANSACTION;
    
    -- Başvuru durumunu güncelle
    UPDATE basvurular 
    SET durum = p_durum,
        degerlendirilme_tarihi = NOW(),
        degerlendiren_admin_id = p_admin_id,
        gerekce = p_gerekce
    WHERE id = p_basvuru_id;
    
    -- Log kaydı oluştur
    INSERT INTO basvuru_log (
        basvuru_id, 
        islem_tipi, 
        islem_yapan_id, 
        aciklama
    ) VALUES (
        p_basvuru_id,
        CASE 
            WHEN p_durum = 'Onaylandı' THEN 'Onaylandı'
            WHEN p_durum = 'Reddedildi' THEN 'Reddedildi'
            ELSE 'Güncellendi'
        END,
        p_admin_id,
        p_gerekce
    );
    
    -- Bildirim oluştur
    INSERT INTO bildirimler (
        kullanici_id,
        basvuru_id,
        bildirim_tipi,
        mesaj
    )
    SELECT 
        k.id,
        p_basvuru_id,
        CASE 
            WHEN p_durum = 'Onaylandı' THEN 'Onay'
            WHEN p_durum = 'Reddedildi' THEN 'Red'
            ELSE 'Güncelleme'
        END,
        CONCAT('Başvurunuz ', LOWER(p_durum), ' durumuna güncellendi.')
    FROM basvurular b
    JOIN kullanicilar k ON b.tc_no = k.tc_no
    WHERE b.id = p_basvuru_id;
    
    COMMIT;
END //
DELIMITER ;

-- Trigger: Başvuru Numarası Oluşturma
DELIMITER //
CREATE TRIGGER before_basvuru_insert
BEFORE INSERT ON basvurular
FOR EACH ROW
BEGIN
    SET NEW.basvuru_no = CONCAT(
        'MTU',
        DATE_FORMAT(NOW(), '%Y%m'),
        LPAD((SELECT COUNT(*) + 1 FROM basvurular), 4, '0')
    );
END //
DELIMITER ; 