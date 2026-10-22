# First keychain publish

An identity's first keychain is the only keychain posted without a head
(`previousKeychainExternalIdentifier: null`). The node accepts forks, so a
second head-less post would sit beside the first and split the keychain. The
device vault record holds a `firstKeychainPublish` marker that decides whether
this device may post head-less.

## States

- `armed`: set only when this device creates the identity. A head-less post is
  allowed.
- `ambiguous`: a head-less post may have reached the node. It never posts
  head-less again. It is cleared only by adopting a head the node reports.
- `none`: the first keychain is known to exist, or this device never created
  the identity. It never posts head-less.

## Transitions

- The post is sealed and signed locally first. A local failure (encryption,
  signing) sends nothing and leaves the marker `armed`.
- `armed` -> `ambiguous` is a compare-and-set inside one IndexedDB
  transaction, written before the POST. Two tabs on one device cannot both
  post: the tab that loses the compare-and-set is refused as `ambiguous`.
- A definitive 4xx refusal (not 408) commits nothing on the node and moves
  `ambiguous` -> `armed`, again by compare-and-set, so a marker another tab
  cleared meanwhile is not re-armed.
- An accepted post, or any publish that reads a head, clears the marker to
  `none`.
- Creating the identity again (for example after a failed `POST /identities`
  whose local cleanup also failed) replaces a record that is still `armed`. A
  record in any other state is refused rather than re-armed.

## Cost of `ambiguous`

A post that failed with a server error, a lost connection or a timeout may
have committed. Until the node returns that head, the identity cannot publish
a keychain from this device, and the publish is refused with
`KeychainHeadUnavailableError('ambiguous')`. If the post never committed, the
identity stays refused on this device. The marker never falls back to `armed`
on an unverified answer, because a second head-less root would fork the
keychain.

## Identities without a marker

Identities created before the marker existed have no marker, read as `none`,
and stay refused if their first publish never completed. There is no
migration for them.
