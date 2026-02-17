import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { phone, message } = await request.json();

        // Basic validation
        if (!phone || !message) {
            return NextResponse.json({ success: false, error: 'Phone and message are required' }, { status: 400 });
        }

        // NetGSM XML Structure
        const usercode = process.env.NETGSM_USERCODE;
        const password = process.env.NETGSM_PASSWORD;
        const msgheader = process.env.NETGSM_HEADER;

        // Sanitize credentials
        const cleanUsercode = usercode?.trim().replace(/"/g, '') || '';
        const cleanPassword = password?.trim().replace(/"/g, '') || '';
        const cleanHeader = msgheader?.trim().replace(/"/g, '') || '';

        console.log('Credentials Lengths - User:', cleanUsercode.length, 'Pass:', cleanPassword.length, 'Header:', cleanHeader.length);

        // NetGSM GET API URL (Ensuring trailing slash as per some docs)
        const apiUrl = `https://api.netgsm.com.tr/sms/send/get/`;
        const params = new URLSearchParams({
            usercode: cleanUsercode,
            password: cleanPassword,
            msgheader: cleanHeader,
            gsmno: phone, // Changed from 'mobiles' to 'gsmno'
            message: message,
            dil: 'TR' // Added for Turkish character support
        });

        // Send request to NetGSM
        const fullUrl = `${apiUrl}?${params.toString()}`;
        console.log('NetGSM Params:', params.toString());
        // console.log('NetGSM Request URL (masked):', fullUrl.replace(cleanPassword, '*****'));

        const response = await fetch(fullUrl, {
            method: 'GET'
        });

        const responseText = await response.text();

        console.log('NetGSM Response:', responseText);

        // NetGSM Error Handling
        // Success response usually starts with "00" followed by JobID (e.g. "00 123456")
        // Error codes are usually just 2 digits (e.g. "40", "30")

        const code = responseText.trim().substring(0, 2);

        if (code === '40') {
            return NextResponse.json({ success: false, error: 'Hata 40: Gönderici Adı (Header) hatalı. Sistemde tanımlı değil veya 11 karakterden uzun.' });
        }
        if (code === '30') {
            return NextResponse.json({ success: false, error: 'Hata 30: Geçersiz Kullanıcı Adı veya Şifre.' });
        }
        if (code === '20') {
            return NextResponse.json({ success: false, error: 'Hata 20: Mesaj metni çok uzun veya karakter hatası.' });
        }
        if (code === '70') {
            return NextResponse.json({
                success: false,
                error: 'Hata 70: Hatalı parametre (XML Hatası).'
            });
        }

        // If it starts with 00, it's success
        if (code === '00') {
            return NextResponse.json({ success: true, apiResponse: responseText });
        }

        // Fallback for other responses
        return NextResponse.json({ success: true, apiResponse: responseText, warning: 'Unrecognized response format' });

    } catch (error) {
        console.error('SMS Send Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
