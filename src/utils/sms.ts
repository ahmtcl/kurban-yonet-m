export async function sendSMS(phone: string, message: string): Promise<boolean> {
    try {
        // Format phone number: Remove non-digits, ensure it starts with 90
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '9' + formattedPhone;
        } else if (formattedPhone.startsWith('5')) {
            formattedPhone = '90' + formattedPhone;
        }
        // If it's already 905..., leave it. 

        const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: formattedPhone, message }),
        });

        const data = await response.json();

        if (data.success) {
            console.log('SMS sent successfully:', data.apiResponse);
            return true;
        } else {
            console.error('Failed to send SMS:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
}

export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
