const jwt = require('jsonwebtoken');
const secret = 'local_dev_jwt_secret_key_change_in_production';

// generate token for merchant id
const token = jwt.sign({
    merchantId: '1b6403b4-85d8-4e42-b202-c16008b907aa',
    role: 'merchant'
}, secret, { expiresIn: '1h' });

async function run() {
    try {
        const res = await fetch('http://localhost:3001/api/customers', {
            method: 'POST',
            body: JSON.stringify({
                fullName: 'سعد hglmsC',
                nationalId: '1234567899',
                mobileNumber: '0534343434'
            }),
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        console.log(res.status, data);
    } catch (e) {
        console.log(e);
    }
}
run();
