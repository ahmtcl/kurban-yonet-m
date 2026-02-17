const usercode = '3129116404';
const password = 'Yaasin.7682';
const msgheader = 'ANK.ET.NOKT'; // From user input

const variations = [
    { code: '3129116404', header: 'ANK.ET.NOKT', phone: '905318942261' },
    { code: '031291116404', header: 'ANK.ET.NOKT', phone: '905318942261' }, // With 0
    { code: '903129116404', header: 'ANK.ET.NOKT', phone: '905318942261' }, // With 90
    { code: '3129116404', header: 'ANK.ET.NOKT', phone: '5318942261' }, // Raw phone
    { code: '3129116404', header: 'ANK.ET.NOKT', phone: '05318942261' }, // Phone with 0
];

async function testXML(v) {
    const xml = `<?xml version="1.0"?>
    <mainbody>
        <header>
            <company dil="TR">Netgsm</company>        
            <usercode>${v.code}</usercode>
            <password>${password}</password>
            <type>1:n</type>
            <msgheader>${v.header}</msgheader>
        </header>
        <body>
            <msg><![CDATA[TEST]]></msg>
            <no>${v.phone}</no>
        </body>
    </mainbody>`;

    console.log(`Testing XML Code: "${v.code}", Header: "${v.header}", Phone: "${v.phone}"`);
    try {
        const res = await fetch('https://api.netgsm.com.tr/sms/send/xml', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: xml
        });
        const text = await res.text();
        console.log('XML Response:', text);
        return text;
    } catch (e) {
        console.log('XML Error:', e.message);
        return 'ERROR';
    }
}

async function test(v) {
    const apiUrl = `https://api.netgsm.com.tr/sms/send/get`;
    const params = new URLSearchParams({
        usercode: v.code,
        password: password,
        msgheader: v.header,
        mobiles: v.phone,
        message: 'TEST'
    });

    // Log URL for debug
    const url = `${apiUrl}?${params.toString()}`;
    console.log(`Testing Code: "${v.code}", Header: "${v.header}", Phone: "${v.phone}"`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('Response:', text);
        return text.startsWith('00') || text.startsWith('20') || text.startsWith('30') || text.startsWith('40') ? text : 'UNKNOWN';
    } catch (e) {
        console.error('Error:', e.message);
        return 'ERROR';
    }
}

async function run() {
    for (const v of variations) {
        // Test GET
        // const res = await test(v);
        // if (res && (res.startsWith('00') || res.startsWith('20') || res.startsWith('30') || res.startsWith('40'))) {
        // console.log('GET Result:', res);
        // }

        // Test XML
        const xmlRes = await testXML(v);
        if (xmlRes && xmlRes.startsWith('00')) {
            console.log('XML SUCCESS FOUND!', v);
            process.exit(0);
        }
    }
    console.log('All tests failed.');
}

run();
