import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';

// 网络配置
export const NETWORKS = {
	ethereum: {
		chainId: "0x1",
		chainName: "Ethereum Mainnet",
		nativeCurrency: {
			name: "Ether",
			symbol: "ETH",
			decimals: 18,
		},
		rpcUrls: ["https://mainnet.infura.io/v3/"],
		blockExplorerUrls: ["https://etherscan.io/"],
	},
	bsc: {
		chainId: "0x38",
		chainName: "Binance Smart Chain",
		nativeCurrency: {
			name: "BNB",
			symbol: "BNB",
			decimals: 18,
		},
		rpcUrls: ["https://bsc-dataseed1.binance.org/"],
		blockExplorerUrls: ["https://bscscan.com/"],
	},
	sepolia: {
		chainId: "0xaa36a7",
		chainName: "Sepolia Testnet",
		nativeCurrency: {
			name: "Sepolia Ether",
			symbol: "ETH",
			decimals: 18,
		},
		rpcUrls: [
			"https://sepolia.gateway.tenderly.co/", 
			"https://rpc.sepolia.org/",
			"https://eth-sepolia.public.blastapi.io",
			"https://sepolia.ethereum.publicnode.com"],
		blockExplorerUrls: ["https://sepolia.etherscan.io/"],
	},
};

export interface WalletState {
	address: string | null;
	chainId: string | null;
	isConnected: boolean;
	balance: string;
	ensName: string | null;
	ensAvatar: string | null;
	userDisconnected: boolean; // 用户是否主动断开连接
}

interface WalletStore extends WalletState {
	// 状态更新方法
	setWallet: (wallet: Partial<WalletState>) => void;
	resetWallet: () => void;
	
	// 连接相关
	connectWallet: () => Promise<void>;
	disconnectWallet: () => void;
	updateWalletState: (address: string, chainId?: string) => Promise<void>; // 新增：静默更新状态
	
	// 网络相关
	switchNetwork: (networkKey: keyof typeof NETWORKS) => Promise<void>;
	
	// 数据获取
	getBalance: (address: string) => Promise<string>;
	getENSInfo: (address: string, chainId?: string) => Promise<{ ensName: string | null; ensAvatar: string | null }>;
	
	// 工具方法
	formatAddress: (address: string) => string;
	formatBalance: (balance: string) => string;
	getCurrentNetwork: () => typeof NETWORKS[keyof typeof NETWORKS] | null;
	isMetaMaskInstalled: () => boolean;
}

