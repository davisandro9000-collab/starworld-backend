export const welcomeEmail = (username: string) => ({
  subject: 'Welcome to StarWorld!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FFD700;">Welcome ${username}!</h1>
      <p>Start playing games, earn coins, and win real prizes.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #FFD700; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
    </div>
  `,
});