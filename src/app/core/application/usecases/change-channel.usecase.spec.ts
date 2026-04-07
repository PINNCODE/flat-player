import {
  ChangeChannelUseCase,
  type ChangeChannelCommand,
} from './change-channel.usecase';
import type { TvCategory } from '@core/domain/models/tv-catalog.model';

const buildCategories = (
  categoryCount: number,
  channelsPerCategory: number,
): readonly TvCategory[] =>
  Array.from({ length: categoryCount }, (_, ci) => ({
    id: `cat-${ci}`,
    name: `Category ${ci}`,
    iconLabel: `C${ci}`,
    channels: Array.from({ length: channelsPerCategory }, (_, chi) => ({
      id: `ch-${ci}-${chi}`,
      name: `Channel ${ci}-${chi}`,
      logoLabel: `L${chi}`,
      streamId: `${ci}${chi}`,
      streamType: 'live',
      directSource: undefined,
      currentProgram: { title: 'Program', progressPercent: 50 },
    })),
  }));

describe('ChangeChannelUseCase', () => {
  let useCase: ChangeChannelUseCase;

  beforeEach(() => {
    useCase = new ChangeChannelUseCase();
  });

  describe('empty data guards', () => {
    it('returns null when categories array is empty', () => {
      const command: ChangeChannelCommand = {
        categories: [],
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
      };
      expect(useCase.execute(command)).toBeNull();
    });

    it('returns null when current category has no channels (directional)', () => {
      const categories = buildCategories(1, 0);
      const command: ChangeChannelCommand = {
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        direction: 'next',
      };
      expect(useCase.execute(command)).toBeNull();
    });

    it('returns null when target category has no channels (direct)', () => {
      const categories = buildCategories(2, 0);
      const command: ChangeChannelCommand = {
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        targetCategoryIndex: 1,
        targetChannelIndex: 0,
      };
      expect(useCase.execute(command)).toBeNull();
    });
  });

  describe('directional navigation', () => {
    it('advances to the next channel', () => {
      const categories = buildCategories(1, 4);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 1,
        direction: 'next',
      });
      expect(result?.channelIndex).toBe(2);
      expect(result?.channel.id).toBe('ch-0-2');
    });

    it('goes to the previous channel', () => {
      const categories = buildCategories(1, 4);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 3,
        direction: 'previous',
      });
      expect(result?.channelIndex).toBe(2);
      expect(result?.channel.id).toBe('ch-0-2');
    });

    it('wraps forward from the last channel to the first', () => {
      const categories = buildCategories(1, 3);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 2,
        direction: 'next',
      });
      expect(result?.channelIndex).toBe(0);
      expect(result?.channel.id).toBe('ch-0-0');
    });

    it('wraps backward from the first channel to the last', () => {
      const categories = buildCategories(1, 3);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        direction: 'previous',
      });
      expect(result?.channelIndex).toBe(2);
      expect(result?.channel.id).toBe('ch-0-2');
    });

    it('returns the correct categoryIndex alongside the channel', () => {
      const categories = buildCategories(2, 3);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 1,
        currentChannelIndex: 0,
        direction: 'next',
      });
      expect(result?.categoryIndex).toBe(1);
    });
  });

  describe('direct target selection', () => {
    it('selects the channel at specified target indices', () => {
      const categories = buildCategories(3, 5);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        targetCategoryIndex: 2,
        targetChannelIndex: 3,
      });
      expect(result?.categoryIndex).toBe(2);
      expect(result?.channelIndex).toBe(3);
      expect(result?.channel.id).toBe('ch-2-3');
    });

    it('falls back to current indices when target is omitted', () => {
      const categories = buildCategories(2, 4);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 1,
        currentChannelIndex: 2,
      });
      expect(result?.categoryIndex).toBe(1);
      expect(result?.channelIndex).toBe(2);
    });

    it('normalizes an out-of-bounds targetChannelIndex by wrapping', () => {
      const categories = buildCategories(1, 3);
      const result = useCase.execute({
        categories,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        targetChannelIndex: 5,
      });
      expect(result?.channelIndex).toBe(5 % 3);
    });
  });
});
