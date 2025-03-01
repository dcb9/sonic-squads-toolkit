# Sonic Squads Toolkit

This toolkit provides utilities for working with Squads V4 multi-signature wallets on Solana.

## Quick Reference

| Network             | RPC URL                                | Squads V4 Program ID                          |
| ------------------- | -------------------------------------- | --------------------------------------------- |
| Sonic Testnet       | `https://api.testnet.sonic.game`       | `sqdsFBUUwbsuoLUhoWdw343Je6mvn7dGVVRYCa4wtqJ` |
| Sonic Mainnet-Alpha | `https://api.mainnet-alpha.sonic.game` | `sqdsFBUUwbsuoLUhoWdw343Je6mvn7dGVVRYCa4wtqJ` |

## Installation

To install dependencies:

```bash
bun install
```

## Create Multisig

The toolkit includes a script to create a new Squads V4 multisig with configurable members and threshold.

### Setup

**Important**: Before using the toolkit, you must replace the dummy keypair file with your own admin keypair:

1. Generate your own Solana keypair if you don't already have one
2. Create a `.credentials` directory if it doesn't exist: `mkdir -p .credentials`
3. Save your keypair JSON file as `.credentials/multisig_admin.json`

⚠️ **Security Warning**: Never share your keypair or commit it to version control. The sample keypair included in this repository is for demonstration purposes only and should not be used.

### Usage

```bash
bun run src/create-multisig.ts --keypair <path-to-keypair> [options]
```

### Required Parameters

- `--keypair <path>`: Path to the admin keypair JSON file that will be used to sign transactions and will be the first member of the multisig

### Optional Parameters

- `--url <rpc-url>`: Custom RPC URL (defaults to https://api.testnet.sonic.game)
- `--memo <string>`: Custom memo for the multisig creation transaction
- `--member <pubkey>`: Additional member public key (can be specified multiple times)
- `--threshold <number>`: Number of signatures required to approve transactions (defaults to 1, cannot exceed total members)

### Examples

Create a basic multisig with just the admin keypair as a member:

```bash
bun run src/create-multisig.ts --keypair .credentials/multisig_admin.json
```

Create a multisig with additional members and custom threshold:

```bash
bun run src/create-multisig.ts \
  --keypair .credentials/multisig_admin.json \
  --member EHRFSE3mnpCVkBtL3F23miWyjgaLVjnucC9VDuT5Qin7 \
  --member 6Qs4nVtVLH3V22146JENLPCdVnk11xPzvEYBxbBpK31g \
  --threshold 2
```

Create a multisig for Sonic Mainnet:

```bash
bun run src/create-multisig.ts \
  --keypair .credentials/multisig_admin.json \
  --url https://api.mainnet-alpha.sonic.game \
  --memo "My Project Treasury Multisig"
```

### Output

On successful execution, the script will output:

- The transaction signature
- The multisig account address (important to save for future interactions)

### Notes

- By default, the threshold is set to 1 if not specified
- All members are given full permissions in the multisig
- The admin keypair will automatically be included as the first member of the multisig
- Ensure you have sufficient SOL in your admin account to pay for transaction fees
- The threshold represents the minimum number of signatures required to approve a transaction

## Build Upgrade Transaction

You can use the `build-upgrade-tx-base58.ts` script to create a serialized base58-encoded transaction message for upgrading a Solana program. This script is useful to prepare upgrade transactions with necessary parameters for execution.

### Setup

Ensure you have set up your keypairs and have the required parameters ready:

1. Make sure to have your `vault_public_key`, `program_id`, `buffer_account`, and `fee_payer_public_key` available.
2. Set up any required accounts with sufficient SOL to pay for transaction fees and operations.

### Usage

Run the script using the following command:

```bash
bun run src/build-upgrade-tx-base58.ts [options]
```

### Required Parameters

- `--vault_public_key <pubkey>`: The public key of the upgrade authority's vault.
- `--program_id <pubkey>`: The public key of the program you intend to upgrade.
- `--buffer_account <pubkey>`: The public key of the account containing the new program code.
- `--fee_payer_public_key <pubkey>`: The public key of the account paying for transaction fees.

### Optional Parameters

- `--url <rpc-url>`: Custom RPC URL to connect to the Solana network (defaults to `https://api.testnet.sonic.game`).

### Examples

Generate a base58-encoded transaction message for an upgrade:

```bash
$ bun run src/build-upgrade-tx-base58.ts \
    --vault_public_key 1U6E64e893D8AgK6JBFjzFFAWupkzBjhUASg6Py8HZv \
    --program_id DyA8s2ZrxpAcVevwYmEXZfddsKxAELo1ZjQtYpKRKzTz \
    --buffer_account  8FYJs2ChoEW7hAyzKzppwj9tmcTb6eaGHoCgqSApStRh \
    --fee_payer_public_key Gi2ommjX7QKTHPsyr96XSPoBDzzNnS4rtjMp4B4eEXas

Base58 Encoded Transaction Message:
PDbtyEi9CGUCvTKfdZqh7Vm3uQJo68cPFH8biFc5MgpdZpRRv87UuqrenLZQTiottqdZvVoQRUXzZ9h6pfiPSsu6xT1ZdmiBgNnfBFbEJd2Fw5HZMaLoBMZyx6jWh9rY5mbNmeZBGkwHsFyisEaBJCCZ3aLzvoGZPau5cJZsxRdUtq74DrMzn5J4EZHHDyGVmzUeLqiGZdqtLMNExDBRUrFe6HUNiPX43pmBBmadU7RvLBGidts1jaVWEGR92vGDRKmRNcmyevxgPk6tkZtLW5TC4m1pqsNBwfMaMH9W4W3tdVzQVPmgyCuEScE16Qys7EMkcNMrxkFv4VTBDLqsypecPVof8RdhLMGfDRZmLBLRSXmp62E7UF9R2CyPssmJVEMStnP42i7VMmRwXN56djGaocomRRj685xJ1razfmWbssmNKVCMLfo5q8ee1Uw9xxAninUy72K5i7
```

## Notes
This project was created using `bun init` in bun v1.1.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
