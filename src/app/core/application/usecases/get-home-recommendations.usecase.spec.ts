import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GetHomeRecommendationsUseCase } from './get-home-recommendations.usecase';
import { TvCategory } from '@core/domain/models/tv-catalog.model';

describe('GetHomeRecommendationsUseCase', () => {
  let useCase: GetHomeRecommendationsUseCase;

  beforeEach(() => {
    useCase = new GetHomeRecommendationsUseCase();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes only sports/ppv events with parsed time greater than or equal to current system time', () => {
    vi.setSystemTime(new Date('2026-04-08T20:30:00'));

    const categories: TvCategory[] = [
      {
        id: 'sports',
        name: 'Sports',
        iconLabel: 'SP',
        channels: [
          {
            id: 'ch-1',
            name: 'Canal PPV 1',
            streamId: '1',
            streamType: 'hls',
            logoLabel: 'PPV',
            currentProgram: { title: 'UFC 22:30 Main Card', progressPercent: 10 },
          },
          {
            id: 'ch-2',
            name: 'Futbol Center',
            streamId: '2',
            streamType: 'hls',
            logoLabel: 'FUT',
            currentProgram: { title: 'Liga 20:30 Partido', progressPercent: 35 },
          },
          {
            id: 'ch-3',
            name: 'Boxeo Retro',
            streamId: '3',
            streamType: 'hls',
            logoLabel: 'BOX',
            currentProgram: { title: 'Boxeo 19:45 Clasico', progressPercent: 25 },
          },
          {
            id: 'ch-4',
            name: 'NBA Full',
            streamId: '4',
            streamType: 'hls',
            logoLabel: 'NBA',
            currentProgram: { title: 'NBA Night', progressPercent: 5 },
          },
          {
            id: 'ch-5',
            name: 'Serie Total',
            streamId: '5',
            streamType: 'hls',
            logoLabel: 'SER',
            currentProgram: { title: 'Drama 22:00', progressPercent: 60 },
          },
        ],
      },
    ];

    const recommendations = useCase.execute(categories, null);
    const sportsRow = recommendations.rows.find((row) => row.id === 'sports-ppv-row');

    expect(sportsRow).toBeTruthy();
    expect(sportsRow?.events?.length).toBe(2);
    expect(sportsRow?.events?.map((event) => event.timeLabel)).toEqual(['20:30', '22:30']);
    expect(sportsRow?.events?.map((event) => event.typeLabel)).toEqual(['SPORT', 'PPV']);
    expect(sportsRow?.events?.[0].isLiveNow).toBe(true);
  });

  it('supports multiple time formats extracted from title', () => {
    vi.setSystemTime(new Date('2026-04-08T08:00:00'));

    const categories: TvCategory[] = [
      {
        id: 'sports',
        name: 'Sports',
        iconLabel: 'SP',
        channels: [
          {
            id: 'ch-1',
            name: 'MMA Arena',
            streamId: '1',
            streamType: 'hls',
            logoLabel: 'MMA',
            currentProgram: { title: 'MMA 09.15 cartelera', progressPercent: 1 },
          },
          {
            id: 'ch-2',
            name: 'Motor GP',
            streamId: '2',
            streamType: 'hls',
            logoLabel: 'MGP',
            currentProgram: { title: 'MotoGP 11h45 carrera', progressPercent: 1 },
          },
        ],
      },
    ];

    const recommendations = useCase.execute(categories, null);
    const sportsRow = recommendations.rows.find((row) => row.id === 'sports-ppv-row');

    expect(sportsRow?.events?.map((event) => event.timeLabel)).toEqual(['09:15', '11:45']);
  });

  it('does not include events from earlier hours and does not include entries without parsable time', () => {
    vi.setSystemTime(new Date('2026-04-08T23:10:00'));

    const categories: TvCategory[] = [
      {
        id: 'sports',
        name: 'Sports',
        iconLabel: 'SP',
        channels: [
          {
            id: 'ch-1',
            name: 'Sports A',
            streamId: '1',
            streamType: 'hls',
            logoLabel: 'A',
            currentProgram: { title: 'UFC 22:50', progressPercent: 10 },
          },
          {
            id: 'ch-2',
            name: 'Sports B',
            streamId: '2',
            streamType: 'hls',
            logoLabel: 'B',
            currentProgram: { title: 'PPV estelar', progressPercent: 10 },
          },
        ],
      },
    ];

    const recommendations = useCase.execute(categories, null);
    const sportsRow = recommendations.rows.find((row) => row.id === 'sports-ppv-row');

    expect(sportsRow).toBeUndefined();
  });
});