// 格式化地址
const formatAddress = (address: string) => {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 格式化余额
const formatBalance = (balance: string) => {
	const num = parseFloat(balance);
	return num < 0.0001 ? "0" : num.toFixed(4);
};

// 检查 MetaMask 是否已安装
const isMetaMaskInstalled = () => {
	return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
};

// 获取当前网络信息
const getCurrentNetwork = (chainId: string | null) => {
	const networkKey = Object.keys(NETWORKS).find(
		key => NETWORKS[key as keyof typeof NETWORKS].chainId === chainId
	);
	return networkKey ? NETWORKS[networkKey as keyof typeof NETWORKS] : null;
};

// 获取账户余额
const getBalance = async (address: string): Promise<string> => {
	try {
		if (window.ethereum) {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const balance = await provider.getBalance(address);
			return ethers.formatEther(balance);
		}
	} catch (error) {
		console.error("获取余额失败:", error);
	}
	return "0";
};

// 获取 ENS 信息
const getENSInfo = async (address: string, chainId?: string): Promise<{ ensName: string | null; ensAvatar: string | null }> => {
	try {
		// 使用传入的 chainId，如果都没有则尝试从 MetaMask 获取
		let currentChainId = chainId;
		
		// 如果 chainId 仍然为空，尝试从 MetaMask 获取当前网络
		if (!currentChainId && window.ethereum) {
			try {
				currentChainId = await window.ethereum.request({ method: "eth_chainId" });
			} catch (error) {
				console.error("获取当前网络失败:", error);
			}
		}
		
		// 只有在以太坊主网时才查询 ENS
		if (currentChainId === "0x1" && window.ethereum) {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const ensName = await provider.lookupAddress(address);
			let ensAvatar = null;

			if (ensName) {
				try {
					const resolver = await provider.getResolver(ensName);
					if (resolver) {
						ensAvatar = await resolver.getAvatar();
					}
				} catch (error) {
					console.log("获取 ENS 头像失败:", error);
				}
			}

			return { ensName, ensAvatar };
		}
	} catch (error) {
		console.error("获取 ENS 信息失败:", error);
	}
	return { ensName: null, ensAvatar: null };
};

export const useWalletStore = create<WalletStore>()(
	persist(
		(set, get) => ({
			// 初始状态
			address: null,
			chainId: null,
			isConnected: false,
			balance: "0",
			ensName: null,
			ensAvatar: null,
			userDisconnected: false,

			// 状态更新方法
			setWallet: (wallet) => set((state) => ({ ...state, ...wallet })),
			resetWallet: () => set({
				address: null,
				chainId: null,
				isConnected: false,
				balance: "0",
				ensName: null,
				ensAvatar: null,
				userDisconnected: false,
			}),

			// 连接钱包 - 会触发弹窗
			connectWallet: async () => {
				if (!isMetaMaskInstalled()) {
					alert("请安装 MetaMask 钱包！");
					return;
				}

				try {
					const accounts = await window.ethereum!.request({
						method: "eth_requestAccounts",
					});

					if (accounts.length > 0) {
						const address = accounts[0];
						const chainId = await window.ethereum!.request({ method: "eth_chainId" });
						const balance = await getBalance(address);
						const { ensName, ensAvatar } = await getENSInfo(address, chainId);

						set({
							address,
							chainId,
							isConnected: true,
							balance,
							ensName,
							ensAvatar,
							userDisconnected: false, // 重置用户断开连接状态
						});
					}
				} catch (error) {
					console.error("连接钱包失败:", error);
				}
			},

			// 静默更新钱包状态 - 不会触发弹窗
			updateWalletState: async (address: string, newChainId?: string) => {
				try {
					// 如果没有提供新的chainId，则获取当前的
					const chainId = newChainId || await window.ethereum!.request({ method: "eth_chainId" });
					const balance = await getBalance(address);
					const { ensName, ensAvatar } = await getENSInfo(address, chainId);

					set({
						address,
						chainId,
						isConnected: true,
						balance,
						ensName,
						ensAvatar,
						userDisconnected: false,
					});
				} catch (error) {
					console.error("更新钱包状态失败:", error);
				}
			},

			// 断开连接
			disconnectWallet: () => {
				set({
					address: null,
					chainId: null,
					isConnected: false,
					balance: "0",
					ensName: null,
					ensAvatar: null,
					userDisconnected: true, // 标记用户主动断开连接
				});
			},

			// 切换网络
			switchNetwork: async (networkKey) => {
				if (!window.ethereum) return;

				const network = NETWORKS[networkKey];
				
				try {
					await window.ethereum.request({
						method: "wallet_switchEthereumChain",
						params: [{ chainId: network.chainId }],
					});
					
					// 网络切换成功后，静默更新钱包状态
					const { address } = get();
					if (address) {
						await get().updateWalletState(address, network.chainId);
					}
				} catch (error: any) {
					// 如果网络不存在，则添加网络
					if (error.code === 4902) {
						try {
							await window.ethereum.request({
								method: "wallet_addEthereumChain",
								params: [network],
							});
							
							// 添加网络成功后，静默更新状态
							const { address } = get();
							if (address) {
								await get().updateWalletState(address, network.chainId);
							}
						} catch (addError) {
							console.error("添加网络失败:", addError);
						}
					} else {
						console.error("切换网络失败:", error);
					}
				}
			},

			// 数据获取方法
			getBalance,
			getENSInfo,

			// 工具方法
			formatAddress,
			formatBalance,
			getCurrentNetwork: () => getCurrentNetwork(get().chainId),
			isMetaMaskInstalled,
		}),
		{
			name: 'wallet-storage', // localStorage 的 key
			partialize: (state) => ({
				// 只持久化连接状态的数据
				address: state.isConnected ? state.address : null,
				chainId: state.isConnected ? state.chainId : null,
				isConnected: state.isConnected,
				balance: state.isConnected ? state.balance : "0",
				ensName: state.isConnected ? state.ensName : null,
				ensAvatar: state.isConnected ? state.ensAvatar : null,
				userDisconnected: state.userDisconnected, // 持久化用户断开连接状态
			}),
		}
	)
);