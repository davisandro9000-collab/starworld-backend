import { PrismaClient } from '@prisma/client';

const NEWS_API_KEY = process.env.NEWSAPI_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

export class FootballNewsService {
  constructor(private prisma: PrismaClient) {}

  async fetchNewsForTeam(teamName: string): Promise<any[]> {
    const query = `${teamName} football world cup`;
    if (GNEWS_API_KEY) {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&token=${GNEWS_API_KEY}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.articles) {
          return data.articles.map((a: any) => ({
            title: a.title,
            content: a.description,
            source: a.source.name,
            url: a.url,
            imageUrl: a.image,
            publishedAt: new Date(a.publishedAt),
          }));
        }
      } catch (e) {}
    }
    if (NEWS_API_KEY) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.articles) {
          return data.articles.map((a: any) => ({
            title: a.title,
            content: a.description,
            source: a.source.name,
            url: a.url,
            imageUrl: a.urlToImage,
            publishedAt: new Date(a.publishedAt),
          }));
        }
      } catch (e) {}
    }
    return [];
  }

  async storeNewsForTeam(teamId: string, teamName: string) {
    const articles = await this.fetchNewsForTeam(teamName);
    for (const art of articles) {
      await this.prisma.footballNews.create({
        data: {
          teamId,
          title: art.title,
          content: art.content,
          source: art.source,
          url: art.url,
          imageUrl: art.imageUrl,
          publishedAt: art.publishedAt,
        },
      });
    }
    return articles.length;
  }
}