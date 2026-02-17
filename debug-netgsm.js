const https = require('https');

const usercode = "3129116404";
const password = "5*B17E5";
const msgheader = "ANK.ET.NOKT";
const phone = "5318942261"; // 10 digits
const message = "NetGSM Test Mesaji";

function test(url) {
    console.log(`Testing URL: ${url}`);
    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Response for ${url}: ${data}`);
        });
    }).on('error', (err) => {
        console.error(`Error for ${url}: ${err.message}`);
    });
}

// Variation 1: gsmno, 10 digits, trailing slash, dil=TR
const url1 = `https://api.netgsm.com.tr/sms/send/get/?usercode=${usercode}&password=${encodeURIComponent(password)}&gsmno=${phone}&message=${encodeURIComponent(message)}&msgheader=${encodeURIComponent(msgheader)}&dil=TR`;
test(url1);

// Variation 2: gsmno, 12 digits (90...), no trailing slash
const url2 = `https://api.netgsm.com.tr/sms/send/get?usercode=${usercode}&password=${encodeURIComponent(password)}&gsmno=90${phone}&message=${encodeURIComponent(message)}&msgheader=${encodeURIComponent(msgheader)}&dil=TR`;
test(url2);

// Variation 3: mobiles instead of gsmno
const url3 = `https://api.netgsm.com.tr/sms/send/get/?usercode=${usercode}&password=${encodeURIComponent(password)}&mobiles=90${phone}&message=${encodeURIComponent(message)}&msgheader=${encodeURIComponent(msgheader)}&dil=TR`;
test(url3);
