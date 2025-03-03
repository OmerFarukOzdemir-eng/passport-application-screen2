document.addEventListener('DOMContentLoaded', function() {
    // Red butonlarına tıklama işlevi
    document.querySelectorAll('.red-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.basvuru-card');
            const redForm = card.querySelector('.red-form');
            redForm.style.display = 'flex';
        });
    });

    // Red iptal butonlarına tıklama işlevi
    document.querySelectorAll('.red-iptal-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const redForm = this.closest('.red-form');
            redForm.style.display = 'none';
        });
    });

    // Onay butonlarına tıklama işlevi
    document.querySelectorAll('.onay-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const basvuruNo = this.closest('.basvuru-card')
                                 .querySelector('.basvuru-header h3')
                                 .textContent.split('#')[1];
            onaylaBasvuru(basvuruNo);
        });
    });

    // Detay butonlarına tıklama işlevi
    document.querySelectorAll('.detay-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const basvuruNo = this.closest('.basvuru-card')
                                 .querySelector('.basvuru-header h3')
                                 .textContent.split('#')[1];
            gosterBasvuruDetay(basvuruNo);
        });
    });
});

function onaylaBasvuru(basvuruNo) {
    if(confirm('Bu başvuruyu onaylamak istediğinize emin misiniz?')) {
        // API çağrısı yapılacak
        console.log(`Başvuru #${basvuruNo} onaylandı`);
    }
}

function gosterBasvuruDetay(basvuruNo) {
    const modal = document.getElementById('basvuruDetayModal');
    modal.style.display = 'block';
    
    // API'den başvuru detayları çekilecek ve modal içeriği doldurulacak
}

// Modal kapatma
document.querySelector('.close').addEventListener('click', function() {
    document.getElementById('basvuruDetayModal').style.display = 'none';
}); 