import { Keypair, PublicKey } from "@solana/web3.js";

export function validateRpcUrl(url: string): boolean {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === "http:" || urlObject.protocol === "https:";
  } catch {
    return false;
  }
}

export async function validateAndLoadKeypair(
  keypairPath: string
): Promise<Keypair> {
  if (!keypairPath) {
    throw new Error("Keypair path is required");
  }

  try {
    const file = Bun.file(keypairPath);
    const exists = await file.exists();

    if (!exists) {
      throw new Error(`Keypair file not found at: ${keypairPath}`);
    }

    const content = await file.text();
    const keypairData = JSON.parse(content);

    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid keypair file format at: ${keypairPath}`);
    }
    throw error;
  }
}

export function validatePublicKey(key: string): PublicKey | null {
  if (!key || typeof key !== "string") return null;
  try {
    return new PublicKey(key);
  } catch {
    return null;
  }
}

export function validateMembers(memberKeys: string[] | undefined): PublicKey[] {
  if (!memberKeys || memberKeys.length === 0) {
    return [];
  }

  const validMembers = memberKeys
    .map((key) => validatePublicKey(key))
    .filter((key): key is PublicKey => key !== null);

  if (validMembers.length !== memberKeys.length) {
    throw new Error("One or more member public keys are invalid");
  }

  return validMembers;
}

/**
 * Validates that the threshold is a positive integer not exceeding the total number of members
 * @param threshold The threshold value to validate
 * @param totalMembers The total number of members in the multisig
 * @returns The validated threshold value
 */
export function validateThreshold(
  threshold: number,
  totalMembers: number
): number {
  if (isNaN(threshold)) {
    throw new Error("Threshold must be a number");
  }

  if (threshold <= 0) {
    throw new Error("Threshold must be greater than 0");
  }

  if (threshold > totalMembers) {
    throw new Error(
      `Threshold (${threshold}) cannot be greater than the total number of members (${totalMembers})`
    );
  }

  // Ensure it's an integer
  return Math.floor(threshold);
}
