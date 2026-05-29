export const gameWinEmail = (username: string, gameType: string, coins: number) => ({
  subject: `You won ${coins} coins on ${gameType}!`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FFD700;">Congratulations ${username}!</h1>
      <p>You won <strong>${coins} coins</strong> playing <strong>${gameType}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/games" style="background: #FFD700; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Play Again</a>
    </div>
  `,
});