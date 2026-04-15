import { Injectable } from '@angular/core';
import { TvCategory, TvChannel } from '../../domain/models/tv-catalog.model';
import { HomeEventItem, HomeRecommendations, HomeRow } from '../../domain/models/home-recommendations.model';

@Injectable({
  providedIn: 'root'
})
export class GetHomeRecommendationsUseCase {
  execute(categories: readonly TvCategory[], favoriteIds: string[] = []): HomeRecommendations {
    if (!categories || categories.length === 0) {
      return { rows: [] };
    }

    const allChannels: TvChannel[] = [];
    categories.forEach(cat => {
      allChannels.push(...cat.channels);
    });

    const rows: HomeRow[] = [];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. "Eventos de Hoy" o "Tendencias"
    // Buscamos canales que estén emitiendo algo actualmente con buen progreso o que tengan título y estén en deportes o movies
    let trendingChannels = allChannels.filter(c => 
      c.currentProgram.title && c.currentProgram.title !== 'No program info' && c.currentProgram.progressPercent > 0
    );

     const sportsEventsRow = this.buildSportsEventsRow(allChannels, now);
     if (sportsEventsRow) {
      rows.push(sportsEventsRow);
     }

    // 2. Fila "Mis Favoritos"
    const favoriteChannels: TvChannel[] = [];
    favoriteIds.forEach(favId => {
      const ch = allChannels.find(c => c.id === favId);
      if (ch) favoriteChannels.push(ch);
    });

    if (favoriteChannels.length > 0) {
      rows.push({
        id: 'favorites-row',
        title: 'Mis Favoritos',
        channels: favoriteChannels.slice(0, 20)
      });
    }

    // 3. Fila "En Vivo Ahora"
    const liveChannels = trendingChannels.slice(0, 20);
    if (liveChannels.length > 0) {
      rows.push({
        id: 'live-row',
        title: 'En Vivo Ahora',
        channels: liveChannels
      });
    }

    // 4. Fila "Para ti" dinámica (Basada en categorías afines y canales HD)
    if (favoriteChannels.length > 0) {
      const favoriteCategoryIds = new Set<string>();
      categories.forEach(cat => {
        cat.channels.forEach(ch => {
          if (favoriteIds.includes(ch.id)) {
            favoriteCategoryIds.add(cat.id);
          }
        });
      });

      const siblingChannelsHD: TvChannel[] = [];
      categories.forEach(cat => {
        if (favoriteCategoryIds.has(cat.id)) {
          cat.channels.forEach(ch => {
            if (!favoriteIds.includes(ch.id)) {
              const nameNorm = this.normalizeString(ch.name);
              if (nameNorm.includes('hd')) {
                const parsedTime = this.extractEventTime(ch.name);
                if (parsedTime) {
                   const eventMinutes = parsedTime.hour * 60 + parsedTime.minute;
                   if (eventMinutes <= nowMinutes) {
                     siblingChannelsHD.push(ch);
                   }
                } else {
                   // No tiene hora en el nombre explícito, no lo omitimos (Asumimos continuo)
                   siblingChannelsHD.push(ch);
                }
              }
            }
          });
        }
      });

      if (siblingChannelsHD.length > 0) {
        rows.push({
          id: 'foryou-hd-row',
          title: 'Para ti',
          channels: siblingChannelsHD.slice(0, 20)
        });
      }
    }

    return { rows };
  }

  private buildSportsEventsRow(allChannels: readonly TvChannel[], now: Date): HomeRow | null {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const endOfDayMinutes = 23 * 60 + 59;
    const events: HomeEventItem[] = [];

    allChannels.forEach((channel) => {
      const eventSource = `${channel.currentProgram.title} ${channel.name}`;
      const normalizedSource = this.normalizeString(eventSource);

      if (!this.isSportsOrPpvEvent(normalizedSource)) {
        return;
      }

      const parsedTime = this.extractEventTime(eventSource);
      if (!parsedTime) {
        return;
      }

      const eventMinutes = parsedTime.hour * 60 + parsedTime.minute;
      if (eventMinutes < nowMinutes || eventMinutes > endOfDayMinutes) {
        return;
      }

      events.push({
        id: `${channel.id}-${parsedTime.hour}-${parsedTime.minute}`,
        channel,
        title: channel.currentProgram.title || channel.name,
        subtitle: channel.name,
        timeLabel: parsedTime.label,
        typeLabel: normalizedSource.includes('ppv') ? 'PPV' : 'SPORT',
        isLiveNow: eventMinutes === nowMinutes,
      });
    });

    events.sort((a, b) => {
      const aMinutes = this.timeLabelToMinutes(a.timeLabel);
      const bMinutes = this.timeLabelToMinutes(b.timeLabel);
      return aMinutes - bMinutes;
    });

    const uniqueEvents = events.filter((event, index, list) => {
      return list.findIndex((candidate) => candidate.id === event.id) === index;
    });

    if (uniqueEvents.length === 0) {
      return null;
    }

    return {
      id: 'sports-ppv-row',
      title: 'Deportes y PPV de hoy',
      channels: uniqueEvents.map((event) => event.channel),
      events: uniqueEvents.slice(0, 20),
    };
  }

  private normalizeString(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  private isSportsOrPpvEvent(normalizedName: string): boolean {
    const sportsKeywords = [
      'ppv',
      'ufc',
      'boxing',
      'boxeo',
      'mma',
      'futbol',
      'football',
      'soccer',
      'liga',
      'champions',
      'copa',
      'nba',
      'nfl',
      'mlb',
      'formula 1',
      'motogp',
      'wwe',
      'deporte',
      'sports',
    ];

    return sportsKeywords.some((keyword) => normalizedName.includes(keyword));
  }

  private extractEventTime(rawName: string): { hour: number; minute: number; label: string } | null {
    const regexPatterns = [
      /\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(am|pm|a\.m\.|p\.m\.))?\b/i,
      /\b([01]?\d|2[0-3])\.([0-5]\d)(?:\s*(am|pm|a\.m\.|p\.m\.))?\b/i,
      /\b([01]?\d|2[0-3])h([0-5]\d)(?:\s*(am|pm|a\.m\.|p\.m\.))?\b/i,
    ];

    for (const regex of regexPatterns) {
      const match = rawName.match(regex);
      if (!match) {
        continue;
      }

      let hour = Number(match[1]);
      const minute = Number(match[2]);
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        continue;
      }

      const modifier = match[3] ? match[3].toLowerCase() : null;
      if (modifier) {
        const isPm = modifier.startsWith('p');
        if (isPm && hour < 12) {
          hour += 12;
        } else if (!isPm && hour === 12) {
          hour = 0;
        }
      }

      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return { hour, minute, label };
    }

    return null;
  }

  private timeLabelToMinutes(timeLabel: string): number {
    const [hours, minutes] = timeLabel.split(':').map((part) => Number(part));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return Number.MAX_SAFE_INTEGER;
    }

    return hours * 60 + minutes;
  }


}
