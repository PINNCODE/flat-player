import { Injectable } from '@angular/core';
import { TvCategory, TvChannel } from '../../domain/models/tv-catalog.model';
import { HomeEventItem, HomeRecommendations, HomeRow } from '../../domain/models/home-recommendations.model';

@Injectable({
  providedIn: 'root'
})
export class GetHomeRecommendationsUseCase {
  execute(categories: readonly TvCategory[], country: string | null): HomeRecommendations {
    if (!categories || categories.length === 0) {
      return { rows: [] };
    }

    const allChannels: TvChannel[] = [];
    categories.forEach(cat => {
      allChannels.push(...cat.channels);
    });

    const rows: HomeRow[] = [];
    const now = new Date();

    // 1. "Eventos de Hoy" o "Tendencias"
    // Buscamos canales que estén emitiendo algo actualmente con buen progreso o que tengan título y estén en deportes o movies
    let trendingChannels = allChannels.filter(c => 
      c.currentProgram.title && c.currentProgram.title !== 'No program info' && c.currentProgram.progressPercent > 0
    );

     const sportsEventsRow = this.buildSportsEventsRow(allChannels, now);
     if (sportsEventsRow) {
      rows.push(sportsEventsRow);
     }

    // 2. Fila "Canales de tu País" si hay país seleccionado
    if (country) {
      const countryNormalized = this.normalizeString(country);
      const countryKeywords = this.getCountryKeywords(countryNormalized);
      
      const countryChannels = allChannels.filter(c => {
         const nameNorm = this.normalizeString(c.name);
         return countryKeywords.some(kw => nameNorm.includes(kw));
      });

      // También revisar si hay categorías con el nombre del país
      const countryCategories = categories.filter(cat => {
        const catNorm = this.normalizeString(cat.name);
        return countryKeywords.some(kw => catNorm.includes(kw));
      });
      countryCategories.forEach(cat => {
         cat.channels.forEach(ch => {
           if (!countryChannels.find(c => c.id === ch.id)) {
              countryChannels.push(ch);
           }
         });
      });

      if (countryChannels.length > 0) {
        rows.push({
          id: 'country-row',
          title: `Recomendados en ${country}`,
          channels: countryChannels.slice(0, 20) // Limit to 20 for performance
        });
      }
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

    // 4. Fila Aleatoria "Para ti"
    const randomChannels = [...allChannels].sort(() => 0.5 - Math.random()).slice(0, 20);
    if (randomChannels.length > 0) {
       rows.push({
         id: 'foryou-row',
         title: 'Para ti',
         channels: randomChannels
       });
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
      /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
      /\b([01]?\d|2[0-3])\.([0-5]\d)\b/,
      /\b([01]?\d|2[0-3])h([0-5]\d)\b/i,
    ];

    for (const regex of regexPatterns) {
      const match = rawName.match(regex);
      if (!match) {
        continue;
      }

      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        continue;
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

  private getCountryKeywords(normalizedCountry: string): string[] {
     // A veces M3U lists usan prefijos como AR, MX, ES
     const kw = [normalizedCountry];
     if (normalizedCountry === 'argentina') kw.push('ar', 'arg');
     if (normalizedCountry === 'mexico') kw.push('mx', 'mex');
     if (normalizedCountry === 'chile') kw.push('cl');
     if (normalizedCountry === 'colombia') kw.push('co', 'col');
     if (normalizedCountry === 'espana') kw.push('es');
     if (normalizedCountry === 'estados unidos') kw.push('us', 'usa', 'eeuu');
     if (normalizedCountry === 'peru') kw.push('pe');
     if (normalizedCountry === 'venezuela') kw.push('ve', 'ven');
     // Wrap short codes in | or [] to avoid matching random words (e.g., 'ar' in 'cartoon') but for now exact or boundary checks
     return kw.map(k => k.length <= 3 ? `|${k}|` : k);
     // Note: This is rudimentary, but |MX| or [MX] is very common in iptv lists.
  }
}
