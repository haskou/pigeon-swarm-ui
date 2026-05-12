export const copy = {
  app: {
    loading: 'Loading...',
  },
  attachments: {
    closeViewer: 'Close image viewer',
    download: 'Download attachment',
    nextImage: 'Next image',
    openImage: 'Open image',
    previousImage: 'Previous image',
  },
  auth: {
    apiLabel: 'API',
    createIdentity: 'Create identity',
    fallbackNetworksLabel: 'Networks, comma-separated',
    handleLabel: 'username',
    heroBody:
      'The client fetches your identity, decrypts it with your password, downloads the keychain, and loads conversations. Your decrypted key never leaves your device.',
    heroTitle: 'P2P messaging for everyone.',
    identityIdLabel: 'Identity ID or username',
    loadingSubmit: 'Deriving keys and calling the API...',
    login: 'Login',
    loginSubmit: 'Decrypt identity & enter',
    networkLabel: 'Network',
    networksLabel: 'Networks',
    passwordLabel: 'Password',
    peersLabel: 'Peers',
    peersPlaceholder: '--',
    profileNameLabel: 'Profile name',
    rememberMe: 'Remember me',
    title: 'Pigeon Swarm',
    unknownError: 'Unknown error. Poetic, but not useful.',
  },
  chat: {
    createConversation: 'New conversation',
    directMessage: 'Direct message',
    e2eMissing: 'End-to-end encryption key is missing for this conversation.',
    e2eReady: 'End-to-end encryption is active for this conversation.',
    emptyBody:
      'Create a 1to1 by entering the remote identity ID. Very romantic, if your idea of romance includes private keys.',
    emptyMessages:
      'No visible messages. Sending the first one usually helps, groundbreaking product discovery.',
    emptyTitle: 'No conversations',
    loadingEvents: 'Loading events...',
    menu: 'Open sidebar',
    noConversation: 'No conversation',
    noConversationHint: 'Create a conversation to start',
    you: 'You',
  },
  composer: {
    attach: 'Attach files',
    attachmentDownloadError: 'The attachment could not be decrypted.',
    attachmentTooLarge: 'Attachments must be 50 MiB or smaller.',
    decryptingAttachment: 'Decrypting',
    encryptingAttachment: 'Encrypting',
    placeholder: 'Write, encrypt, sign, and push to the swarm...',
    removeAttachment: 'Remove attachment',
    send: 'Send',
    sending: 'Sending',
  },
  connection: {
    body: 'The UI could not reach the API. Check your connection and the status of your node server and retry.',
    endpointLabel: 'Endpoint',
    imageAlt: 'Connection lost illustration',
    kicker: 'Connection lost',
    retry: 'Retry connection',
    title: 'No connection with the server',
  },
  dialog: {
    cancel: 'Cancel',
    close: 'Close dialog',
    createConversation: 'Create conversation',
    createConversationBody:
      'The user will be invited to join the conversation and will receive a notification. Direct conversations are end-to-end encrypted, so a keychain will be created and updated to the swarm as part of this process.',
    createConversationError:
      'The conversation could not be created. The backend chose violence.',
    createConversationLoading: 'Creating and publishing keychain...',
    createConversationTitle: 'Create a new direct conversation',
    remoteIdentityId: 'Identity ID or username',
  },
  errors: {
    backend: {
      401020: 'The signed request was rejected. Please reload and try again.',
      401021:
        'The request was missing authentication headers. Please reload and try again.',
      403010: 'Only the node owner can do that.',
      403020: 'Only the notification inviter can do that.',
      422030: 'That file is too large for the node to accept.',
      AuthenticatedIdentityIsNotInviterError:
        'Only the notification inviter can do that.',
      AuthenticatedIdentityIsNotNodeOwnerError:
        'Only the node owner can do that.',
      ConversationMustHaveTwoDifferentParticipantsError:
        'Direct conversations need two different identities.',
      ConversationNotFoundError: 'That conversation could not be found.',
      ConversationParticipantNotFoundError:
        'Only conversation participants can send messages here.',
      IdentityMustHaveAtLeastOneNetworkError:
        'The identity must belong to at least one network.',
      IdentityNotFoundError: 'That identity could not be found.',
      IdentityUpdateRequesterMismatchError:
        'Only the identity owner can publish profile updates.',
      InvalidIdentityCandidateError:
        'The identity data is not valid. Please review the profile and try again.',
      InvalidIdentitySignatureError: 'The identity signature is not valid.',
      InvalidIdentityVersionError: 'The identity version is not valid.',
      InvalidKeychainCandidateError:
        'The keychain data is not valid. Please reload and try again.',
      InvalidKeychainVersionError: 'The keychain version is not valid.',
      InvalidMessageSignatureError:
        'The message signature is not valid. Please reload the chat and try again.',
      InvalidNodeIdError: 'The node identifier is not valid.',
      InvalidPasswordError:
        'The password does not meet the required format (At least 8 characters).',
      InvalidProfileHandleError:
        'The username must be 3 to 32 lowercase letters, numbers, or underscores.',
      InvalidProfileImageError:
        'The profile image must be uploaded before it can be used.',
      InvalidSignedRequestError:
        'The signed request was rejected. Please reload and try again.',
      InvalidStringLengthError:
        'Some encrypted data is larger than the backend currently accepts.',
      IPFSBlockNotFoundOfflineError:
        'That IPFS block is not available while the node is offline.',
      IPFSBlockNotFoundPublicError:
        'That public IPFS block could not be found.',
      IPFSContentNotFoundError:
        'That IPFS content could not be found on any network.',
      IPFSContentTooLargeError:
        'That file is too large for the node to accept.',
      IPFSNetworkNotFoundError: 'That IPFS network could not be found.',
      IPFSNetworksNotFoundByIdsError:
        'One or more selected IPFS networks could not be found.',
      IPFSPeerIdDuplicatedError:
        'That IPFS peer is already registered in another network.',
      KeychainNotFoundError:
        'No keychain has been published for this identity yet.',
      MessageTargetAlreadyDeletedError:
        'That message has already been deleted.',
      MessageTargetAuthorMismatchError:
        'Only the original author can delete that message.',
      MessageTargetNotFoundError:
        'The message you are trying to reference could not be found.',
      MissingSignedRequestHeaderError:
        'The request was missing authentication headers. Please reload and try again.',
      NodeCannotHaveMoreThanOnePublicNetworkError:
        'A node cannot have more than one public network.',
      NodeOwnerCanOnlyBeChangedByCurrentOwnerError:
        'Only the current owner can transfer this node.',
      NotificationNotFoundError: 'That notification could not be found.',
      NotificationRecipientMismatchError:
        'This notification belongs to another identity.',
      RemoteMessageCandidateMismatchError:
        'The remote message does not match the announced message.',
    },
    fallback: 'The server rejected the request. Please try again.',
    forbidden: 'You do not have permission to do that.',
    network: 'The server could not be reached. Please check your node.',
    notFound: 'The requested resource could not be found.',
    unauthorized:
      'The signed request was rejected. Please reload and try again.',
    validation:
      'The request data is not valid. Please review it and try again.',
  },
  inspector: {
    conversationKeychain: 'Conversation keychain',
    eventsProjectedLocally: 'events projected locally',
    identity: 'Identity',
    keychainVersion: 'Keychain version',
    loadedMessages: 'Loaded messages',
    missing: 'missing',
    nets: 'nets',
    open: 'Open details',
    present: 'present',
    privateKey: 'Private key',
    storedOneKeys: 'Stored keys',
  },
  messages: {
    cancelReply: 'Cancel reply',
    decryptFailed: '[encrypted] This event could not be decrypted.',
    delete: 'Delete',
    deleteError: 'The message could not be deleted.',
    missingConversationKey:
      'This conversation key is missing from the keychain.',
    missingKey:
      '[encrypted] This conversation key is missing from the keychain.',
    originalMessage: 'original message',
    rawTitle: 'Raw message',
    reply: 'Reply',
    replyingTo: 'Replying to',
    replyTargetNotFound: 'The replied message could not be found.',
    replyTo: 'Reply to',
    viewRaw: 'View raw',
  },
  network: {
    create: 'Create network',
    createBody:
      'This is the first time this node has started. Create a network so your data have a place to sync.',
    createSubmit: 'Create network',
    firstRunMetricLabel: 'State',
    firstRunMetricValue: 'First run',
    heroBody:
      'A node needs one network before accounts can be created. You can start a fresh private swarm here, or join an existing one if another node already owns the network key.',
    heroTitle: 'First node startup',
    inviteCodeLabel: 'Network code',
    inviteCodePlaceholder: 'Paste a psn1 network code',
    join: 'Join network',
    joinBody: 'Join an existing network using its share code',
    joinSubmit: 'Join network',
    keyLabel: 'Network key',
    keyPlaceholder: 'Network key',
    loadingSubmit: 'Processing...',
    modeMetricLabel: 'Mode',
    modeMetricValue: 'node',
    nameLabel: 'Network name',
    namePlaceholder: 'My Network',
    networkIdLabel: 'Network ID',
    networkIdPlaceholder: 'Network UUID',
    title: 'Network configuration',
    unknownError: 'Unknown error. Poetic, but not useful.',
  },
  nodeSettings: {
    body: 'Manage the networks this local node participates in.',
    claim: 'Claim node',
    claimAvailable: 'Ready to claim',
    copyCode: 'Copy network code',
    create: 'Create network',
    createLabel: 'New network name',
    error: 'Node settings could not be updated.',
    join: 'Join network',
    joinLabel: 'Join with network code',
    missingNetworkKey:
      'This network cannot be shared because the API did not return its private key.',
    networks: 'Node networks',
    nodeId: 'Node ID',
    open: 'Open node settings',
    owner: 'Owner',
    ownerOnly:
      'Only the node owner can manage networks and share network codes.',
    removeUnavailable: 'Remove network unavailable in API',
    saving: 'Saving...',
    server: 'Server',
    shareLabel: 'Share selected network',
    title: 'Node settings',
    unclaimed: 'Unclaimed node',
  },
  notifications: {
    accept: 'Accept',
    archive: 'Archive',
    close: 'Close notifications',
    conversation: 'Conversation',
    createdAt: 'Created',
    decline: 'Decline',
    empty: 'No notifications right now.',
    error: 'Notifications could not be loaded.',
    invitationTitle: 'Conversation invitation',
    invitedBy: 'Invited by',
    kicker: 'Inbox',
    open: 'Open notifications',
    refresh: 'Refresh notifications',
    states: {
      accepted: 'Accepted',
      declined: 'Declined',
      pending: 'Pending',
    },
    title: 'Notifications',
  },
  peers: {
    empty: 'No active peers discovered yet.',
    error: 'Peers could not be loaded.',
    justNow: 'just now',
    kicker: 'Discovery',
    loading: 'Loading peers...',
    minuteAgo: '1 min ago',
    minutesAgo: '{count} min ago',
    networks: 'Networks',
    node: 'Node',
    noNetworks: 'No announced networks',
    open: 'Open peers',
    owner: 'Owner',
    refresh: 'Refresh',
    title: 'Active peers',
    unclaimed: 'Unclaimed',
  },
  profile: {
    biography: 'Bio',
    copied: 'Copied',
    copy: 'Copy',
    edit: 'Edit profile',
    handle: 'Username',
    identityId: 'Identity ID',
    keychainVersion: 'Keychain',
    logout: 'Log out',
    missingIdentityExternalIdentifier:
      'The API did not provide the current identity reference required to publish profile updates.',
    name: 'Profile name',
    networks: 'Networks',
    noBiography: 'No bio',
    noNetworks: 'No networks',
    picture: 'Profile picture',
    save: 'Save profile',
    saving: 'Saving...',
    updateError: 'The profile could not be updated.',
  },
  sidebar: {
    createConversation: 'New conversation',
    emptyConversations:
      'No conversations yet. Create one and we will finally have something to look at besides the void.',
    oneToOneTitle: 'Direct messages',
  },
  workspace: {
    closeSidebar: 'Close sidebar',
    loadMessagesError:
      'Messages could not be loaded. Great, now we have a mystery.',
    loadOlderError: 'Older messages could not be loaded.',
    sendError: 'The message was not sent. TLS had other plans.',
  },
} as const;
