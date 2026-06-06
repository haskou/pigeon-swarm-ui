const emojiPattern = /\p{Extended_Pictographic}/u;
const variationSelectorPattern = /\uFE0F/g;

type GraphemeSegment = {
  segment: string;
};

type GraphemeSegmenter = {
  segment(value: string): Iterable<GraphemeSegment>;
};

export class EmojiOnlyMessage {
  public static sizeClass(content: string): null | string {
    const emojis = EmojiOnlyMessage.emojis(content);

    if (!emojis || emojis.length === 0 || emojis.length > 3) return null;

    if (emojis.length === 1) return 'text-5xl leading-none';
    if (emojis.length === 2) return 'text-4xl leading-none';

    return 'text-3xl leading-tight';
  }

  private static emojis(content: string): string[] | null {
    const compact = content.replace(/\s+/g, '');

    if (!compact) return null;

    const segments = EmojiOnlyMessage.segment(compact);

    return segments.every(EmojiOnlyMessage.isEmojiSegment) ? segments : null;
  }

  private static segment(content: string): string[] {
    const segmenter = EmojiOnlyMessage.segmenter();

    if (segmenter) {
      return Array.from(segmenter.segment(content)).map(
        (segment) => segment.segment,
      );
    }

    return Array.from(content);
  }

  private static segmenter(): GraphemeSegmenter | null {
    const intlWithSegmenter = Intl as typeof Intl & {
      Segmenter?: new () => GraphemeSegmenter;
    };

    return intlWithSegmenter.Segmenter ? new intlWithSegmenter.Segmenter() : null;
  }

  private static isEmojiSegment(segment: string): boolean {
    const withoutVariation = segment.replace(variationSelectorPattern, '');

    return emojiPattern.test(withoutVariation);
  }
}
