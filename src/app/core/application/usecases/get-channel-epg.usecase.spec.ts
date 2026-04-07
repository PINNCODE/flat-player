import { TestBed } from '@angular/core/testing';
import { GetChannelEpgUseCase } from './get-channel-epg.usecase';
import { EPG_REPOSITORY } from '@core/domain/ports/epg.repository';
import { EpgListing } from '@core/domain/models/epg-listing.model';
import { vi } from 'vitest';

describe('GetChannelEpgUseCase', () => {
  let useCase: GetChannelEpgUseCase;
  let epgRepository: { getChannelGuide: ReturnType<typeof vi.fn> };

  const mockEpgListings: EpgListing[] = [
    {
      id: 'epg_1',
      epgId: 'epg_1',
      channelId: '1',
      start: '2024-04-07 10:00:00',
      end: '2024-04-07 11:00:00',
      lang: 'es',
      title: 'Programa 1',
      description: 'Descripción del programa 1',
      startTimestamp: 1712488800,
      stopTimestamp: 1712492400,
      nowPlaying: false,
      hasArchive: false,
    },
    {
      id: 'epg_2',
      epgId: 'epg_2',
      channelId: '1',
      start: '2024-04-07 11:00:00',
      end: '2024-04-07 12:00:00',
      lang: 'es',
      title: 'Programa 2',
      description: 'Descripción del programa 2',
      startTimestamp: 1712492400,
      stopTimestamp: 1712496000,
      nowPlaying: true,
      hasArchive: false,
    },
    {
      id: 'epg_3',
      epgId: 'epg_3',
      channelId: '1',
      start: '2024-04-07 12:00:00',
      end: '2024-04-07 13:00:00',
      lang: 'es',
      title: 'Programa 3',
      description: 'Descripción del programa 3',
      startTimestamp: 1712496000,
      stopTimestamp: 1712499600,
      nowPlaying: false,
      hasArchive: false,
    },
  ];

  beforeEach(async () => {
    epgRepository = {
      getChannelGuide: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        GetChannelEpgUseCase,
        { provide: EPG_REPOSITORY, useValue: epgRepository },
      ],
    }).compileComponents();

    useCase = TestBed.inject(GetChannelEpgUseCase);
  });

  it('should create', () => {
    expect(useCase).toBeTruthy();
  });

  it('should return EPG listings sorted by timestamp', async () => {
    const streamId = '12345';
    const unsortedListings = [mockEpgListings[2], mockEpgListings[0], mockEpgListings[1]];

    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue(unsortedListings);

    const result = await useCase.execute(streamId);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('epg_1');
    expect(result[1].id).toBe('epg_2');
    expect(result[2].id).toBe('epg_3');
    expect(result[0].startTimestamp).toBeLessThan(result[1].startTimestamp);
    expect(result[1].startTimestamp).toBeLessThan(result[2].startTimestamp);
  });

  it('should pass stream ID to repository', async () => {
    const streamId = '99999';
    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue([]);

    await useCase.execute(streamId);

    expect(epgRepository.getChannelGuide).toHaveBeenCalledWith(streamId);
  });

  it('should return empty array if repository returns empty', async () => {
    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue([]);

    const result = await useCase.execute('12345');

    expect(result).toEqual([]);
  });

  it('should include now_playing programs in result', async () => {
    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue(mockEpgListings);

    const result = await useCase.execute('12345');

    const nowPlayingProgram = result.find((listing) => listing.nowPlaying);
    expect(nowPlayingProgram).toBeDefined();
    expect(nowPlayingProgram?.id).toBe('epg_2');
  });

  it('should handle repository errors', async () => {
    const error = new Error('API Error');
    vi.mocked(epgRepository.getChannelGuide).mockRejectedValue(error);

    await expect(useCase.execute('12345')).rejects.toThrow('API Error');
  });

  it('should maintain program metadata after sorting', async () => {
    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue(mockEpgListings);

    const result = await useCase.execute('12345');

    result.forEach((program, index) => {
      expect(program).toHaveProperty('id');
      expect(program).toHaveProperty('title');
      expect(program).toHaveProperty('description');
      expect(program).toHaveProperty('nowPlaying');
      expect(program).toHaveProperty('startTimestamp');
      expect(program).toHaveProperty('stopTimestamp');
    });
  });

  it('should not mutate original array from repository', async () => {
    const originalListings = [...mockEpgListings];
    vi.mocked(epgRepository.getChannelGuide).mockResolvedValue(originalListings);

    const result = await useCase.execute('12345');

    // Result should be sorted
    expect(result[0].id).toBe('epg_1');

    // Original should remain unchanged (if repository returns the same reference)
    // This test ensures we're not mutating the input
    expect(result).not.toBe(originalListings);
  });
});
