import type { CallResource } from './resources/CallResource';

import { Call } from '../../domain/Call';

export class CallMapper {
  public fromResource(resource: CallResource): Call {
    return Call.fromPrimitives(resource);
  }

  public toResource(call: Call): CallResource {
    return call.toPrimitives();
  }
}
