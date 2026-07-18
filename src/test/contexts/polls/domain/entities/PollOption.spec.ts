import { PollOption } from '../../../../../contexts/polls/domain/entities/PollOption';
import { PollOptionId } from '../../../../../contexts/polls/domain/value-objects/PollOptionId';

describe(PollOption.name, () => {
  it('answers whether an option id belongs to it', () => {
    const option = PollOption.fromPrimitives({ id: 'option-a', text: 'A' });

    expect(option.belongsTo(PollOptionId.fromString('option-a'))).toBe(true);
    expect(option.belongsTo(PollOptionId.fromString('option-b'))).toBe(false);
  });
});
