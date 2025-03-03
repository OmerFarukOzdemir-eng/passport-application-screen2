document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Token'ı localStorage'a kaydet
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Kullanıcı tipine göre yönlendirme
            if (data.user.yetki_seviyesi === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/index.html';
            }
        } else {
            // Hata mesajını göster
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = data.error;
            
            // Varsa önceki hata mesajını kaldır
            const existingError = document.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
            
            // Hata mesajını forma ekle
            const form = document.getElementById('loginForm');
            form.insertBefore(errorDiv, form.firstChild);
        }
    } catch (err) {
        alert('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
}); 