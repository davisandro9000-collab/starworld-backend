// src/jobs/tickets.job.ts
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export async function syncTicketmasterEvents() {
  if (!TICKETMASTER_API_KEY) {
    logger.warn('TICKETMASTER_API_KEY not set, skipping sync');
    return { totalFetched: 0, totalUpserted: 0 };
  }

  const celebrities = await prisma.celebrity.findMany({
    where: { isPublished: true },
    select: { id: true, name: true, slug: true }
  });

  logger.info(`Syncing Ticketmaster events for ${celebrities.length} celebrities`);

  let totalFetched = 0;
  let totalUpserted = 0;

  for (const celebrity of celebrities) {
    try {
      const url = `${BASE_URL}/events.json?keyword=${encodeURIComponent(celebrity.name)}&classificationName=music&sort=date,asc&size=10&apikey=${TICKETMASTER_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        logger.error(`Ticketmaster API error for ${celebrity.name}: ${data}`);
        continue;
      }

      if (!data._embedded?.events) {
        logger.info(`No events found for ${celebrity.name}`);
        continue;
      }

      for (const event of data._embedded.events) {
        const eventData = {
          ticketmasterId: event.id,
          eventName: event.name,
          artistName: celebrity.name,
          celebrityId: celebrity.id,
          venue: event._embedded?.venues?.[0]?.name || null,
          city: event._embedded?.venues?.[0]?.city?.name || null,
          country: event._embedded?.venues?.[0]?.country?.countryCode || null,
          eventDate: event.dates?.start?.dateTime 
            ? new Date(event.dates.start.dateTime) 
            : event.dates?.start?.localDate 
              ? new Date(event.dates.start.localDate)
              : null,
          imageUrl: event.images?.find((img: any) => img.width >= 1024)?.url 
            || event.images?.[0]?.url 
            || null,
          ticketUrl: event.url || null,
          priceMin: event.priceRanges?.[0]?.min || null,
          priceMax: event.priceRanges?.[0]?.max || null,
          currency: event.priceRanges?.[0]?.currency || 'USD',
          fetchedAt: new Date()
        };

        if (!eventData.eventName || !eventData.eventDate) continue;

        await prisma.ticketListingCache.upsert({
          where: { ticketmasterId: eventData.ticketmasterId },
          update: eventData,
          create: eventData
        });
        totalUpserted++;
      }
      totalFetched += data._embedded.events.length;
      
      // Rate limiting: wait 200ms between celebrity requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      logger.error(`Failed to sync events for ${celebrity.name}:`, error);
    }
  }

  logger.info(`Ticketmaster sync complete: fetched ${totalFetched}, upserted ${totalUpserted}`);
  return { totalFetched, totalUpserted };
}