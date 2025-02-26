import { Keypair, PublicKey } from "@solana/web3.js";

export const SQUADS_V4_PROGRAM_ID = new PublicKey(
  "sqdsFBUUwbsuoLUhoWdw343Je6mvn7dGVVRYCa4wtqJ"
);

export const DEFAULT_RPC_URL = "https://api.testnet.sonic.game";

// This program treasury address is an account that is strictly necessary to declare when creating a new multisig address.
// This account is statically initialized when the squads program is deployed. So do not change this.
export const PROGRAM_TREASURY_ACCOUNT = new PublicKey(
  "4KhjyJEhy5ve55t9pdhTKmMTHZDvhzEp3GV2yazwgPzg"
);
