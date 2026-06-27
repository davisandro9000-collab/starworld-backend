// src/scripts/seed-worldcup.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Helper to convert team id to country code for flagsapi.com
function getCountryCode(teamId: string): string {
  const fullMap: Record<string, string> = {
    "canada": "CA",
    "mexico": "MX",
    "usa": "US",
    "algeria": "DZ",
    "argentina": "AR",
    "australia": "AU",
    "austria": "AT",
    "belgium": "BE",
    "bosnia_and_herzegovina": "BA",
    "brazil": "BR",
    "cabo_verde": "CV",
    "colombia": "CO",
    "congo_dr": "CD",
    "cote_d_ivoire": "CI",
    "croatia": "HR",
    "curacao": "CW",
    "czechia": "CZ",
    "ecuador": "EC",
    "egypt": "EG",
    "england": "GB",
    "france": "FR",
    "germany": "DE",
    "ghana": "GH",
    "haiti": "HT",
    "ir_iran": "IR",
    "iraq": "IQ",
    "japan": "JP",
    "jordan": "JO",
    "korea_republic": "KR",
    "morocco": "MA",
    "netherlands": "NL",
    "new_zealand": "NZ",
    "norway": "NO",
    "panama": "PA",
    "paraguay": "PY",
    "portugal": "PT",
    "qatar": "QA",
    "saudi_arabia": "SA",
    "scotland": "GB",
    "senegal": "SN",
    "south_africa": "ZA",
    "spain": "ES",
    "sweden": "SE",
    "switzerland": "CH",
    "tunisia": "TN",
    "turkiye": "TR",
    "uruguay": "UY",
    "uzbekistan": "UZ"
  };
  return fullMap[teamId] || teamId.slice(0, 2).toUpperCase();
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🌍 Seeding World Cup 2026 data from worldcup.json...');

  // Read JSON file
  const jsonPath = path.join(process.cwd(), 'data', 'worldcup.json');
  const rawData = await fs.readFile(jsonPath, 'utf-8');
  const teamsData = JSON.parse(rawData);

  // Clear existing football data
  console.log('Clearing existing football data...');
  await prisma.footballPrediction.deleteMany();
  await prisma.footballMatch.deleteMany();
  await prisma.footballPlayer.deleteMany();
  await prisma.footballTeam.deleteMany();
  console.log('Cleared.');

  // Insert teams
  const teamIdMap = new Map();
  for (const team of teamsData) {
    const countryCode = getCountryCode(team.id);
    const flagUrl = `https://flagsapi.com/${countryCode}/flat/64.png`;
    const slug = team.id;

    const created = await prisma.footballTeam.create({
      data: {
        externalId: team.id,
        name: team.name,
        slug: slug,
        flagUrl: flagUrl,
        group: team.qualificationGroup || null,
        coach: team.manager || null,
        worldRanking: team.worldRanking ?? null,
        participations: team.participations ?? null,
        isPublished: true,
      },
    });
    teamIdMap.set(team.id, created.id);
    console.log(`✅ Team: ${team.name} (${team.id})`);
  }

  // Insert players in bulk (createMany) with retries
  let playerCount = 0;
  for (const team of teamsData) {
    const teamInternalId = teamIdMap.get(team.id);
    if (!teamInternalId) {
      console.warn(`⚠️ Team ${team.id} not found, skipping players`);
      continue;
    }

    const playersData = team.players.map((p: any) => ({
      name: p.name,
      position: p.position || null,
      number: null,
      teamId: teamInternalId,
      goals: 0,
      assists: 0,
      isPublished: true,
    }));

    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
      try {
        await prisma.footballPlayer.createMany({
          data: playersData,
          skipDuplicates: true,
        });
        success = true;
        console.log(`   Added ${playersData.length} players for ${team.name}`);
        playerCount += playersData.length;
      } catch (err) {
        attempts++;
        console.error(`   Retry ${attempts} for ${team.name}:`, err);
        if (attempts < 3) {
          await delay(2000); // wait 2 seconds before retry
        } else {
          console.error(`   Failed to insert players for ${team.name} after 3 attempts.`);
          throw err;
        }
      }
    }
    // Small delay between teams to avoid Neon throttling
    await delay(500);
  }

  console.log(`✅ Seeding complete!`);
  console.log(`   Teams: ${teamsData.length}`);
  console.log(`   Players: ${playerCount}`);
  console.log(`   Note: Matches not seeded yet – run seedGroupMatches.ts separately.`);
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());