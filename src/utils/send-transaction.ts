import {
  VersionedTransaction,
  ComputeBudgetProgram,
  Keypair,
  type SignatureStatus,
  TransactionInstruction,
} from "@solana/web3.js";
import { Connection, Transaction, VersionedMessage } from "@solana/web3.js";
import { backOff } from "exponential-backoff";
import base58 from "bs58";
import nacl from "tweetnacl";

const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId;

/** Gets estimate of compute units consumed by a given transaction */
export async function getComputeUnitsEstimate(
  transaction: Transaction,
  connection: Connection
) {
  const versionedTransactionMessage = VersionedMessage.deserialize(
    // @ts-ignore
    transaction.serializeMessage()
  );
  const versionedTransaction = new VersionedTransaction(
    versionedTransactionMessage
  );

  const computeUnitsEstimate = await await connection.simulateTransaction(
    versionedTransaction
  );

  return (computeUnitsEstimate.value?.unitsConsumed || 0) * 1.2;
}

// 10k CUs is 0.03 cents, assuming 150k CUs and $250 SOL
const MIN_CU_PRICE = 10_000;
// 10M CUs is $0.38, assuming 150k CUs and $250 SOL
const MAX_CU_PRICE = 10_000_000;

/** Gets a given transaction's priority fee estimate */
export async function getTransactionPriorityFeeEstimate(
  connection: Connection
) {
  const medianPriorityFees = await connection.getRecentPrioritizationFees({});

  // Get largest element in medianPriorityFee array

  // Initialize maximum element
  let medianPriorityFee = medianPriorityFees[0].prioritizationFee;

  // Traverse slots
  // from second and compare
  // every slot with current prioritizationFee
  for (let i = 1; i < medianPriorityFees.length; i++) {
    if (medianPriorityFees[i].prioritizationFee > medianPriorityFee)
      medianPriorityFee = medianPriorityFees[i].prioritizationFee;
  }

  const priorityFee = Math.min(
    Math.max(medianPriorityFee, MIN_CU_PRICE),
    MAX_CU_PRICE
  );

  return priorityFee;
}

/** Removes any compute budge program instructions if any */
function removeComputeBudgetInstructionsIfAny(transaction: Transaction) {
  // Ensure the transaction has instructions
  if (!transaction.instructions || transaction.instructions.length === 0) {
    return transaction;
  }

  // Filter out Compute Budget instructions
  const filteredInstructions = transaction.instructions.filter(
    (instruction) => !instruction.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)
  );

  // Create a new transaction with filtered instructions
  const newTransaction = new Transaction();
  newTransaction.recentBlockhash = transaction.recentBlockhash;
  newTransaction.feePayer = transaction.feePayer;
  newTransaction.instructions = filteredInstructions;

  return newTransaction;
}

function prependComputeBudgetInstructions(
  transaction: Transaction,
  computeBudgetInstructions: TransactionInstruction[]
) {
  const newInstructions = [
    ...computeBudgetInstructions,
    ...transaction.instructions,
  ];
  transaction.instructions = newInstructions;
  return transaction;
}

/**
 * ============================
 * Sign and Send Transaction
 * ============================
 * */
// A minute of retries, with 2 second intervals
const RETRY_INTERVAL_MS = 2000;
const MAX_RETRIES = 30;

type TxStatusUpdate =
  | { status: "created" }
  | { status: "signed" }
  | { status: "sent"; signature: string }
  | { status: "confirmed"; result: SignatureStatus };

function signTransaction(tx: Transaction, secretKey: string): Transaction {
  const keypair: Keypair = Keypair.fromSecretKey(base58.decode(secretKey));
  const signature = nacl.sign.detached(
    // @ts-ignore
    tx.serializeMessage(),
    keypair.secretKey
  );
  tx.addSignature(keypair.publicKey, Buffer.from(signature));
  return tx;
}

/** Sign and send a transaction with a priority fee. Assumes that the caller has already set the compute unit limit. */
export async function signAndSendTransaction(
  connection: Connection,
  signers: Keypair[],
  _txn: Transaction,
  onStatusUpdate?: (status: TxStatusUpdate) => void
) {
  let latestBlockhash;

  try {
    latestBlockhash = await backOff(
      async () => (await connection.getLatestBlockhash("confirmed")).blockhash
    );
  } catch (e) {
    throw new Error("Unable to get latest blockhash");
  }

  const unbudgetedTxn = removeComputeBudgetInstructionsIfAny(_txn);
  const priorityFee = await getTransactionPriorityFeeEstimate(connection);
  const computeUnitsEstimate = await getComputeUnitsEstimate(
    unbudgetedTxn,
    connection
  );

  const txn = prependComputeBudgetInstructions(unbudgetedTxn, [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitsEstimate,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee,
    }),
  ]);

  const feePayer = signers[0].publicKey;
  txn.recentBlockhash = latestBlockhash;
  txn.feePayer = feePayer;

  onStatusUpdate?.({ status: "created" });

  let signedTx;
  try {
    // All signers should sign the transaction
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      signedTx = await signTransaction(txn, base58.encode(signer.secretKey));
    }
  } catch (e: any) {
    throw new Error(e.message);
  }

  onStatusUpdate?.({ status: "signed" });

  let retries = 0;
  let signature: string | null = null;
  let status: SignatureStatus | null = null;

  while (retries < MAX_RETRIES) {
    await Promise.all([
      (async () => {
        try {
          const isFirstSend = signature === null;

          console.log(
            `retrying transaction ${signature} with ${retries} retries`
          );

          signature = await connection.sendRawTransaction(
            // @ts-ignore
            signedTx.serialize(),
            {
              skipPreflight: true,
              preflightCommitment: "confirmed",
              maxRetries: 0,
            }
          );

          if (isFirstSend) {
            onStatusUpdate?.({ status: "sent", signature });
          }
        } catch (e) {
          console.error(e);
        }
      })(),
      (async () => {
        if (signature) {
          try {
            const response = await connection.getSignatureStatus(signature);
            if (response.value) {
              status = response.value;
              if (response.value.err) {
                throw new Error(
                  `Transaction failed: ${JSON.stringify(response.value.err)}`
                );
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      })(),
    ]);
    retries++;

    if (
      status &&
      ((status as SignatureStatus).confirmationStatus === "confirmed" ||
        (status as SignatureStatus).confirmationStatus === "finalized")
    ) {
      onStatusUpdate?.({ status: "confirmed", result: status });
      return signature;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }
}
