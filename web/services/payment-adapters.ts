export type Network = "MTN" | "Airtel";
export interface PaymentAdapter { readonly network: Network; readonly mode: "sandbox" | "live"; lookupRegisteredName(msisdn: string, sandboxHint?: string): Promise<string>; sendPayment(): Promise<never>; }
abstract class SandboxAdapter implements PaymentAdapter {
  abstract readonly network: Network; readonly mode = "sandbox" as const;
  async lookupRegisteredName(msisdn: string, sandboxHint = "Unknown Recipient") { await new Promise((resolve) => setTimeout(resolve, 35)); const normalized = sandboxHint.trim().replace(/\s+/g, " ").toUpperCase(); return Number(msisdn.at(-1) ?? "1") % 4 === 0 ? `${normalized} (SANDBOX VARIANT)` : normalized; }
  async sendPayment(): Promise<never> { throw new Error("Sandbox verification adapters cannot move funds."); }
}
class MtnSandboxAdapter extends SandboxAdapter { readonly network = "MTN" as const; }
class AirtelSandboxAdapter extends SandboxAdapter { readonly network = "Airtel" as const; }
export function getPaymentAdapter(network: Network): PaymentAdapter { return network === "MTN" ? new MtnSandboxAdapter() : new AirtelSandboxAdapter(); }
