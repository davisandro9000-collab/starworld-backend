// src/scripts/seedGroupMatches.ts
import { prisma } from '../lib/prisma.js';

const VENUES = [
  "MetLife Stadium, East Rutherford", "AT&T Stadium, Arlington", "SoFi Stadium, Inglewood",
  "Arrowhead Stadium, Kansas City", "Mercedes-Benz Stadium, Atlanta", "Hard Rock Stadium, Miami Gardens",
  "NRG Stadium, Houston", "Lincoln Financial Field, Philadelphia", "Levi's Stadium, Santa Clara",
  "Lumen Field, Seattle", "Gillette Stadium, Foxborough", "BMO Field, Toronto",
  "Estadio Azteca, Mexico City", "Estadio BBVA, Monterrey", "Estadio Akron, Guadalajara",
  "BC Place, Vancouver"
];

async function seedGroupMatches() {
  console.log("🌍 Seeding World Cup 2026 group stage matches...");

  const teams = await prisma.footballTeam.findMany({
    where: { isPublished: true, group: { not: null } },
    orderBy: [{ group: 'asc' }, { name: 'asc' }]
  });

  const groups: Record<string, typeof teams> = {};
  for (const team of teams) {
    const groupLetter = team.group?.replace('Group ', '') ?? '';
    if (!groups[groupLetter]) groups[groupLetter] = [];
    groups[groupLetter].push(team);
  }

  console.log(`Found ${Object.keys(groups).length} groups, total ${teams.length} teams`);

  let currentDate = new Date(Date.UTC(2026, 5, 11, 13, 0, 0));
  let venueIndex = 0;
  let totalMatches = 0;

  for (const [groupLetter, groupTeams] of Object.entries(groups)) {
    if (groupTeams.length !== 4) {
      console.warn(`Group ${groupLetter} has ${groupTeams.length} teams, skipping.`);
      continue;
    }

    const [t0, t1, t2, t3] = groupTeams;
    const fixtures = [
      [t0, t1], [t2, t3], [t0, t2], [t1, t3], [t0, t3], [t1, t2]
    ];

    for (const [home, away] of fixtures) {
      await prisma.footballMatch.create({
        data: {
          homeTeamId: home.id,
          awayTeamId: away.id,
          matchDate: new Date(currentDate),
          venue: VENUES[venueIndex % VENUES.length],
          tournament: "World Cup 2026 Group Stage",
          status: "upcoming",
          isPublished: true,
        }
      });
      totalMatches++;
      currentDate = new Date(currentDate.getTime() + 3 * 60 * 60 * 1000);
      venueIndex++;
    }
    currentDate = new Date(currentDate.getTime() + 21 * 60 * 60 * 1000);
  }

  console.log(`✅ Seeded ${totalMatches} group stage matches.`);
}

seedGroupMatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());