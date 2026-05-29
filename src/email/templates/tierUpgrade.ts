export const tierUpgradeEmail = (username: string, newTier: string) => ({
  subject: `Congratulations! You're now ${newTier} tier`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: ${newTier === 'Platinum' ? '#E5E4E2' : newTier === 'Silver' ? '#C0C0C0' : '#CD7F32'};">Tier Upgrade!</h1>
      <p>Congratulations ${username}!</p>
      <p>You've reached <strong>${newTier} tier</strong> with better win rates and coin multipliers.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #FFD700; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Benefits</a>
    </div>
  `,
});