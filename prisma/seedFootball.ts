import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const footballStars = [
  {
    name: "Kylian Mbappé",
    slug: "kylian-mbappe",
    nationality: "France",
    club: "Real Madrid",
    avatarUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Kylian_Mbapp%C3%A9_2019.jpg/200px-Kylian_Mbapp%C3%A9_2019.jpg",
    bio: "French forward, one of the best players in the world.",
  },
  {
    name: "Cristiano Ronaldo",
    slug: "cristiano-ronaldo",
    nationality: "Portugal",
    club: "Al-Nassr",
    avatarUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/200px-Cristiano_Ronaldo_2018.jpg",
    bio: "Five-time Ballon d'Or winner, all-time top scorer.",
  },
  {
    name: "Ousmane Dembélé",
    slug: "ousmane-dembele",
    nationality: "France",
    club: "Paris Saint-Germain",
    avatarUrl: "https://placehold.co/200x200?text=Dembélé",
    bio: "Fast and skillful winger.",
  },
  {
    name: "Bruno Fernandes",
    slug: "bruno-fernandes",
    nationality: "Portugal",
    club: "Manchester United",
    avatarUrl: "https://placehold.co/200x200?text=Bruno",
    bio: "Creative midfielder, known for assists and goals.",
  },
];

async function main() {
  for (const star of footballStars) {
    await prisma.footballStar.upsert({
      where: { slug: star.slug },
      update: star,
      create: star,
    });
  }
  console.log("✅ Football stars seeded");
}

main().catch(console.error).finally(() => prisma.$disconnect());