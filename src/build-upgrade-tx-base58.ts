import {
    Connection, PublicKey,
    Transaction, TransactionInstruction,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { parseArgs } from "util";
import { DEFAULT_RPC_URL } from "./utils/constants";
import { validateRpcUrl } from "./utils/validators";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    url: {
      type: "string",
    },
    vault_public_key: {
      type: "string",
    },
    fee_payer_public_key: {
      type: "string",
    },
    program_id: {
      type: "string",
    },
    buffer_account: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.vault_public_key) {
    console.error("--vault_public_key is required");
    process.exit(1);
} else if (!values.program_id) {
    console.error("--program_id is required");
    process.exit(1);
} else if (!values.buffer_account) {
    console.error("--buffer_account is required");
    process.exit(1);
} else if (!values.fee_payer_public_key) {
    console.error("--fee_payer_public_key is required");
    process.exit(1);
}

const VAULT_PUBLIC_KEY = new PublicKey(values.vault_public_key)
const PROGRAM_ID = new PublicKey(values.program_id);
const BUFFER_ACCOUNT = new PublicKey(values.buffer_account);
const FEE_PAYER_PUBLIC_KEY = new PublicKey(values.fee_payer_public_key);

const rpcUrl = values.url
  ? validateRpcUrl(values.url)
    ? values.url
    : (() => {
        throw new Error(`Invalid RPC URL: ${values.url}`);
      })()
  : DEFAULT_RPC_URL;

const connection = new Connection(rpcUrl, "recent");

const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

async function createUpgradeInstruction(
    programId: PublicKey,
    bufferAddress: PublicKey,
    upgradeAuthority: PublicKey,
    spillAddress: PublicKey
  ): Promise<TransactionInstruction> {
    const [programDataAddress] = await PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BPF_LOADER_UPGRADEABLE
    )
  
    const keys = [
      {
        pubkey: programDataAddress,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: programId,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: bufferAddress,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: spillAddress,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: SYSVAR_RENT_PUBKEY,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: upgradeAuthority,
        isWritable: false,
        isSigner: true,
      },
    ]
  
    return new TransactionInstruction({
      keys,
      programId: BPF_LOADER_UPGRADEABLE,
      data: Buffer.from([3, 0, 0, 0]), // Upgrade instruction bincode
    })
}

async function createUpgradeTransaction() {
    const [spillAddress, ] = await PublicKey.findProgramAddressSync(
        [BUFFER_ACCOUNT.toBuffer(), Buffer.from("spill")],
        BPF_LOADER_UPGRADEABLE
    );

    const upgradeInstruction = await createUpgradeInstruction(
        PROGRAM_ID,
        BUFFER_ACCOUNT,
        VAULT_PUBLIC_KEY,
        spillAddress,
    )

    const transaction = new Transaction().add(upgradeInstruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = FEE_PAYER_PUBLIC_KEY

    const message = transaction.serializeMessage();
    const base58Message = bs58.encode(message);

    console.log("Base58 Encoded Transaction Message:");
    console.log(base58Message);
}

createUpgradeTransaction();
