// Runs the UI specs that need a real node. The node is the application image
// named by PIGEON_NODE_IMAGE, built from the pinned node and wrapper sources
// (see e2e/README.md, "Real node suite"). Startup mirrors the wrapper's
// tests/ui-e2e.integration.mjs so both suites exercise the same node contract.
import { execFile, spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const origin = 'http://127.0.0.1:8080';
// Each run is one Playwright invocation against the same node. Login,
// recovery-key sign-in, pairing, 1:1 send/receive, the outbox retry flow and
// the security audit view run on every engine and viewport CI covers; the
// call refusals in browsers that cannot make or encrypt a call run on the
// desktop engine each one targets; the call decline on page departure, the
// two-device revoke flow, the private-community kick, the group conversation
// removal, the history backup and restore, recovery-key sign-in over a saved
// keychain, and a contact's shared status and its expiry once the contact
// goes invisible run on desktop Chromium.
const runs = [
  {
    specs: [
      'e2e/login-methods.spec.ts',
      'e2e/direct-message-sync.spec.ts',
      'e2e/direct-message-outbox.spec.ts',
      'e2e/security-audit.spec.ts',
      'e2e/call-browser-support.spec.ts',
    ],
    projects: ['desktop-chromium', 'desktop-firefox', 'mobile-chromium'],
  },
  {
    specs: [
      'e2e/call-page-departure.spec.ts',
      'e2e/device-revoke-mailbox.spec.ts',
      'e2e/community-mls-kick.spec.ts',
      'e2e/community-invite-link.spec.ts',
      'e2e/group-conversation.spec.ts',
      'e2e/history-backup.spec.ts',
      'e2e/recovery-key-keychain.spec.ts',
      'e2e/contact-presence.spec.ts',
    ],
    projects: ['desktop-chromium'],
  },
];
const image = process.env.PIGEON_NODE_IMAGE?.trim();
const container = `pigeon-ui-real-node-${randomBytes(4).toString('hex')}`;

if (!image) {
  console.error(
    'PIGEON_NODE_IMAGE must name the application image built from the pinned sources. See e2e/README.md, "Real node suite".',
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const docker = (args) =>
  execFileAsync('docker', args, { maxBuffer: 16 * 1024 * 1024 });

const inherit = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });

const waitFor = async (check, timeoutMs, description) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`${description}: ${error.message}`);
      }
      await sleep(2_000);
    }
  }
};

const expectOk = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response;
};

const startNode = async () => {
  const network = {
    id: randomUUID(),
    name: 'UI acceptance',
    key: generateKeyPairSync('ed25519')
      .privateKey.export({ format: 'pem', type: 'pkcs8' })
      .toString(),
  };

  await docker([
    'run',
    '-d',
    '--name',
    container,
    '-p',
    '127.0.0.1:8080:8080',
    '-e',
    'PIGEON_TURN_MODE=external',
    '-e',
    `CALLS_TURN_SHARED_SECRET=${randomBytes(32).toString('hex')}`,
    '-e',
    'PIGEON_PUBLIC_BOOTSTRAP_ENABLED=false',
    image,
  ]);

  await waitFor(
    () => expectOk(`${origin}/api/node/`),
    120_000,
    'node API did not become ready',
  );
  await expectOk(`${origin}/api/node/networks/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(network),
  });
  await waitFor(
    () => expectOk(`${origin}/`),
    60_000,
    'UI is not served by the image',
  );

  return network;
};

const dumpNodeLogs = () =>
  inherit('docker', ['logs', '--tail', '200', container]).catch(() => 1);

const main = async () => {
  try {
    const network = await startNode();
    let code = 0;
    for (const run of runs) {
      const runCode = await inherit(
        'yarn',
        [
          'playwright',
          'test',
          ...run.specs,
          ...run.projects.map((project) => `--project=${project}`),
        ],
        {
          ...process.env,
          E2E_BASE_URL: origin,
          E2E_NETWORK_ID: network.id,
        },
      );
      code ||= runCode;
    }

    if (code !== 0) {
      await dumpNodeLogs();
    }

    return code;
  } catch (error) {
    console.error(`real node suite: ${error.message}`);
    await dumpNodeLogs();
    return 1;
  } finally {
    await docker(['rm', '-fv', container]).catch(() => undefined);
  }
};

process.exitCode = await main();
