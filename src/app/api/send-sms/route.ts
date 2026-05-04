import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, message, recipients, messageType, groupName } = body;

        // NetGSM Credentials
        const usercode = process.env.NETGSM_USERCODE;
        const password = process.env.NETGSM_PASSWORD;
        const msgheader = process.env.NETGSM_HEADER;

        const cleanUsercode = usercode?.trim().replace(/"/g, '') || '';
        const cleanPassword = password?.trim().replace(/"/g, '') || '';
        const cleanHeader = msgheader?.trim().replace(/"/g, '') || '';

        // Toplu SMS Gönderimi (Video SMS)
        if (recipients && Array.isArray(recipients) && messageType === 'video') {
            const results = [];
            
            for (const recipient of recipients) {
                const { phone, name, videoUrl } = recipient;
                
                // SMS metni oluştur
                const smsMessage = `SAYIN ${name.toUpperCase()} KURBANINIZ KESILMISTIR. ALLAH KABUL ETSIN. KURBAN KESIM VIDEONUZU LINK UZERINDEN IZLEYEBILIRSINIZ. ${videoUrl}`;
                
                const apiUrl = `https://api.netgsm.com.tr/sms/send/get/`;
                const params = new URLSearchParams({
                    usercode: cleanUsercode,
                    password: cleanPassword,
                    msgheader: cleanHeader,
                    gsmno: phone,
                    message: smsMessage,
                    dil: 'TR'
                });

                try {
                    const response = await fetch(`${apiUrl}?${params.toString()}`, {
                        method: 'GET'
                    });

                    const responseText = await response.text();
                    const code = responseText.trim().substring(0, 2);

                    results.push({
                        phone,
                        name,
                        success: code === '00',
                        response: responseText
                    });

                    // API rate limit için kısa bekleme
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    results.push({
                        phone,
                        name,
                        success: false,
                        error: 'SMS gönderilemedi'
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            return NextResponse.json({
                success: successCount > 0,
                totalSent: successCount,
                totalFailed: results.length - successCount,
                results
            });
        }

        // Tekli SMS Gönderimi (Eski format - geriye dönük uyumluluk)
        if (!phone || !message) {
            return NextResponse.json({ success: false, error: 'Phone and message are required' }, { status: 400 });
        }

        console.log('Credentials Lengths - User:', cleanUsercode.length, 'Pass:', cleanPassword.length, 'Header:', cleanHeader.length);

        const apiUrl = `https://api.netgsm.com.tr/sms/send/get/`;
        const params = new URLSearchParams({
            usercode: cleanUsercode,
            password: cleanPassword,
            msgheader: cleanHeader,
            gsmno: phone,
            message: message,
            dil: 'TR'
        });

        const fullUrl = `${apiUrl}?${params.toString()}`;
        console.log('NetGSM Params:', params.toString());

        const response = await fetch(fullUrl, {
            method: 'GET'
        });

        const responseText = await response.text();
        console.log('NetGSM Response:', responseText);

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

        if (code === '00') {
            return NextResponse.json({ success: true, apiResponse: responseText });
        }

        return NextResponse.json({ success: true, apiResponse: responseText, warning: 'Unrecognized response format' });

    } catch (error) {
        console.error('SMS Send Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
