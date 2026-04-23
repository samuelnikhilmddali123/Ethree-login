async function debugLogin() {
    try {
        console.log('Attempting login on 127.0.0.1:5000 (No device_info)...');
        const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emp_no: 'EMP001',
                password: 'password123'
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response Body:', text);
    } catch (error) {
        console.error('Fetch Error:', error.message);
    }
}

debugLogin();
