import { describe, it, expect, beforeEach } from 'vitest';
import { SearchChannelsUseCase } from './search-channels.usecase';
import { TvCategory } from '@core/domain/models/tv-catalog.model';

describe('SearchChannelsUseCase', () => {
  let useCase: SearchChannelsUseCase;

  const mockCategories: TvCategory[] = [
    {
      id: 'cat-1', name: 'Deportes', iconLabel: 'SP', channels: [
        { id: 'ch-1', name: 'ESPN Norte', streamId: '1', streamType: 'hls', currentProgram: { title: 'Noticias', progressPercent: 10 }, logoLabel: 'ESP' },
        { id: 'ch-2', name: 'Fox Sports', streamId: '2', streamType: 'hls', currentProgram: { title: 'Carreras', progressPercent: 20 }, logoLabel: 'FOX' },
      ],
    },
    {
      id: 'cat-2', name: 'Noticias', iconLabel: 'NE', channels: [
        { id: 'ch-3', name: 'CNN Español', streamId: '3', streamType: 'hls', currentProgram: { title: 'Global', progressPercent: 30 }, logoLabel: 'CNN' },
        { id: 'ch-4', name: 'Fox News', streamId: '4', streamType: 'hls', currentProgram: { title: 'Politics', progressPercent: 40 }, logoLabel: 'FNX' },
      ],
    },
  ];

  beforeEach(() => {
    useCase = new SearchChannelsUseCase();
  });

  it('should be created', () => {
    expect(useCase).toBeTruthy();
  });

  it('should return empty when query is empty', () => {
    const result = useCase.execute({ categories: mockCategories, query: '   ' });
    expect(result.length).toBe(0);
  });

  it('should find channels matching case insensitive query', () => {
    const result = useCase.execute({ categories: mockCategories, query: 'Espn' });
    expect(result.length).toBe(1);
    expect(result[0].channel.id).toBe('ch-1');
    expect(result[0].categoryIndex).toBe(0);
    expect(result[0].channelIndex).toBe(0);
  });

  it('should find multiple channels across categories', () => {
    const result = useCase.execute({ categories: mockCategories, query: 'fox' });
    expect(result.length).toBe(2);
    expect(result[0].channel.id).toBe('ch-2');
    expect(result[1].channel.id).toBe('ch-4');
  });

  it('should ignore accents in search', () => {
    const accentsCategories: TvCategory[] = [
      {
        id: 'cat-1', name: 'Cat', iconLabel: 'C', channels: [
          { id: 'ch-1', name: 'Películas', streamId: '1', streamType: 'hls', currentProgram: { title: 'A', progressPercent: 0 }, logoLabel: 'P' },
        ]
      }
    ];

    const result = useCase.execute({ categories: accentsCategories, query: 'peliculas' });
    expect(result.length).toBe(1);
    expect(result[0].channel.name).toBe('Películas');
  });
});
