async function test() {
    try {
        console.log('Sending test SMS to localhost:4000...');
        const res = await fetch('http://localhost:4000/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '905318942261', message: 'NetGSM Entegrasyon Test Mesaji' }) // Added 90 prefix
        });
        if (!res.ok) {
            console.error('HTTP Error:', res.status, res.statusText);
            const text = await res.text();
            console.error('Response:', text);
        } else {
            const data = await res.json();
            console.log('API Response Success:', data.success);
            if (data.error) console.log('Error:', data.error);
            if (data.params) {
                console.log('--- Params ---');
                data.params.split('&').forEach(p => console.log(p));
                console.log('--------------');
            }
            if (data.debugUrl) console.log('Debug URL:', data.debugUrl);
            if (data.apiResponse) console.log('NetGSM Raw:', data.apiResponse);
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}
test();
