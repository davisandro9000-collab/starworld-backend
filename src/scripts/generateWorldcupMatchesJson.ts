import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Define teams (must match your team slugs)
const teamsList = [
  "Qatar", "Ecuador", "Senegal", "Netherlands", "Argentina", "France", "Germany", "Spain",
  "England", "Belgium", "Portugal", "Brazil", "Uruguay", "Croatia", "Switzerland", "Colombia",
  "Morocco", "Japan", "Korea Republic", "Australia", "USA", "Canada", "Mexico", "Panama",
  "Egypt", "Ghana", "Senegal", "Tunisia", "Algeria", "Côte d'Ivoire", "Congo DR", "Cabo Verde",
  "South Africa", "Haiti", "Curacao", "Iran", "Iraq", "Jordan", "Uzbekistan", "Austria",
  "Czechia", "Norway", "Sweden", "Scotland", "Turkey", "New Zealand", "Paraguay", "Ecuador"
]; // 48 unique – adjust duplicates

// Group stage (12 groups of 4)
const groups = [
  { name: "A", teams: ["Qatar", "Ecuador", "Senegal", "Netherlands"] },
  { name: "B", teams: ["Argentina", "France", "Germany", "Spain"] },
  { name: "C", teams: ["England", "Belgium", "Portugal", "Brazil"] },
  { name: "D", teams: ["Uruguay", "Croatia", "Switzerland", "Colombia"] },
  { name: "E", teams: ["Morocco", "Japan", "Korea Republic", "Australia"] },
  { name: "F", teams: ["USA", "Canada", "Mexico", "Panama"] },
  { name: "G", teams: ["Egypt", "Ghana", "Tunisia", "Algeria"] },
  { name: "H", teams: ["Côte d'Ivoire", "Congo DR", "Cabo Verde", "South Africa"] },
  { name: "I", teams: ["Haiti", "Curacao", "Iran", "Iraq"] },
  { name: "J", teams: ["Jordan", "Uzbekistan", "Austria", "Czechia"] },
  { name: "K", teams: ["Norway", "Sweden", "Scotland", "Turkey"] },
  { name: "L", teams: ["New Zealand", "Paraguay", "Ecuador", "Chile"] } // Chile may not exist – adjust
];

const venues = [
  "MetLife Stadium, East Rutherford", "AT&T Stadium, Arlington", "SoFi Stadium, Inglewood",
  "Arrowhead Stadium, Kansas City", "Mercedes-Benz Stadium, Atlanta", "Hard Rock Stadium, Miami Gardens",
  "NRG Stadium, Houston", "Lincoln Financial Field, Philadelphia", "Levi's Stadium, Santa Clara",
  "Lumen Field, Seattle", "Gillette Stadium, Foxborough", "BMO Field, Toronto",
  "Estadio Azteca, Mexico City", "Estadio BBVA, Monterrey", "Estadio Akron, Guadalajara",
  "BC Place, Vancouver"
];

const matches: any[] = [];
let matchDate = new Date("2026-06-11T13:00:00Z");
let groupMatchIndex = 0;

// Group stage
for (const group of groups) {
  const t = group.teams;
  // 6 matches per group
  const fixtures = [
    [0,1], [2,3], [0,2], [1,3], [0,3], [1,2]
  ];
  for (const [homeIdx, awayIdx] of fixtures) {
    const homeTeam = t[homeIdx];
    const awayTeam = t[awayIdx];
    matches.push({
      homeTeam,
      awayTeam,
      matchDate: matchDate.toISOString(),
      venue: venues[groupMatchIndex % venues.length],
      tournament: "World Cup 2026 Group Stage",
      status: "upcoming",
      group: group.name
    });
    matchDate = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    groupMatchIndex++;
    if (groupMatchIndex % 6 === 0) {
      matchDate = new Date(matchDate.getTime() + 21 * 60 * 60 * 1000);
    }
  }
}

// Knockout rounds (placeholders, you can expand)
const knockout = [
  { round: "Round of 32", matches: 16, baseDate: new Date("2026-07-01T20:00:00Z") },
  { round: "Round of 16", matches: 8, baseDate: new Date("2026-07-06T20:00:00Z") },
  { round: "Quarter-finals", matches: 4, baseDate: new Date("2026-07-10T20:00:00Z") },
  { round: "Semi-finals", matches: 2, baseDate: new Date("2026-07-14T20:00:00Z") },
  { round: "Final", matches: 1, baseDate: new Date("2026-07-19T18:00:00Z") },
  { round: "Third-place", matches: 1, baseDate: new Date("2026-07-18T18:00:00Z") }
];

for (const round of knockout) {
  for (let i = 0; i < round.matches; i++) {
    matches.push({
      homeTeam: "TBD",
      awayTeam: "TBD",
      matchDate: new Date(round.baseDate.getTime() + i * 3 * 60 * 60 * 1000).toISOString(),
      venue: venues[i % venues.length],
      tournament: `World Cup 2026 ${round.round}`,
      status: "upcoming"
    });
  }
}

const output = { matches };
const outputPath = resolve(process.cwd(), "data", "worldcup-2026-matches.json");
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Generated ${matches.length} matches at ${outputPath}`);