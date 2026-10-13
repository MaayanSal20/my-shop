import 'dotenv/config';

export async function sendVerificationEmail(to: string, code: string) {
  const apiKey = process.env.BREVO_API_KEY;

  // בלי מפתח (פיתוח): מדפיסים את הקוד בטרמינל
  if (!apiKey) {
    console.log(`[DEV] קוד אימות עבור ${to}: ${code}`);
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.MAIL_FROM_NAME ?? 'myShop',
        email: process.env.MAIL_FROM_EMAIL,
      },
      to: [{ email: to }],
      subject: `קוד האימות שלך ב-myShop: ${code}`,
      htmlContent: `
        <div dir="rtl" style="font-family:Arial,sans-serif">
          <h2>ברוכה הבאה ל-myShop</h2>
          <p>קוד האימות שלך:</p>
          <p style="font-size:34px;letter-spacing:8px;direction:ltr;margin:16px 0"><b>${code}</b></p>
          <p>הקוד תקף ל-10 דקות. אם לא נרשמת, אפשר להתעלם מהמייל.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    console.error('שליחת מייל נכשלה:', res.status, await res.text());
  }
}