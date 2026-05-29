export const depositCreditedEmail = (username: string, amountUsd: number, coins: number) => ({
  subject: 'Deposit Verified – Coins Added!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #22C55E;">Deposit Verified!</h1>
      <p>Hi ${username},</p>
      <p>Your deposit of <strong>$${amountUsd}</strong> has been verified.</p>
      <p>You received <strong>${coins} coins</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #22C55E; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Check Balance</a>
    </div>
  `,
});