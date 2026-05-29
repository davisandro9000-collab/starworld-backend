export const auctionWinEmail = (username: string, eventName: string, bidCoins: number) => ({
  subject: `You won the auction for ${eventName}!`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #00E5FF;">Auction Won!</h1>
      <p>Hi ${username},</p>
      <p>Your bid of <strong>${bidCoins} coins</strong> won the auction for <strong>${eventName}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/marketplace" style="background: #00E5FF; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
    </div>
  `,
});