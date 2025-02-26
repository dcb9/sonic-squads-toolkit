import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { parseArgs } from "util";
import * as multisig from "@sqds/multisig";
import {
  SQUADS_V4_PROGRAM_ID,
  DEFAULT_RPC_URL,
  PROGRAM_TREASURY_ACCOUNT,
} from "./utils/constants";
import { signAndSendTransaction } from "./utils/send-transaction";
import {
  validateAndLoadKeypair,
  validateRpcUrl,
  validateMembers,
  validateThreshold,
} from "./utils/validators";
import { createConsola } from "consola";

const logger = createConsola({
  defaults: {
    tag: "create-multisig",
  },
});

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    url: {
      type: "string",
    },
    keypair: {
      type: "string",
    },
    memo: {
      type: "string",
    },
    member: {
      type: "string",
      multiple: true,
    },
    threshold: {
      type: "string", // parseArgs only accepts string, we'll convert to number later
    },
  },
  strict: true,
  allowPositionals: true,
});

const rpcUrl = values.url
  ? validateRpcUrl(values.url)
    ? values.url
    : (() => {
        throw new Error(`Invalid RPC URL: ${values.url}`);
      })()
  : DEFAULT_RPC_URL;

const connection = new Connection(rpcUrl, "recent");

export async function executeCreateMultisig() {
  if (!values.keypair) {
    logger.error("Missing required argument: --keypair <path-to-keypair>");
    process.exit(1);
  }

  let ADMIN_KEYPAIR: Keypair;
  try {
    ADMIN_KEYPAIR = await validateAndLoadKeypair(values.keypair);
    logger.debug("Admin keypair loaded successfully");
    logger.info("Admin pubkey:", ADMIN_KEYPAIR.publicKey.toBase58());
  } catch (error) {
    logger.error("Failed to load keypair:", (error as Error).message);
    process.exit(1);
  }

  // Validate additional members
  let additionalMembers: PublicKey[] = [];
  try {
    additionalMembers = validateMembers(values.member);
    if (additionalMembers.length > 0) {
      logger.info(`Found ${additionalMembers.length} additional members`);
      additionalMembers.forEach((member) => {
        logger.debug("Member:", member.toBase58());
      });
    }
  } catch (error) {
    logger.error(
      "Invalid member public key provided:",
      (error as Error).message
    );
    process.exit(1);
  }

  // Set up multisig parameters with all members
  const members: multisig.types.Member[] = [
    {
      key: ADMIN_KEYPAIR.publicKey,
      permissions: multisig.types.Permissions.all(),
    },
    ...additionalMembers.map((pubkey) => ({
      key: pubkey,
      permissions: multisig.types.Permissions.all(),
    })),
  ];

  // Parse and validate threshold
  let threshold: number;
  try {
    // Default threshold is 1 if not provided
    const thresholdValue = values.threshold ? parseInt(values.threshold) : 1;
    threshold = validateThreshold(thresholdValue, members.length);
    logger.info(
      `Using threshold: ${threshold} out of ${members.length} members`
    );
  } catch (error) {
    logger.error("Invalid threshold value:", (error as Error).message);
    process.exit(1);
  }

  const seedKeypair = Keypair.generate();

  const result = await createMultisig(
    ADMIN_KEYPAIR.publicKey,
    seedKeypair.publicKey,
    ADMIN_KEYPAIR.publicKey,
    ADMIN_KEYPAIR.publicKey,
    0,
    members,
    threshold,
    PROGRAM_TREASURY_ACCOUNT,
    ADMIN_KEYPAIR.publicKey,
    values.memo || "Create new Sonic Squad",
    [ADMIN_KEYPAIR, seedKeypair]
  );

  return result;
}

async function createMultisig(
  feePayer: PublicKey,
  createKey: PublicKey,
  creator: PublicKey,
  configAuthority: PublicKey | null,
  timeLock: number,
  members: multisig.types.Member[],
  threshold: number,
  treasury: PublicKey,
  rentCollector: PublicKey | null,
  memo: string,
  signers: Keypair[]
) {
  logger.info("started createMultisig");

  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey,
    programId: SQUADS_V4_PROGRAM_ID,
  });

  const multisigCreateV2Ix = multisig.instructions.multisigCreateV2({
    createKey: createKey,
    creator: creator,
    multisigPda: multisigPda,
    configAuthority: configAuthority,
    timeLock: timeLock,
    members: members,
    threshold: threshold,
    treasury: treasury,
    rentCollector: rentCollector,
    memo: memo,
    programId: SQUADS_V4_PROGRAM_ID,
  });

  const tx: Transaction = new Transaction();

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;

  tx.add(multisigCreateV2Ix);

  const signature = await signAndSendTransaction(
    connection,
    signers,
    tx,
    ({ status }) => {
      if (status === "confirmed") {
        logger.success(
          "Successfully Created Squad Multisig: ",
          multisigPda.toBase58()
        );
        logger.info("Write this address down, you will need it later.");
      }
    }
  );
  return {
    signature,
    multisigAddress: multisigPda.toBase58(),
  };
}

await executeCreateMultisig()
  .then((result) => {
    logger.success(
      "Multisig created successfully at transaction hash: ",
      result.signature
    );
    logger.info("Multisig address: ", result.multisigAddress);
    process.exit(0);
  })
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });
