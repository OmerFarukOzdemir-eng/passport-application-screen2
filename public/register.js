document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const tcNo = document.getElementById('tcNo').value;
    const telefon = document.getElementById('telefon').value;
    const email = document.getElementById('email').value;
    
    // TC Kimlik kontrolü
    if (!validateTCKN(tcNo)) {
        alert('Geçerli bir TC Kimlik numarası giriniz');
        return;
    }
    
    // Telefon format kontrolü
    if (!telefon.match(/^[0-9]{10}$/)) {
        alert('Geçerli bir telefon numarası giriniz (5XX XXX XXXX)');
        return;
    }
    
    // Email kontrolü
    if (!email.endsWith('@mtu.edu.tr')) {
        alert('Lütfen MTÜ mail adresinizi giriniz');
        return;
    }
    
    // Şifre kontrolü
    if (password.length < 6) {
        alert('Şifre en az 6 karakter olmalıdır');
        return;
    }
    
    if (password !== passwordConfirm) {
        alert('Parolalar eşleşmiyor!');
        return;
    }
    
    const formData = {
        tcNo: tcNo,
        adSoyad: document.getElementById('adSoyad').value,
        email: email,
        telefon: telefon,
        password: password
    };
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Hesabınız başarıyla oluşturuldu. Giriş yapabilirsiniz.');
            window.location.href = '/login.html';
        } else {
            alert(data.error || 'Kayıt başarısız');
        }
    } catch (err) {
        alert('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
});

// TC Kimlik Numarası doğrulama
function validateTCKN(tcno) {
    if (tcno.length !== 11) return false;
    
    let total = 0;
    for (let i = 0; i < 10; i++) {
        total += Number(tcno.charAt(i));
    }
    return total % 10 === Number(tcno.charAt(10));
}

// Input validasyonları
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        if (this.checkValidity()) {
            this.parentElement.classList.add('valid');
            this.parentElement.classList.remove('invalid');
        } else {
            this.parentElement.classList.add('invalid');
            this.parentElement.classList.remove('valid');
        }
    });
});

// Şifre gücü kontrolü
document.getElementById('password').addEventListener('input', function() {
    const password = this.value;
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^A-Za-z0-9]/)) strength++;
    
    const strengthBar = this.parentElement.querySelector('.password-strength-bar');
    if (strengthBar) {
        strengthBar.className = 'password-strength-bar';
        if (strength >= 4) strengthBar.classList.add('strength-strong');
        else if (strength >= 2) strengthBar.classList.add('strength-medium');
        else strengthBar.classList.add('strength-weak');
    }
}); 