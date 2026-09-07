import { ethers } from "ethers";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BASE_MAINNET, BASE_CHAIN_ID, type ChainConfig } from "@/lib/litdex";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: never[]) => void) => void;
  removeListener?: (event: string, cb: (...args: never[]) => void) => void;
};

type WalletState = {
  address: string | null;
  chainId: number | null;
  hasWallet: boolean;
  connecting: boolean;
  correctNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (target?: ChainConfig) => Promise<void>;
  getProvider: () => ethers.BrowserProvider | null;
  getSigner: () => Promise<ethers.Signer>;
};

const WalletContext = createContext<WalletState | null>(null);

function getEthereum(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const eth = getEthereum();
    setHasWallet(!!eth);
    if (!eth) return;

    const readChain = async () => {
      try {
        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        setChainId(Number(cid));
      } catch {
        /* ignore */
      }
    };
    const readAccounts = async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        setAddress(accounts?.[0] ? ethers.getAddress(accounts[0]) : null);
      } catch {
        /* ignore */
      }
    };
    void readChain();
    void readAccounts();

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      setAddress(accounts?.[0] ? ethers.getAddress(accounts[0]) : null);
    };
    const onChain = (...args: never[]) => setChainId(Number(args[0] as unknown as string));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ? ethers.getAddress(accounts[0]) : null);
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number(cid));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  const switchNetwork = useCallback(async (target: ChainConfig = BASE_MAINNET) => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target.chainIdHex }],
      });
    } catch (err) {
      const code = (err as { code?: number; data?: { originalError?: { code?: number } } }).code;
      const nested = (err as { data?: { originalError?: { code?: number } } }).data?.originalError
        ?.code;
      if (code === 4902 || nested === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: target.chainIdHex,
              chainName: target.chainName,
              nativeCurrency: target.nativeCurrency,
              rpcUrls: target.rpcUrls,
              blockExplorerUrls: target.blockExplorerUrls,
            },
          ],
        });
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: target.chainIdHex }],
        });
      } else {
        throw err;
      }
    }
    try {
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number(cid));
    } catch {
      /* ignore */
    }
  }, []);

  const getProvider = useCallback(() => {
    const eth = getEthereum();
    if (!eth) return null;
    return new ethers.BrowserProvider(eth as unknown as ethers.Eip1193Provider);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error("No wallet found");
    return provider.getSigner();
  }, [getProvider]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      hasWallet,
      connecting,
      correctNetwork: chainId === BASE_CHAIN_ID,
      connect,
      disconnect,
      switchNetwork,
      getProvider,
      getSigner,
    }),
    [
      address,
      chainId,
      hasWallet,
      connecting,
      connect,
      disconnect,
      switchNetwork,
      getProvider,
      getSigner,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
