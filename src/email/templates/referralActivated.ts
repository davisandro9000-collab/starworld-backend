export const referralActivatedEmail = (username: string, referredUsername: string, bonusCoins: number) => ({
  subject: 'Referral Activated – Bonus Coins!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #CD7F32;">Referral Bonus!</h1>
      <p>Great news, ${username}!</p>
      <p>${referredUsername} made their first deposit. You earned <strong>${bonusCoins} bonus coins</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/referrals" style="background: #CD7F32; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Referrals</a>
    </div>
  `,
});